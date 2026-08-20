import { supabase } from './supabase'

export let globalCompanyId = null;
export const setGlobalCompanyId = (id) => {
  globalCompanyId = id;
};

// Helper to filter by company (for per-company tables)
const withCompany = (query) => globalCompanyId ? query.eq('company_id', globalCompanyId) : query;

async function logActivity(action, entity_type, entity_name, details = {}) {
  if (!globalCompanyId) return;
  try {
    // Get current user email
    let userEmail = null;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      userEmail = session?.user?.email || null;
    } catch (_) {}

    // Resolve party_id to party_name if present
    if (details.party_id && !details.party_name) {
      try {
        const { data: party } = await supabase.from('parties').select('name').eq('id', details.party_id).single();
        if (party) details.party_name = party.name;
      } catch (_) {}
    }

    await supabase.from('activity_logs').insert([{
      company_id: globalCompanyId,
      action,
      entity_type,
      entity_name,
      details,
      user_email: userEmail
    }]);
  } catch (err) {
    console.error('Failed to log activity:', err);
  }
}

// Log auth events (login/logout) — can be called without globalCompanyId
export async function logAuthActivity(action, email) {
  try {
    await supabase.from('activity_logs').insert([{
      company_id: globalCompanyId || null,
      action,
      entity_type: 'AUTH',
      entity_name: email,
      details: { timestamp: new Date().toISOString() },
      user_email: email
    }]);
  } catch (err) {
    console.error('Failed to log auth activity:', err)
  }
}

// --- HELPER TO COMPUTE TRUE BALANCES ---
async function getTruePartyBalances(supabase, partyIds = null, withCompanyFn) {
  let pQuery = withCompanyFn(supabase.from('parties').select('id, opening_balance'));
  if (partyIds) pQuery = pQuery.in('id', partyIds);
  const { data: parties } = await pQuery;

  let sQuery = withCompanyFn(supabase.from('sales').select('party_id, total_amount, coupon_no'));
  if (partyIds) sQuery = sQuery.in('party_id', partyIds);
  const { data: sales } = await sQuery;

  let pmtQuery = withCompanyFn(supabase.from('payments').select('party_id, amount'));
  if (partyIds) pmtQuery = pmtQuery.in('party_id', partyIds);
  const { data: payments } = await pmtQuery;

  let rQuery = withCompanyFn(supabase.from('sale_returns').select('party_id, total_amount'));
  if (partyIds) rQuery = rQuery.in('party_id', partyIds);
  const { data: returns } = await rQuery;

  let eQuery = withCompanyFn(supabase.from('expenses').select('party_id, amount, expense_types(name)'));
  if (partyIds) eQuery = eQuery.in('party_id', partyIds);
  const { data: expenses } = await eQuery;

  let wQuery = supabase.from('workers').select('id, party_id');
  if (partyIds) wQuery = wQuery.in('party_id', partyIds);
  const { data: workers } = await wQuery;

  let workerLedgers = [];
  if (workers && workers.length > 0) {
    const { data: wl } = await supabase.from('worker_ledger').select('worker_id, type, amount, source_type');
    workerLedgers = wl || [];
  }

  const map = {};
  parties?.forEach(p => { map[p.id] = Number(p.opening_balance || 0); });

  sales?.forEach(s => { if(s.party_id) map[s.party_id] = (map[s.party_id] || 0) + Number(s.total_amount || 0); });
  payments?.forEach(p => { if(p.party_id) map[p.party_id] = (map[p.party_id] || 0) - Number(p.amount || 0); });
  returns?.forEach(r => { if(r.party_id) map[r.party_id] = (map[r.party_id] || 0) - Number(r.total_amount || 0); });

  expenses?.forEach(e => {
    if(!e.party_id) return;
    if (e.expense_types?.name === 'Advance to Party') map[e.party_id] = (map[e.party_id] || 0) + Number(e.amount || 0);
    if (e.expense_types?.name === 'Bad Debt') map[e.party_id] = (map[e.party_id] || 0) - Number(e.amount || 0);
  });

  if (workers) {
    workers.forEach(w => {
      if(!w.party_id) return;
      const wl = workerLedgers.filter(l => l.worker_id === w.id);
      wl.forEach(l => {
        if (l.source_type === 'payment') return; // avoid double counting if recorded as both
        if (l.type === 'Debit') map[w.party_id] = (map[w.party_id] || 0) + Number(l.amount || 0);
        if (l.type === 'Credit') map[w.party_id] = (map[w.party_id] || 0) - Number(l.amount || 0);
      });
    });
  }
  return map;
}
// Helper to inject company_id (for inserts)
const injectCompany = (data) => globalCompanyId ? { ...data, company_id: globalCompanyId } : data;

export const api = {
  invoke: async (channel, ...args) => {
    try {
      switch (channel) {
        // =================== SEASONS ===================
        // NOTE: Seasons are GLOBAL — shared across all companies (same Kharif/Rabi applies to everyone)
        case 'seasons:getAll': {
          const { data, error } = await supabase.from('seasons').select('*').order('id', { ascending: false })
          if (error) throw error
          return data
        }
        case 'seasons:add': {
          const [data] = args
          let start_date, end_date, name
          if (data.type === 'kharif') {
            start_date = `${data.year}-04-01`
            end_date = `${data.year}-11-30`
            name = `Kharif ${data.year}`
          } else {
            start_date = `${data.year}-12-01`
            end_date = `${data.year + 1}-03-31`
            name = `Rabi ${data.year}-${(data.year + 1).toString().slice(2)}`
          }
          // Check if season with same name already exists (prevent duplicates)
          const { data: existing } = await supabase.from('seasons').select('id').eq('name', name).limit(1)
          if (existing && existing.length > 0) {
            throw new Error(`Season "${name}" already exists. Please set it active instead of creating a duplicate.`)
          }
          // Seasons are global — do NOT inject company_id
          const insertData = { ...data, name, start_date, end_date, is_active: false }
          const { data: result, error } = await supabase.from('seasons').insert(insertData).select().single()
          if (error) throw error
          return result
        }
        case 'seasons:setActive': {
          const [id] = args
          // Deactivate all seasons globally (seasons are shared across companies)
          await supabase.from('seasons').update({ is_active: false }).neq('id', 0)
          const { data, error } = await supabase.from('seasons').update({ is_active: true }).eq('id', id)
          if (error) throw error
          return data
        }
        case 'seasons:mergeDuplicates': {
          // Find all seasons, group by name, merge duplicates
          const { data: allSeasons } = await supabase.from('seasons').select('*').order('id', { ascending: true })
          if (!allSeasons) return { merged: 0 }
          
          const byName = {}
          for (const s of allSeasons) {
            if (!byName[s.name]) byName[s.name] = []
            byName[s.name].push(s)
          }
          
          let merged = 0
          for (const [name, seasons] of Object.entries(byName)) {
            if (seasons.length <= 1) continue
            
            // Keep the first (oldest) season, reassign records from duplicates
            const keepId = seasons[0].id
            const keepActive = seasons.some(s => s.is_active)
            const dupeIds = seasons.slice(1).map(s => s.id)
            
            // Reassign sales from duplicate seasons to the kept season
            for (const dupeId of dupeIds) {
              await supabase.from('sales').update({ season_id: keepId }).eq('season_id', dupeId)
              await supabase.from('sale_returns').update({ season_id: keepId }).eq('season_id', dupeId)
              await supabase.from('schemes').update({ season_id: keepId }).eq('season_id', dupeId)
              // Delete the duplicate season
              await supabase.from('seasons').delete().eq('id', dupeId)
            }
            
            // If any duplicate was active, keep the merged season active
            if (keepActive) {
              await supabase.from('seasons').update({ is_active: true }).eq('id', keepId)
            }
            
            merged += dupeIds.length
          }
          return { merged }
        }

        // =================== PARTIES ===================
        case 'parties:getAll': {
          // Fetch ALL parties to ensure workers without transactions appear
          const { data: allParties, error } = await withCompany(supabase.from('parties').select('*')).order('name')
          if (error) throw error
          
          // Fetch EXACT outstanding balances (bug-free, includes all returns/expenses/workers)
          const balanceMap = await getTruePartyBalances(supabase, null, withCompany)
          
          allParties.forEach(p => {
             p.balance = balanceMap[p.id] !== undefined ? balanceMap[p.id] : Number(p.opening_balance || 0);
          })

          const data = allParties;
          
          return data
        }
        case 'parties:add': {
          const [partyData] = args
          const { data, error } = await supabase.from('parties').insert(injectCompany(partyData)).select().single()
          if (error) throw error
          return data
        }
        case 'parties:update': {
          const [partyData] = args
          const { data, error } = await supabase.from('parties').update(partyData).eq('id', partyData.id)
          if (error) throw error
          return data
        }
        case 'parties:delete': {
          const [id] = args
          const { error } = await supabase.from('parties').delete().eq('id', id)
          if (error) throw error
          return true
        }
        case 'parties:getLedger': {
          const argsObj = typeof args[0] === 'object' ? args[0] : { partyId: args[0] }
          const { partyId, fromDate, toDate } = argsObj
          
          const { data: party } = await supabase.from('parties').select('*').eq('id', partyId).single()
          if (!party) return null
          
          const [salesRes, paymentsRes, expensesRes, returnsRes, couponsRes] = await Promise.all([
            supabase.from('sales').select('*, sale_items(*, products(name))').eq('party_id', partyId),
            supabase.from('payments').select('*').eq('party_id', partyId),
            supabase.from('expenses').select('*, expense_types(name)').eq('party_id', partyId),
            supabase.from('sale_returns').select('*, sale_return_items(*, products(name))').eq('party_id', partyId),
            withCompany(supabase.from('scheme_coupons').select('*, schemes(name, target_amount, season_id)').eq('party_id', partyId))
          ]);
          
          // Build coupon sales map: coupon_no -> total sales amount
          const couponSalesMap = {};
          (salesRes.data || []).forEach(s => {
            if (s.coupon_no) {
              couponSalesMap[s.coupon_no] = (couponSalesMap[s.coupon_no] || 0) + Number(s.total_amount || 0);
            }
          });

          const partyCoupons = (couponsRes.data || []).map(c => {
            const targetAmount = Number(c.schemes?.target_amount || 0);
            const materialSale = couponSalesMap[c.coupon_no] || 0;
            const materialBaki = Math.max(0, targetAmount - materialSale);
            return {
              id: c.id,
              coupon_no: c.coupon_no,
              scheme_name: c.schemes?.name || 'Unknown',
              target_amount: targetAmount,
              amount: Number(c.amount || 0),
              issue_date: c.issue_date,
              status: c.status,
              material_sale: materialSale,
              material_baki: materialBaki
            };
          });
          
          let rawEntries = [];

          salesRes.data?.forEach(s => {
             rawEntries.push({
                id: s.id,
                entry_date: s.date,
                ref: s.invoice_no,
                vch_no: s.invoice_no,
                debit: Number(s.total_amount),
                credit: 0,
                entry_type: 'sale',
                particulars: 'Cr Sales',
                narration: s.remarks || '',
                coupon_no: s.coupon_no || null,
                items: s.sale_items?.map(i => ({ name: i.products?.name, qty: i.qty, unit: i.unit, rate: i.rate, amount: i.amount })) || []
             });
          });

          paymentsRes.data?.forEach(p => {
             rawEntries.push({
                id: p.id,
                entry_date: p.date,
                ref: `Payment - ${p.mode}`,
                vch_no: 'Rcpt',
                debit: 0,
                credit: Number(p.amount),
                entry_type: 'payment',
                particulars: `Dr ${p.mode || 'Cash'}`,
                narration: p.remarks || '',
                items: []
             });
          });

          expensesRes.data?.forEach(e => {
             if (e.expense_types?.name === 'Advance to Party' || e.expense_types?.name === 'Bad Debt') {
               const isAdvance = e.expense_types?.name === 'Advance to Party';
               rawEntries.push({
                  id: e.id,
                  entry_date: e.date,
                  ref: e.expense_types?.name,
                  vch_no: 'Jrnl',
                  debit: isAdvance ? Number(e.amount) : 0,
                  credit: isAdvance ? 0 : Number(e.amount),
                  entry_type: 'expense',
                  particulars: isAdvance ? 'To Advance' : 'By Bad Debt',
                  narration: e.description || '',
                  items: []
               });
             }
          });

          // Fetch native worker ledger entries (monthly salary, attendance) if this party is also a worker
          const { data: workerForParty } = await supabase.from('workers').select('id').eq('party_id', partyId).single();
          if (workerForParty) {
            const { data: workerLedgerRes } = await supabase.from('worker_ledger')
              .select('*')
              .eq('worker_id', workerForParty.id)
              .not('source_type', 'in', '("payment","expense")'); // Exclude those already fetched above

            workerLedgerRes?.forEach(wl => {
              rawEntries.push({
                id: wl.id,
                entry_date: wl.date,
                ref: wl.source_type === 'monthly_salary' ? 'Salary' : wl.source_type === 'attendance' ? 'Attendance' : 'Ledger',
                vch_no: 'Jrnl',
                debit: wl.type === 'Debit' ? Number(wl.amount) : 0,
                credit: wl.type === 'Credit' ? Number(wl.amount) : 0,
                entry_type: 'worker_ledger',
                particulars: wl.type === 'Debit' ? 'Dr Worker' : 'Cr Worker',
                narration: wl.description || '',
                items: []
              });
            });
          }

          returnsRes.data?.forEach(r => {
             rawEntries.push({
                id: r.id,
                entry_date: r.date,
                ref: `Sale Return - ${r.return_no}`,
                vch_no: r.return_no,
                debit: 0,
                credit: Number(r.total_amount),
                entry_type: 'sale_return',
                particulars: 'By Sales Return',
                narration: r.reason || '',
                items: r.sale_return_items?.map(i => ({ name: i.products?.name, qty: i.qty, unit: i.unit, rate: i.rate, amount: i.amount })) || []
             });
          });

          // Also include worker_ledger entries if this party is a worker
          const { data: worker } = await supabase.from('workers').select('id').eq('party_id', partyId).maybeSingle();
          if (worker && worker.id) {
            const { data: workerLedger } = await supabase.from('worker_ledger').select('*').eq('worker_id', worker.id);
            workerLedger?.forEach(wl => {
              if (wl.source_type === 'payment') return; // Avoid double counting
              rawEntries.push({
                entry_date: wl.date,
                ref: `Worker Ledger`,
                vch_no: 'Jrnl',
                debit: wl.type === 'Debit' ? Number(wl.amount) : 0,
                credit: wl.type === 'Credit' ? Number(wl.amount) : 0,
                entry_type: 'worker_ledger',
                particulars: wl.description,
                narration: '',
                items: []
              });
            });
          }

          rawEntries.sort((a, b) => a.entry_date.localeCompare(b.entry_date) || a.entry_type.localeCompare(b.entry_type));

          let runningBalance = Number(party.opening_balance || 0);
          let openingBalanceForPeriod = runningBalance;
          let entries = [];
          
          for (const e of rawEntries) {
            const eDate = e.entry_date ? e.entry_date.substring(0, 10) : '';
            if (fromDate && eDate < fromDate) {
              runningBalance += (Number(e.debit) - Number(e.credit))
              openingBalanceForPeriod = runningBalance
            } else if ((!fromDate || eDate >= fromDate) && (!toDate || eDate <= toDate)) {
              runningBalance += (Number(e.debit) - Number(e.credit))
              entries.push({
                date: eDate,
                vch_no: e.vch_no,
                particulars: e.particulars,
                narration: e.narration,
                items: e.items,
                ref: e.ref,
                debit: Number(e.debit),
                credit: Number(e.credit),
                balance: runningBalance,
                type: e.entry_type,
                coupon_no: e.coupon_no || null
              })
            }
          }
          let totalSalesAmt = 0;
          let totalCouponSaleAmt = 0;
          salesRes.data?.forEach(s => {
            totalSalesAmt += Number(s.total_amount || 0);
            if (s.coupon_no) totalCouponSaleAmt += Number(s.total_amount || 0);
          });

          let partyReceipts = 0;
          paymentsRes.data?.forEach(p => { partyReceipts += Number(p.amount || 0); });

          let partyReturnsAmt = 0;
          returnsRes.data?.forEach(r => { partyReturnsAmt += Number(r.total_amount || 0); });

          let totalTargetAmount = 0;
          partyCoupons.forEach(c => { totalTargetAmount += c.target_amount; });

          // finalBal is equivalent to the running balance at the end of all entries
          let finalBal = Number(party.opening_balance || 0);
          for (const e of rawEntries) {
            finalBal += (Number(e.debit) - Number(e.credit));
          }

          const openingBal = Number(party.opening_balance || 0);
          const materialBaki = Math.max(0, totalTargetAmount - totalCouponSaleAmt);
          const paymentPending = finalBal; // Exact current ledger balance
          const totalBalance = paymentPending + materialBaki;

          const couponAnalyticsSummary = partyCoupons.length > 0 ? {
             materialSale: totalCouponSaleAmt,
             openingBal: openingBal,
             paymentJama: partyReceipts,
             materialBaki: materialBaki,
             paymentPending: paymentPending,
             totalBalance: totalBalance
          } : null;

          return { party, entries, openingBalanceForPeriod, coupons: partyCoupons, couponAnalyticsSummary }
        }

        // =================== ASSOCIATES ===================
        case 'associates:getAll': {
          const { data, error } = await withCompany(supabase.from('sale_associates').select('*')).order('name')
          if (error) throw error
          return data
        }
        case 'associates:add': {
          const [assocData] = args
          const { data, error } = await supabase.from('sale_associates').insert(injectCompany(assocData)).select().single()
          if (error) throw error
          return data
        }
        case 'associates:update': {
          const [assocData] = args
          const { data, error } = await supabase.from('sale_associates').update(assocData).eq('id', assocData.id)
          if (error) throw error
          return data
        }
        case 'associates:delete': {
          const [id] = args
          const { error } = await supabase.from('sale_associates').delete().eq('id', id)
          if (error) throw error
          return true
        }

        // =================== PRODUCTS & BATCHES ===================
        case 'products:getAll': {
          const { data, error } = await supabase.from('products').select('*').order('name')
          if (error) throw error
          return data
        }
        case 'products:add': {
          const [prodData] = args
          const { data, error } = await supabase.from('products').insert(prodData).select().single()
          if (error) throw error
          return data
        }
        case 'products:update': {
          const [prodData] = args
          const { data, error } = await supabase.from('products').update(prodData).eq('id', prodData.id)
          if (error) throw error
          return data
        }
        case 'products:delete': {
          const [id] = args
          const { error } = await supabase.from('products').delete().eq('id', id)
          if (error) throw error
          return true
        }
        case 'batches:getByProduct': {
          const [productId] = args
          const { data, error } = await supabase.from('batches').select('*').eq('product_id', productId).order('batch_no')
          if (error) throw error
          return data
        }
        case 'batches:add': {
          const [batchData] = args
          const { data, error } = await supabase.from('batches').insert(batchData).select().single()
          if (error) throw error
          return data
        }

        // =================== EXPENSES ===================
        case 'expenseTypes:getAll': {
          const { data, error } = await supabase.from('expense_types').select('*').order('name')
          if (error) throw error
          return data
        }
        case 'expenseTypes:add': {
          const [typeData] = args
          const { data, error } = await supabase.from('expense_types').insert(typeData).select().single()
          if (error) throw error
          return data
        }
        case 'expenseTypes:update': {
          const [id, updateData] = args
          const { data, error } = await supabase.from('expense_types').update(updateData).eq('id', id).select().single()
          if (error) throw error
          return data
        }
        case 'expenseTypes:delete': {
          const [id] = args
          const { error } = await supabase.from('expense_types').delete().eq('id', id)
          if (error) throw error
          return true
        }
        case 'expenses:getAll': {
          const [filters] = args || [{}]
          let q = withCompany(supabase.from('expenses').select('*, expense_types(name), parties(name)')).order('date', { ascending: false })
          if (filters?.season_id) {
            // Note: Currently expenses don't have season_id in schema, skipping filter or join if needed
          }
          if (filters?.fromDate || filters?.from_date) q = q.gte('date', filters.fromDate || filters.from_date)
          if (filters?.toDate || filters?.to_date) q = q.lte('date', filters.toDate || filters.to_date)
          if (filters?.expense_type_id) q = q.eq('expense_type_id', filters.expense_type_id)
          const { data, error } = await q
          if (error) throw error
          return data.map(d => ({...d, type_name: d.expense_types?.name, party_name: d.parties?.name}))
        }
        case 'expenses:add': {
          const [expData] = args
          
          const workerId = expData.worker_id;
          const expenseTypeId = expData.expense_type_id;
          // remove worker_id so it doesn't fail schema validation on expenses table
          delete expData.worker_id;

          const { data, error } = await supabase.from('expenses').insert(injectCompany(expData)).select().single()
          if (error) throw error
          
          if (workerId) {
             const { data: typeData } = await supabase.from('expense_types').select('name').eq('id', expenseTypeId).single()
             const desc = typeData ? typeData.name : 'Advance / Salary Paid'
             
             await supabase.from('worker_ledger').insert(injectCompany({
                worker_id: workerId,
                date: data.date,
                type: 'Debit',
                amount: data.amount,
                description: `${desc} - ${data.description || ''}`.trim(),
                related_expense_id: data.id
             }))
          }
          
          return data
        }
        case 'expenses:delete': {
          const [id] = args
          
          // First delete any linked worker ledger entries
          await supabase.from('worker_ledger').delete().eq('related_expense_id', id)
          
          const { error } = await supabase.from('expenses').delete().eq('id', id)
          if (error) throw error
          return true
        }
        case 'worker_ledger:cleanup_orphans': {
          const { data: ledgerEntries } = await supabase.from('worker_ledger').select('id, related_expense_id').not('related_expense_id', 'is', null)
          if (!ledgerEntries || ledgerEntries.length === 0) return 0;
          
          const expenseIds = ledgerEntries.map(e => e.related_expense_id)
          const { data: expenses } = await supabase.from('expenses').select('id').in('id', expenseIds)
          const existingExpenseIds = new Set((expenses || []).map(e => e.id))
          
          const orphanedIds = ledgerEntries.filter(e => !existingExpenseIds.has(e.related_expense_id)).map(e => e.id)
          if (orphanedIds.length > 0) {
            await supabase.from('worker_ledger').delete().in('id', orphanedIds)
          }
          return orphanedIds.length
        }

        // =================== PAYMENTS ===================
        case 'payments:getAll': {
          const [filters] = args || [{}]
          let q = withCompany(supabase.from('payments').select('*, parties(name)')).order('date', { ascending: false })
          if (filters?.fromDate) q = q.gte('date', filters.fromDate)
          if (filters?.toDate) q = q.lte('date', filters.toDate)
          const { data, error } = await q
          if (error) throw error
          return data.map(d => ({...d, party_name: d.parties?.name}))
        }
        case 'payments:add': {
          const [paymentData] = args
          const { data, error } = await supabase.from('payments').insert(injectCompany(paymentData)).select().single()
          if (error) throw error
          
          // Sync with worker ledger if party is a worker
          const { data: worker } = await supabase.from('workers').select('id, company_id').eq('party_id', data.party_id).single()
          if (worker) {
            await supabase.from('worker_ledger').insert({
              company_id: worker.company_id,
              worker_id: worker.id,
              date: data.date,
              amount: data.amount,
              type: data.payment_type === 'Payment from Party' ? 'Credit' : 'Debit',
              description: `Receipt Ref: ${data.mode} ${data.remarks ? '- ' + data.remarks : ''}`.trim(),
              source_type: 'payment',
              source_id: data.id
            })
          }
          
          return data
        }
        case 'payments:update': {
          const [paymentData] = args
          const { data, error } = await supabase.from('payments').update(paymentData).eq('id', paymentData.id).select().single()
          if (error) throw error
          
          // Sync with worker ledger
          const { data: worker } = await supabase.from('workers').select('id, company_id').eq('party_id', data.party_id).single()
          await supabase.from('worker_ledger').delete().match({ source_type: 'payment', source_id: data.id })
          if (worker) {
            await supabase.from('worker_ledger').insert({
              company_id: worker.company_id,
              worker_id: worker.id,
              date: data.date,
              amount: data.amount,
              type: data.payment_type === 'Payment from Party' ? 'Credit' : 'Debit',
              description: `Receipt Ref: ${data.mode} ${data.remarks ? '- ' + data.remarks : ''}`.trim(),
              source_type: 'payment',
              source_id: data.id
            })
          }
          
          return data
        }
        case 'payments:delete': {
          const [id] = args
          const { data: payment } = await supabase.from('payments').select('*').eq('id', id).single()
          if (payment) {
            await logActivity('DELETE', 'PAYMENT', payment.payment_type, { amount: payment.amount, party_id: payment.party_id })
          }
          const { error } = await supabase.from('payments').delete().eq('id', id)
          if (error) throw error
          
          await supabase.from('worker_ledger').delete().match({ source_type: 'payment', source_id: id })
          
          return true
        }
        case 'payments:changeSeason': {
          const [paymentIds, newSeasonId] = args
          const ids = Array.isArray(paymentIds) ? paymentIds : [paymentIds]
          const { error } = await supabase.from('payments').update({ season_id: newSeasonId }).in('id', ids)
          if (error) throw error
          return { moved: ids.length }
        }

        // =================== SALES ===================
        case 'sales:getAll': {
          const [filters] = args || [{}]
          let q = withCompany(supabase.from('sales_with_details').select('*')).order('date', { ascending: false }).order('id', { ascending: false })
          if (filters?.season_id) q = q.eq('season_id', filters.season_id)
          if (filters?.fromDate) q = q.gte('date', filters.fromDate)
          if (filters?.toDate) q = q.lte('date', filters.toDate)
          const { data, error } = await q
          if (error) throw error
          return data
        }
        case 'sales:getNextInvoice': {
          let prefix = 'INV-'
          if (globalCompanyId) {
            const { data: comp } = await supabase.from('companies').select('name').eq('id', globalCompanyId).single()
            if (comp) {
              if (comp.name === 'Ajay Bulk') prefix = 'BULK-'
              else if (comp.name === 'Uncle Bulk') prefix = 'UBULK-'
              // Pintu Sir Retail uses 'INV-'
            }
          }

          const { data } = await withCompany(supabase.from('sales').select('invoice_no')).order('id', { ascending: false }).limit(1)
          if (!data || data.length === 0) return `${prefix}001`
          
          const match = data[0].invoice_no.match(/(\d+)$/)
          const num = match ? parseInt(match[1], 10) + 1 : 1
          return `${prefix}${String(num).padStart(3, '0')}`
        }
        case 'sales:add': {
          const [saleData] = args
          const { items, ...rest } = saleData
          const { data: sale, error } = await supabase.from('sales').insert(injectCompany(rest)).select().single()
          if (error) throw error
          if (items && items.length > 0) {
            const itemsToInsert = items.map(i => ({ ...i, sale_id: sale.id }))
            await supabase.from('sale_items').insert(itemsToInsert)
          }
          await logActivity('CREATE', 'SALE', sale.invoice_no, { total_amount: sale.total_amount, party_id: sale.party_id })
          return { id: sale.id, invoice_no: sale.invoice_no }
        }
        case 'sales:getById': {
          const [id] = args
          const { data: sale, error } = await supabase.from('sales_with_details').select('*').eq('id', id).single()
          if (error) throw error
          const { data: items } = await supabase.from('sale_items').select('*, products(name)').eq('sale_id', id)
          return { sale, items: items.map(i => ({...i, product_name: i.products?.name})) }
        }
        case 'sales:update': {
          const [saleData] = args
          const { items, id, ...rest } = saleData
          await supabase.from('sales').update(rest).eq('id', id)
          await supabase.from('sale_items').delete().eq('sale_id', id)
          if (items && items.length > 0) {
            const itemsToInsert = items.map(i => ({ ...i, sale_id: id }))
            await supabase.from('sale_items').insert(itemsToInsert)
          }
          await logActivity('UPDATE', 'SALE', rest.invoice_no, { total_amount: rest.total_amount, party_id: rest.party_id })
          return id
        }
        case 'sales:delete': {
          const [id] = args
          const { data: sale } = await supabase.from('sales').select('invoice_no, total_amount, party_id').eq('id', id).single()
          if (sale) {
            await logActivity('DELETE', 'SALE', sale.invoice_no, { total_amount: sale.total_amount, party_id: sale.party_id })
          }
          await supabase.from('sales').delete().eq('id', id)
          return id
        }
        case 'sales:changeSeason': {
          const [saleIds, newSeasonId] = args
          const ids = Array.isArray(saleIds) ? saleIds : [saleIds]
          const { error } = await supabase.from('sales').update({ season_id: newSeasonId }).in('id', ids)
          if (error) throw error
          return { moved: ids.length }
        }

        // =================== PURCHASES ===================
        case 'purchases:getAll': {
          const [filters] = args || [{}]
          let q = withCompany(supabase.from('purchases_with_details').select('*')).order('date', { ascending: false }).order('id', { ascending: false })
          if (filters?.season_id) q = q.eq('season_id', filters.season_id)
          if (filters?.fromDate) q = q.gte('date', filters.fromDate)
          if (filters?.toDate) q = q.lte('date', filters.toDate)
          const { data, error } = await q
          if (error) throw error
          return data
        }
        case 'purchases:getNextInvoice': {
          let prefix = 'PUR-'
          const { data } = await withCompany(supabase.from('purchases').select('invoice_no')).order('id', { ascending: false }).limit(1)
          if (!data || data.length === 0) return `${prefix}001`
          const match = data[0].invoice_no.match(/(\d+)$/)
          const num = match ? parseInt(match[1], 10) + 1 : 1
          return `${prefix}${String(num).padStart(3, '0')}`
        }
        case 'purchases:add': {
          const [purchaseData] = args
          const { items, ...rest } = purchaseData
          const { data: purchase, error } = await supabase.from('purchases').insert(injectCompany(rest)).select().single()
          if (error) throw error
          if (items && items.length > 0) {
            const itemsToInsert = items.map(i => ({ ...i, purchase_id: purchase.id }))
            await supabase.from('purchase_items').insert(itemsToInsert)
          }
          return { id: purchase.id, invoice_no: purchase.invoice_no }
        }
        case 'purchases:getById': {
          const [id] = args
          const { data: purchase, error } = await supabase.from('purchases_with_details').select('*').eq('id', id).single()
          if (error) throw error
          const { data: items } = await supabase.from('purchase_items').select('*, products(name)').eq('purchase_id', id)
          return { purchase, items: items.map(i => ({...i, product_name: i.products?.name})) }
        }
        case 'purchases:update': {
          const [purchaseData] = args
          const { items, id, ...rest } = purchaseData
          await supabase.from('purchases').update(rest).eq('id', id)
          await supabase.from('purchase_items').delete().eq('purchase_id', id)
          if (items && items.length > 0) {
            const itemsToInsert = items.map(i => ({ ...i, purchase_id: id }))
            await supabase.from('purchase_items').insert(itemsToInsert)
          }
          return true
        }
        case 'purchases:delete': {
          const [id] = args
          await supabase.from('purchases').delete().eq('id', id)
          return true
        }

        // =================== SALE RETURNS ===================
        case 'saleReturns:getAll': {
          const [filters] = args || [{}]
          let q = withCompany(supabase.from('sale_returns')
            .select('*, parties(name), sales(invoice_no)'))
            .order('date', { ascending: false })
            .order('id', { ascending: false })
          if (filters?.season_id) q = q.eq('season_id', filters.season_id)
          const { data, error } = await q
          if (error) throw error
          return data.map(d => ({
            ...d, 
            party_name: d.parties?.name,
            original_invoice: d.sales?.invoice_no
          }))
        }
        case 'saleReturns:getNextReturnNo': {
          const { data } = await withCompany(supabase.from('sale_returns').select('return_no')).order('id', { ascending: false }).limit(1)
          if (!data || data.length === 0) return 'RET-001'
          const num = parseInt(data[0].return_no.replace('RET-', '')) + 1
          return `RET-${String(num).padStart(3, '0')}`
        }
        case 'saleReturns:add': {
          const [returnData] = args
          const { items, ...rest } = returnData
          const { data: saleReturn, error } = await supabase.from('sale_returns').insert(injectCompany(rest)).select().single()
          if (error) throw error
          
          if (items && items.length > 0) {
            const itemsToInsert = items.map(item => ({
              sale_return_id: saleReturn.id,
              product_id: item.product_id,
              qty: item.qty,
              rate: item.rate,
              amount: item.amount,
              unit: item.unit
            }))
            const { error: itemsError } = await supabase.from('sale_return_items').insert(itemsToInsert)
            if (itemsError) {
              // Rollback if items fail to insert
              await supabase.from('sale_returns').delete().eq('id', saleReturn.id)
              throw itemsError
            }
          }
          return true
        }
        case 'saleReturns:update': {
          const [id, returnData] = args
          const { items, ...rest } = returnData
          const { error: updateError } = await supabase.from('sale_returns').update(rest).eq('id', id)
          if (updateError) throw updateError
          
          await supabase.from('sale_return_items').delete().eq('sale_return_id', id)
          
          if (items && items.length > 0) {
            const itemsToInsert = items.map(item => ({
              sale_return_id: id,
              product_id: item.product_id,
              qty: item.qty,
              rate: item.rate,
              amount: item.amount,
              unit: item.unit
            }))
            const { error: itemsError } = await supabase.from('sale_return_items').insert(itemsToInsert)
            if (itemsError) throw itemsError
          }
          return true
        }
        case 'saleReturns:getById': {
          const [id] = args
          const { data: saleReturn, error } = await supabase.from('sale_returns').select('*').eq('id', id).single()
          if (error) throw error
          const { data: items } = await supabase.from('sale_return_items').select('*, products(name)').eq('sale_return_id', id)
          return { saleReturn, items: items.map(i => ({...i, product_name: i.products?.name})) }
        }
        case 'saleReturns:delete': {
          const [id] = args
          await supabase.from('sale_returns').delete().eq('id', id)
          return true
        }

        // =================== SCHEMES & COUPONS ===================
        case 'schemes:getAll': {
          const [seasonId] = args || []
          let q = withCompany(supabase.from('schemes').select('*')).order('name')
          if (seasonId) q = q.eq('season_id', seasonId)
          const { data, error } = await q
          if (error) throw error
          return data
        }
        case 'schemes:add': {
          const [schemeData] = args
          // Auto-fill start_date/end_date from the season if not provided
          if (!schemeData.start_date && schemeData.season_id) {
            const { data: season } = await supabase.from('seasons').select('start_date, end_date').eq('id', schemeData.season_id).single()
            if (season) {
              schemeData.start_date = season.start_date
              schemeData.end_date = season.end_date
            }
          }
          const { data, error } = await supabase.from('schemes').insert(injectCompany(schemeData)).select().single()
          if (error) throw error
          return data
        }
        case 'schemes:update': {
          const [schemeData] = args
          const { data, error } = await supabase.from('schemes').update(schemeData).eq('id', schemeData.id)
          if (error) throw error
          return data
        }
        case 'schemes:delete': {
          const [id] = args
          await supabase.from('schemes').delete().eq('id', id)
          return true
        }
        case 'coupons:getAll': {
          const [seasonId] = args || []
          let q = withCompany(supabase.from('scheme_coupons').select('*, schemes(name, season_id), parties(name)')).order('issue_date', { ascending: false })
          const { data, error } = await q
          if (error) throw error
          // Filter by season
          const filtered = seasonId ? data.filter(d => d.schemes?.season_id === seasonId) : data
          return filtered.map(d => ({...d, scheme_name: d.schemes?.name, party_name: d.parties?.name}))
        }
        case 'coupons:add': {
          const [couponData] = args
          const { data, error } = await supabase.from('scheme_coupons').insert(injectCompany(couponData)).select().single()
          if (error) throw error
          return data
        }
        case 'coupons:update': {
          const [couponData] = args
          const { data, error } = await supabase.from('scheme_coupons').update(couponData).eq('id', couponData.id)
          if (error) throw error
          return data
        }
        case 'coupons:delete': {
          const [id] = args
          await supabase.from('scheme_coupons').delete().eq('id', id)
          return true
        }

        // =================== REPORTS & SETTINGS & DASHBOARD ===================
        case 'dashboard:stats': {
          const [seasonId] = args || []
          
          // Fetch relevant data
          const { data: seasonData } = await supabase.from('seasons').select('*').eq('id', seasonId).single()
          
          const { data: salesData } = await withCompany(supabase.from('sales').select('*, parties(name, village, district)')).eq('season_id', seasonId)
          
          let expQuery = withCompany(supabase.from('expenses').select('*, expense_types(name)'))
          if (seasonData) {
            expQuery = expQuery.gte('date', seasonData.start_date).lte('date', seasonData.end_date)
          }
          const { data: expData } = await expQuery
          
          const { data: allCoupons } = await withCompany(supabase.from('scheme_coupons').select('*, schemes(season_id), parties(name, opening_balance)'))
          const couponsData = allCoupons?.filter(c => c.schemes?.season_id === seasonId) || []
          
          // For outstanding, we need all parties, all sales (all time), all payments, all returns
          const { data: partiesData } = await withCompany(supabase.from('parties').select('id, name, opening_balance'))
          const { data: allSales } = await withCompany(supabase.from('sales').select('total_amount, party_id'))
          const { data: allPayments } = await withCompany(supabase.from('payments').select('amount, party_id, date, payment_type, parties(name)'))
          const { data: allReturns } = await withCompany(supabase.from('sale_returns').select('total_amount, party_id'))

          const totalSales = salesData?.reduce((sum, s) => sum + Number(s.total_amount || 0), 0) || 0
          let seasonPayments = allPayments || []
          if (seasonData) {
             seasonPayments = seasonPayments.filter(p => {
               const pDate = p.date ? p.date.substring(0, 10) : ''
               return pDate >= seasonData.start_date && pDate <= seasonData.end_date
             })
          }
          const totalReceipts = seasonPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0)

          let advanceFromPartyTotal = 0
          seasonPayments.forEach(p => {
             if (p.payment_type === 'Advance from Party') {
                advanceFromPartyTotal += Number(p.amount || 0)
             }
          })

          let totalExpenses = expData?.reduce((sum, e) => sum + Number(e.amount || 0), 0) || 0
          totalExpenses -= advanceFromPartyTotal

          const netBalance = totalSales - totalExpenses
          const couponsIssued = couponsData.length

          const partyReceiptsMap = {}
          seasonPayments.forEach(p => {
             const pName = p.parties?.name || 'Unknown'
             const pId = p.party_id
             if(!partyReceiptsMap[pName]) partyReceiptsMap[pName] = { id: pId, total: 0 }
             partyReceiptsMap[pName].total += Number(p.amount || 0)
          })
          const receiptsList = Object.entries(partyReceiptsMap).map(([name, data]) => ({name, id: data.id, total: data.total})).sort((a,b) => b.total - a.total)

          // Compute Outstanding (Total Receivables > 0)
          let totalReceivables = 0
          const outstandingList = []
          if (partiesData) {
            partiesData.forEach(p => {
               let bal = Number(p.opening_balance || 0)
               // Add sales
               const pSales = allSales?.filter(s => s.party_id === p.id) || []
               bal += pSales.reduce((sum, s) => sum + Number(s.total_amount || 0), 0)
               // Subtract payments
               const pPayments = allPayments?.filter(pay => pay.party_id === p.id) || []
               bal -= pPayments.reduce((sum, pay) => sum + Number(pay.amount || 0), 0)
               // Subtract returns
               const pReturns = allReturns?.filter(r => r.party_id === p.id) || []
               bal -= pReturns.reduce((sum, r) => sum + Number(r.total_amount || 0), 0)
               // Add advances/subtract bad debts
               const pExp = expData?.filter(e => e.party_id === p.id) || []
               pExp.forEach(e => {
                 if (e.expense_types?.name === 'Advance to Party') bal += Number(e.amount || 0)
                 if (e.expense_types?.name === 'Bad Debt') bal -= Number(e.amount || 0)
               })
               
               if (bal > 0) {
                 totalReceivables += bal
                 outstandingList.push({ id: p.id, name: p.name, balance: bal })
               }
            })
          }
          // Sort outstanding list by largest balance first
          outstandingList.sort((a,b) => b.balance - a.balance)

          // Monthly Sales & Expenses
          const monthlyMap = {}
          salesData?.forEach(s => {
            const date = new Date(s.date)
            const m = date.toLocaleString('default', { month: 'short' })
            if(!monthlyMap[m]) monthlyMap[m] = { month: m, sales: 0, expenses: 0 }
            monthlyMap[m].sales += Number(s.total_amount || 0)
          })
          expData?.forEach(e => {
            const date = new Date(e.date)
            const m = date.toLocaleString('default', { month: 'short' })
            if(!monthlyMap[m]) monthlyMap[m] = { month: m, sales: 0, expenses: 0 }
            monthlyMap[m].expenses += Number(e.amount || 0)
          })
          const monthsOrder = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
          const monthlySalesExpenses = Object.values(monthlyMap).sort((a,b) => monthsOrder.indexOf(a.month) - monthsOrder.indexOf(b.month))

          // Expense Breakdown
          const expBreakdownMap = {}
          expData?.forEach(e => {
             const type = e.expense_types?.name || 'Other'
             if(!expBreakdownMap[type]) expBreakdownMap[type] = 0
             expBreakdownMap[type] += Number(e.amount || 0)
          })
          
          if (advanceFromPartyTotal > 0) {
             if(!expBreakdownMap['Advance to Party']) expBreakdownMap['Advance to Party'] = 0
             expBreakdownMap['Advance to Party'] -= advanceFromPartyTotal
          }

          const expenseBreakdown = Object.entries(expBreakdownMap).map(([name, total]) => ({name, total})).sort((a,b) => b.total - a.total)

          const partySalesMap = {}
          const locationSalesMap = {}
          
          // Helper to extract location from party name if db village is missing or generic
          const extractLocation = (partyName) => {
            let v = 'Unknown'
            let d = 'Unknown'
            if (!partyName) return { v, d }
            
            let nameWithoutDist = partyName
            const distMatch = partyName.match(/\(([^)]+)\)$/)
            if (distMatch) {
              d = distMatch[1].trim()
              nameWithoutDist = partyName.replace(/\([^)]+\)$/, '').trim()
            }
            
            const kwMatch = nameWithoutDist.match(/(?:\bK\.K\b|\bKK\b|\bKRUSHI\s+KENDRA\b|\bKRUSHY\s+KENDRA\b|\bKRUSHI\b|\bFARM\s+HOUSE\b|\bF\.P\.O\b|\bAGRO\b|\bDM\b)(.*)/i)
            if (kwMatch && kwMatch[1].trim()) {
              v = kwMatch[1].trim()
            } else {
              const parts = nameWithoutDist.split(' ')
              v = parts.length > 1 ? parts[parts.length - 1] : nameWithoutDist
            }
            v = v.replace(/^[.,\-]+|[.,\-]+$/g, '').trim()
            return { v, d }
          }
          
          salesData?.forEach(s => {
             const pName = s.parties?.name || 'Unknown'
             if(!partySalesMap[pName]) partySalesMap[pName] = 0
             partySalesMap[pName] += Number(s.total_amount || 0)
             
             // Location Analytics
             let dbVillage = s.parties?.village?.trim()
             let dbDistrict = s.parties?.district?.trim()
             
             let finalVillage = dbVillage || 'Unknown'
             let finalDistrict = dbDistrict || 'Unknown'
             
             if (finalVillage.toLowerCase() === 'unknown' || finalVillage === '') {
                const extracted = extractLocation(pName)
                finalVillage = extracted.v || 'Unknown'
                finalDistrict = extracted.d !== 'Unknown' ? extracted.d : finalDistrict
             }
             
             const locKey = `${finalVillage.toLowerCase()}, ${finalDistrict.toLowerCase()}`
             
             if(!locationSalesMap[locKey]) {
                locationSalesMap[locKey] = { 
                  village: finalVillage, 
                  district: finalDistrict, 
                  total: 0 
                }
             }
             locationSalesMap[locKey].total += Number(s.total_amount || 0)
          })
          const salesList = Object.entries(partySalesMap).map(([name, total]) => ({name, total})).sort((a,b) => b.total - a.total)
          const topParties = salesList.slice(0, 50)
          
          const locationAnalytics = Object.values(locationSalesMap).sort((a,b) => b.total - a.total).slice(0, 50)

          // Recent Sales
          const recentSales = (salesData || [])
            .sort((a,b) => new Date(b.created_at || b.date) - new Date(a.created_at || a.date))
            .slice(0, 5)
            .map(s => ({
              id: s.id,
              party_name: s.parties?.name || 'Unknown',
              invoice_no: s.invoice_no,
              date: s.date,
              total_amount: s.total_amount
            }))

          const couponSalesMap = {}
          salesData?.forEach(s => {
             if (s.coupon_no) {
                 couponSalesMap[s.coupon_no] = (couponSalesMap[s.coupon_no] || 0) + Number(s.total_amount || 0)
             }
          })
          
          const { data: schemesData } = await withCompany(supabase.from('schemes').select('*')).eq('season_id', seasonId)
          const schemesAnalytics = (schemesData || []).map(s => {
             const baseTarget = Number(s.target_amount || 0)
             let achievedCount = 0
             const partiesProgress = []
             const couponsForScheme = couponsData.filter(c => c.scheme_id === s.id)
             const participatingPartyIds = [...new Set(couponsForScheme.map(c => c.party_id))]

             if (baseTarget > 0) {
                 participatingPartyIds.forEach(pId => {
                     const partyCoupons = couponsForScheme.filter(c => c.party_id === pId)
                     
                     let totalSales = 0
                     let partyTarget = 0
                     
                     partyCoupons.forEach(c => {
                         totalSales += (couponSalesMap[c.coupon_no] || 0)
                         partyTarget += baseTarget
                     })

                     const percentage = Math.min((totalSales / partyTarget) * 100, 100)
                     const achieved = totalSales >= partyTarget
                     const partyName = partyCoupons[0]?.parties?.name || 'Unknown'

                     partiesProgress.push({
                        party_id: pId,
                        party_name: partyName,
                        total_sales: totalSales,
                        target: partyTarget,
                        percentage: percentage,
                        remaining: Math.max(partyTarget - totalSales, 0),
                        achieved: achieved
                     })
                     if (achieved) achievedCount++
                 })
             }
             
             // Sort stores by percentage descending
             partiesProgress.sort((a, b) => b.percentage - a.percentage)

             return {
                id: s.id,
                name: s.name,
                target: target,
                achievedCount,
                enrolledCount: participatingPartyIds.length,
                totalCoupons: couponsForScheme.length,
                partiesProgress
             }
          })

          // Coupon Analytics Summary for Dashboard
          // We need season-filtered sales/payments/returns per coupon party
          const couponPartyIds = [...new Set(couponsData.map(c => c.party_id).filter(Boolean))]
          
          // Fetch season-filtered data for coupon parties
          let couponPaymentsData = [], couponPartySalesData = [], couponReturnsData = []
          if (couponPartyIds.length > 0) {
            const [cpRes, csRes, crRes] = await Promise.all([
              withCompany(supabase.from('payments').select('party_id, amount, date').in('party_id', couponPartyIds)),
              withCompany(supabase.from('sales').select('party_id, total_amount, date, coupon_no').in('party_id', couponPartyIds)),
              withCompany(supabase.from('sale_returns').select('party_id, total_amount, date').in('party_id', couponPartyIds))
            ])
            couponPaymentsData = cpRes.data || []
            couponPartySalesData = csRes.data || []
            couponReturnsData = crRes.data || []
          }
          
          // Build per-party maps for coupon analytics
          const cpReceiptMap = {}, cpSalesMap = {}, cpReturnsMap = {}
          couponPaymentsData.forEach(p => { cpReceiptMap[p.party_id] = (cpReceiptMap[p.party_id] || 0) + Number(p.amount || 0) })
          couponPartySalesData.forEach(s => { cpSalesMap[s.party_id] = (cpSalesMap[s.party_id] || 0) + Number(s.total_amount || 0) })
          couponReturnsData.forEach(r => { cpReturnsMap[r.party_id] = (cpReturnsMap[r.party_id] || 0) + Number(r.total_amount || 0) })
          
          // Fetch party balances for coupon parties (bug-free, includes all returns/expenses)
          let cpBalanceMap = {}
          if (couponPartyIds.length > 0) {
            cpBalanceMap = await getTruePartyBalances(supabase, couponPartyIds, withCompany)
          }
          
          // Build coupon sales map by coupon_no
          const cpCouponSalesMap = {}
          couponPartySalesData.forEach(s => {
            if (s.coupon_no) {
              cpCouponSalesMap[s.coupon_no] = (cpCouponSalesMap[s.coupon_no] || 0) + Number(s.total_amount || 0)
            }
          })
          
          // Compute per-coupon analytics  
          let totalCouponMaterialSale = 0, totalCouponPaymentJama = 0
          let totalCouponMaterialBaki = 0, totalCouponPaymentPending = 0
          let totalCouponBalance = 0, totalCouponTarget = 0
          let couponAchieved = 0, couponInProgress = 0, couponNotStarted = 0
          
          const couponSchemeBreakdown = {}
          
          couponsData.forEach(c => {
            const scheme = schemesData?.find(s => s.id === c.scheme_id)
            const targetAmount = Number(scheme?.target_amount || 0)
            const couponSales = cpCouponSalesMap[c.coupon_no] || 0
            const partyReceipts = cpReceiptMap[c.party_id] || 0
            const partyCurrentBal = cpBalanceMap[c.party_id] || 0
            // Opening Balance = actual DB opening balance (same as ledger)
            const openingBal = Number(c.parties?.opening_balance || 0)
            const materialBaki = Math.max(0, targetAmount - couponSales)
            // Payment Pending = actual current balance from ledger (same as parties:getLedger)
            const paymentPending = partyCurrentBal
            const totalBalance = paymentPending + materialBaki
            
            totalCouponTarget += targetAmount
            totalCouponMaterialSale += couponSales
            totalCouponPaymentJama += partyReceipts
            totalCouponMaterialBaki += materialBaki
            totalCouponPaymentPending += paymentPending
            totalCouponBalance += totalBalance
            
            if (couponSales >= targetAmount && targetAmount > 0) couponAchieved++
            else if (couponSales > 0) couponInProgress++
            else couponNotStarted++
            
            c.analytics = {
              materialSale: couponSales,
              target: targetAmount,
              status: couponSales >= targetAmount && targetAmount > 0 ? 'achieved' : couponSales > 0 ? 'in-progress' : 'idle',
              paymentJama: partyReceipts,
              balance: totalBalance
            }

            // Per-scheme breakdown
            const sName = scheme?.name || 'Unknown'
            if (!couponSchemeBreakdown[sName]) {
              couponSchemeBreakdown[sName] = { name: sName, target: 0, materialSale: 0, paymentJama: 0, materialBaki: 0, paymentPending: 0, totalBalance: 0, achieved: 0, inProgress: 0, notStarted: 0, total: 0 }
            }
            const sb = couponSchemeBreakdown[sName]
            sb.target += targetAmount
            sb.materialSale += couponSales
            sb.paymentJama += partyReceipts
            sb.materialBaki += materialBaki
            sb.paymentPending += paymentPending
            sb.totalBalance += totalBalance
            sb.total++
            if (couponSales >= targetAmount && targetAmount > 0) sb.achieved++
            else if (couponSales > 0) sb.inProgress++
            else sb.notStarted++
          })
          
          const collectionEfficiency = totalCouponMaterialSale > 0 ? Math.round((totalCouponPaymentJama / totalCouponMaterialSale) * 10000) / 100 : 0
          const targetAchievementRate = couponsData.length > 0 ? Math.round((couponAchieved / couponsData.length) * 10000) / 100 : 0
          
          const couponSummary = {
            totalCoupons: couponsData.length,
            totalTarget: totalCouponTarget,
            totalMaterialSale: totalCouponMaterialSale,
            totalPaymentJama: totalCouponPaymentJama,
            totalMaterialBaki: totalCouponMaterialBaki,
            totalPaymentPending: totalCouponPaymentPending,
            totalBalance: totalCouponBalance,
            achieved: couponAchieved,
            inProgress: couponInProgress,
            notStarted: couponNotStarted,
            collectionEfficiency,
            targetAchievementRate,
            schemeBreakdown: Object.values(couponSchemeBreakdown)
          }

          return { 
            totalSales, 
            totalExpenses, 
            totalReceipts,
            netBalance, 
            totalReceivables, 
            couponsIssued,
            monthlySalesExpenses,
            expenseBreakdown,
            topParties,
            recentSales,
            outstandingList,
            salesList,
            receiptsList,
            couponsList: couponsData,
            schemesAnalytics,
            couponSummary,
            locationAnalytics
          }
        }
        case 'settings:get': {
          const { data } = await supabase.from('settings').select('*')
          const s = {}
          data?.forEach(d => { s[d.key] = d.value })
          return s
        }
        case 'activity:getAll': {
          const [filters = {}] = args
          let q = supabase.from('activity_logs').select('*')
          // Filter by company if set (but also show AUTH logs without company)
          if (globalCompanyId) {
            q = q.or(`company_id.eq.${globalCompanyId},and(entity_type.eq.AUTH,company_id.is.null)`)
          }
          if (filters.action) q = q.eq('action', filters.action)
          if (filters.entity_type) q = q.eq('entity_type', filters.entity_type)
          if (filters.fromDate) q = q.gte('created_at', filters.fromDate)
          if (filters.toDate) q = q.lte('created_at', filters.toDate + 'T23:59:59')
          const { data, error } = await q.order('created_at', { ascending: false }).limit(200)
          if (error) throw error
          return data
        }
        case 'settings:update': {
          const [settingsObj] = args
          for (const [key, value] of Object.entries(settingsObj)) {
            await supabase.from('settings').upsert({ key, value })
          }
          return true
        }
        case 'reports:couponAnalytics': {
          const [seasonId] = args
          
          // 1. Fetch all schemes for this season
          const { data: schemes } = await withCompany(
            supabase.from('schemes').select('*').eq('season_id', seasonId)
          )
          if (!schemes || schemes.length === 0) return { schemes: [], coupons: [], summary: { totalSchemes: 0, totalCoupons: 0, totalSales: 0, totalTarget: 0 } }
          
          const schemeIds = schemes.map(s => s.id)
          
          // 2. Fetch all coupons for these schemes
          const { data: coupons } = await withCompany(
            supabase.from('scheme_coupons').select('*, parties(name, village, district, opening_balance)').in('scheme_id', schemeIds)
          )
          
          const partyIds = [...new Set((coupons || []).map(c => c.party_id).filter(Boolean))]

          // Fetch EXACT outstanding balances for these parties (bug-free, includes all returns/expenses)
          const balanceMap = await getTruePartyBalances(supabase, partyIds, withCompany)

          // Fetch receipts received (payments) for these parties in the current season
          // Using season start/end dates is more reliable as season_id might not be fully backfilled on all payments
          const { data: season } = await supabase.from('seasons').select('start_date, end_date').eq('id', seasonId).single()
          
          let partyPaymentsQuery = supabase.from('payments').select('party_id, amount, date').in('party_id', partyIds)
          let partySalesQuery = supabase.from('sales').select('party_id, total_amount, date').in('party_id', partyIds)
          let partyReturnsQuery = supabase.from('sale_returns').select('party_id, total_amount, date').in('party_id', partyIds)
          
          // Do NOT filter by season date. The ledger shows ALL payments for the party in "Payment Jama",
          // so to match the Ledger exactly, we fetch all-time payments.
          
          const [ { data: partyPayments }, { data: partySales }, { data: partyReturns } ] = await Promise.all([
            withCompany(partyPaymentsQuery),
            withCompany(partySalesQuery),
            withCompany(partyReturnsQuery)
          ])
          
          const receiptMap = {}
          ;(partyPayments || []).forEach(p => { receiptMap[p.party_id] = (receiptMap[p.party_id] || 0) + Number(p.amount || 0) })
          
          const salesMap = {}
          ;(partySales || []).forEach(s => { salesMap[s.party_id] = (salesMap[s.party_id] || 0) + Number(s.total_amount || 0) })
          
          const returnsMap = {}
          ;(partyReturns || []).forEach(r => { returnsMap[r.party_id] = (returnsMap[r.party_id] || 0) + Number(r.total_amount || 0) })

          // 3. Fetch all sales that have a coupon_no, for this season
          const { data: salesWithCoupons } = await withCompany(
            supabase.from('sales')
              .select('*, sale_items(*, products(name, unit))')
              .eq('season_id', seasonId)
              .not('coupon_no', 'is', null)
              .neq('coupon_no', '')
          )
          
          // 4. Build a map: coupon_no -> { sales, totalAmount, items }
          const couponSalesMap = {}
          ;(salesWithCoupons || []).forEach(sale => {
            const cno = sale.coupon_no
            if (!couponSalesMap[cno]) {
              couponSalesMap[cno] = { totalAmount: 0, salesCount: 0, items: [] }
            }
            couponSalesMap[cno].totalAmount += Number(sale.total_amount || 0)
            couponSalesMap[cno].salesCount += 1
            ;(sale.sale_items || []).forEach(item => {
              couponSalesMap[cno].items.push({
                product_name: item.products?.name || 'Unknown',
                unit: item.products?.unit || item.unit || '',
                qty: Number(item.qty || 0),
                rate: Number(item.rate || 0),
                amount: Number(item.amount || 0)
              })
            })
          })
          
          // 5. Build coupon-level detail
          const couponDetails = (coupons || []).map(c => {
            const scheme = schemes.find(s => s.id === c.scheme_id)
            const salesData = couponSalesMap[c.coupon_no] || { totalAmount: 0, salesCount: 0, items: [] }
            const targetAmount = Number(scheme?.target_amount || 0)
            const totalSales = salesData.totalAmount
            const remaining = Math.max(0, targetAmount - totalSales)
            const completionPct = targetAmount > 0 ? Math.min(100, (totalSales / targetAmount) * 100) : 0
            
            // Aggregate items by product
            const productMap = {}
            salesData.items.forEach(item => {
              const key = item.product_name
              if (!productMap[key]) {
                productMap[key] = { product_name: item.product_name, unit: item.unit, qty: 0, amount: 0 }
              }
              productMap[key].qty += item.qty
              productMap[key].amount += item.amount
            })

            const partyCurrentBal = balanceMap[c.party_id] || 0
            const partyReceipts = receiptMap[c.party_id] || 0
            // Opening Balance = actual DB opening balance (same as ledger)
            const openingBal = Number(c.parties?.opening_balance || 0)
            
            const materialBaki = Math.max(0, targetAmount - totalSales)
            
            // Payment Pending = actual current balance from ledger (same as parties:getLedger)
            const couponPaymentPending = partyCurrentBal
            
            // Total Balance = Payment Pending + Material Baki
            const totalBalance = couponPaymentPending + materialBaki

            return {
              id: c.id,
              coupon_no: c.coupon_no,
              issue_date: c.issue_date,
              party_id: c.party_id,
              party_name: c.parties?.name || 'Unknown',
              party_village: c.parties?.village || '',
              party_district: c.parties?.district || '',
              scheme_id: c.scheme_id,
              scheme_name: scheme?.name || 'Unknown',
              target_amount: targetAmount,
              total_sales: totalSales,
              remaining: remaining,
              completion_pct: Math.round(completionPct * 100) / 100,
              sales_count: salesData.salesCount,
              products: Object.values(productMap),
              status: totalSales >= targetAmount ? 'ACHIEVED' : totalSales > 0 ? 'IN_PROGRESS' : 'NOT_STARTED',
              party_outstanding: partyCurrentBal, // Keep current balance for reference if needed
              party_receipts: partyReceipts,
              opening_bal: openingBal,
              material_baki: materialBaki,
              coupon_payment_pending: couponPaymentPending,
              total_balance: totalBalance
            }
          })
          
          // 6. Build scheme-level summaries
          const schemeSummaries = schemes.map(scheme => {
            const schemeCoupons = couponDetails.filter(c => c.scheme_id === scheme.id)
            const totalCoupons = schemeCoupons.length
            const totalSales = schemeCoupons.reduce((sum, c) => sum + c.total_sales, 0)
            const totalTarget = totalCoupons * Number(scheme.target_amount || 0)
            const totalRemaining = schemeCoupons.reduce((sum, c) => sum + c.remaining, 0)
            const achieved = schemeCoupons.filter(c => c.status === 'ACHIEVED').length
            const inProgress = schemeCoupons.filter(c => c.status === 'IN_PROGRESS').length
            const notStarted = schemeCoupons.filter(c => c.status === 'NOT_STARTED').length
            
            return {
              id: scheme.id,
              name: scheme.name,
              target_per_coupon: Number(scheme.target_amount || 0),
              benefit_description: scheme.benefit_description || '',
              total_coupons: totalCoupons,
              total_sales: totalSales,
              total_target: totalTarget,
              total_remaining: totalRemaining,
              completion_pct: totalTarget > 0 ? Math.round((totalSales / totalTarget) * 10000) / 100 : 0,
              achieved,
              in_progress: inProgress,
              not_started: notStarted,
              coupons: schemeCoupons
            }
          })
          
          // 7. Overall summary
          const summary = {
            totalSchemes: schemes.length,
            totalCoupons: couponDetails.length,
            totalSales: couponDetails.reduce((sum, c) => sum + c.total_sales, 0),
            totalTarget: schemeSummaries.reduce((sum, s) => sum + s.total_target, 0),
            totalAchieved: couponDetails.filter(c => c.status === 'ACHIEVED').length,
            totalInProgress: couponDetails.filter(c => c.status === 'IN_PROGRESS').length,
            totalNotStarted: couponDetails.filter(c => c.status === 'NOT_STARTED').length
          }
          
          return { schemes: schemeSummaries, coupons: couponDetails, summary }
        }
        case 'reports:partySchemeLedger': {
          const { partyId, schemeId } = args[0]
          return { party: null, scheme: null, salesRows: [] } // Minimal stub for migration
        }
        case 'reports:batchManufacturing': {
          return [] // Minimal stub
        }

        case 'analytics:getProductSales': {
          const [seasonId, productName] = args || []
          let query = supabase.from('sale_items')
              .select('qty, amount, products!inner(name), sales!inner(date, invoice_no, company_id, season_id, parties(name))')
              .eq('sales.season_id', seasonId)
              .eq('products.name', productName)
          if (globalCompanyId) {
             query = query.eq('sales.company_id', globalCompanyId)
          }
          const { data, error } = await query
          if (error) throw error

          return data.map(d => ({
            date: d.sales.date,
            invoice_no: d.sales.invoice_no,
            party_name: d.sales.parties?.name,
            qty: d.qty,
            amount: d.amount
          })).sort((a, b) => new Date(b.date) - new Date(a.date))
        }

        case 'analytics:getHubData': {
          const [seasonId] = args || []
          
          let saleItemsQuery = supabase.from('sale_items')
              .select('qty, amount, products!inner(name), sales!inner(season_id, party_id, date, company_id)')
              .eq('sales.season_id', seasonId)
          if (globalCompanyId) {
             saleItemsQuery = saleItemsQuery.eq('sales.company_id', globalCompanyId)
          }
          const { data: saleItems, error: err1 } = await saleItemsQuery
          if (err1) throw err1

          const { data: expenses, error: err2 } = await withCompany(
            supabase.from('expenses')
              .select('amount, expense_types!inner(name), party_id')
          )
          if (err2) throw err2

          const { data: parties, error: err3 } = await withCompany(
            supabase.from('parties').select('id, name, opening_balance')
          )
          if (err3) throw err3

          const { data: salesForParties, error: err4 } = await withCompany(
            supabase.from('sales').select('total_amount, party_id, date')
          )
          if (err4) throw err4

          const { data: paymentsForParties, error: err5 } = await withCompany(
            supabase.from('payments').select('amount, party_id, date')
          )
          if (err5) throw err5

          // 1. Product Sales Analysis (Revenue & Volume)
          const productMap = {}
          saleItems?.forEach(si => {
             const pName = si.products?.name || 'Unknown'
             if(!productMap[pName]) productMap[pName] = { name: pName, revenue: 0, volume: 0 }
             productMap[pName].revenue += Number(si.amount || 0)
             productMap[pName].volume += Number(si.qty || 0)
          })
          const topProductsByRev = Object.values(productMap).sort((a,b) => b.revenue - a.revenue).slice(0, 10)
          const topProductsByVol = Object.values(productMap).sort((a,b) => b.volume - a.volume).slice(0, 10)

          // 2. Party Risk Analysis (Outstanding)
          // Fetch exact balances using our helper
          const partyBalances = await getTruePartyBalances(supabase, null, withCompany)
          
          const partyRisks = []
          const now = new Date()

          parties?.forEach(p => {
             const bal = partyBalances[p.id] || 0
             if (bal > 0) {
                const pPayments = paymentsForParties?.filter(pay => pay.party_id === p.id) || []
                const latestPay = pPayments.sort((a,b) => new Date(b.date || 0) - new Date(a.date || 0))[0]
                
                // Compute Aging
                let remainingBal = bal
                let aging = {
                  days_15: 0,
                  month_1: 0,
                  month_2: 0,
                  month_3: 0,
                  above_3_months: 0
                }

                const pSales = salesForParties?.filter(s => s.party_id === p.id).sort((a,b) => new Date(b.date || 0) - new Date(a.date || 0)) || []
                
                for (const sale of pSales) {
                   if (remainingBal <= 0) break
                   const amt = Math.min(remainingBal, Number(sale.total_amount || 0))
                   if (amt <= 0) continue

                   const saleDate = new Date(sale.date)
                   const diffTime = Math.abs(now - saleDate)
                   const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))

                   if (diffDays <= 15) aging.days_15 += amt
                   else if (diffDays <= 30) aging.month_1 += amt
                   else if (diffDays <= 60) aging.month_2 += amt
                   else if (diffDays <= 90) aging.month_3 += amt
                   else aging.above_3_months += amt

                   remainingBal -= amt
                }

                // Any leftover balance (opening bal, etc) goes to oldest bucket
                if (remainingBal > 0) {
                   aging.above_3_months += remainingBal
                }

                partyRisks.push({
                   id: p.id,
                   name: p.name,
                   outstanding: bal,
                   lastPaymentDate: latestPay && latestPay.date ? latestPay.date : null,
                   aging: aging
                })
             }
          })
          const topRisks = partyRisks.sort((a,b) => b.outstanding - a.outstanding)

          return {
             topProductsByRev,
             topProductsByVol,
             topRisks
          }
        }

        // =================== WORKERS ===================
        case 'workers:getAll': {
          const { data, error } = await withCompany(supabase.from('workers').select('*')).order('name')
          if (error) throw error
          return data
        }
        case 'workers:add': {
          const [workerData] = args
          const companyData = injectCompany(workerData)
          
          // 1. Create Party for this worker first
          const { data: party, error: pErr } = await supabase.from('parties').insert({
            company_id: companyData.company_id,
            name: workerData.name,
            mobile: workerData.phone || '',
            party_type: 'Worker',
            opening_balance: 0
          }).select().single()
          
          if (pErr) throw pErr
          
          // 2. Create Worker and link party_id
          const { data, error } = await supabase.from('workers').insert({
            ...companyData,
            party_id: party.id
          }).select().single()
          
          if (error) throw error
          return data
        }
        case 'workers:update': {
          const [id, workerData] = args
          const { data, error } = await supabase.from('workers').update(workerData).eq('id', id).select().single()
          if (error) throw error
          
          // Sync party name and phone if party_id exists
          if (data && data.party_id) {
            await supabase.from('parties').update({
              name: workerData.name,
              mobile: workerData.phone || ''
            }).eq('id', data.party_id)
          }
          
          return data
        }
        case 'workers:delete': {
          const [id] = args
          // Get the worker first to find party_id
          const { data: worker } = await supabase.from('workers').select('party_id').eq('id', id).single()
          
          const { error } = await supabase.from('workers').delete().eq('id', id)
          if (error) throw error
          
          // Optionally delete the linked party, though it might be safer to keep it for history
          // Or just let the user delete the party manually if desired. We will leave the party intact to preserve ledger history.
          return true;
        }
        case 'workers:resetWeeklyPayment': {
          const [workerId, fromDate, toDate] = args;
          // Get ledger debits for this worker in the date range
          const { data: ledgers, error: lErr } = await withCompany(
            supabase.from('worker_ledger')
            .select('id, related_expense_id')
            .eq('worker_id', workerId)
            .eq('type', 'Debit')
            .gte('date', fromDate)
            .lte('date', toDate)
          );
          if (lErr) throw lErr;

          const expenseIds = ledgers.filter(l => l.related_expense_id).map(l => l.related_expense_id);
          const ledgerIds = ledgers.map(l => l.id);

          // 1. Delete worker_ledger entries directly linked
          if (ledgerIds.length > 0) {
            await supabase.from('worker_ledger').delete().in('id', ledgerIds);
          }

          // 2. Delete the associated expenses
          if (expenseIds.length > 0) {
            await supabase.from('expenses').delete().in('id', expenseIds);
          }

          return true;
        }
        case 'workers:getSummary': {
          const [fromDate, toDate] = args;
          
          // 1. Get all daily/commission workers (exclude Monthly)
          const { data: workers, error: wErr } = await withCompany(supabase.from('workers').select('*').neq('salary_type', 'Monthly')).order('name');
          if (wErr) throw wErr;
          
          // 2. Get attendance in range
          let attQuery = supabase.from('worker_attendance').select('*').gte('date', fromDate).lte('date', toDate);
          const { data: attendance, error: aErr } = await withCompany(attQuery);
          if (aErr) throw aErr;
          
          // 3. Get ledger debits (payments/advances) in range
          let ledQuery = supabase.from('worker_ledger').select('*').eq('type', 'Debit').gte('date', fromDate).lte('date', toDate);
          const { data: ledgers, error: lErr } = await withCompany(ledQuery);
          if (lErr) throw lErr;
          
          // 4. Calculate summary per worker
          const summary = workers.map(w => {
             const workerAtt = attendance.filter(a => a.worker_id === w.id && a.approved);
             const presentDays = workerAtt.filter(a => a.status === 'Present').length;
             const halfDays = workerAtt.filter(a => a.status === 'Half Day').length;
             const totalDays = presentDays + (halfDays * 0.5);
             const earned = w.salary_type === 'Daily' ? totalDays * w.taking_salary : 0; // Use taking_salary for weekly register
             
             const workerLedgers = ledgers.filter(l => l.worker_id === w.id);
             const paidAmount = workerLedgers.reduce((sum, l) => sum + Number(l.amount), 0);
             
             // Build records map
             const records = {};
             workerAtt.forEach(a => {
               records[a.date] = a.status;
             });
             
             return {
                ...w,
                presentDays,
                halfDays,
                totalDays,
                earned,
                paidAmount,
                records
             };
          });
          
          return summary;
        }

        case 'workers:getMonthlySalarySummary': {
          const [year, month] = args; // month is 0-indexed (0 = Jan, 11 = Dec)
          
          // Calculate start and end of month
          const startDate = new Date(year, month, 1);
          const endDate = new Date(year, month + 1, 0); // Last day of month
          const daysInMonth = endDate.getDate();
          
          // Find all non-Sundays in the month to check for absences
          const nonSundays = [];
          for (let d = 1; d <= daysInMonth; d++) {
            const date = new Date(year, month, d);
            if (date.getDay() !== 0) { // 0 is Sunday
              nonSundays.push(date.toISOString().split('T')[0]);
            }
          }
          
          const fromDateStr = startDate.toISOString().split('T')[0];
          const toDateStr = endDate.toISOString().split('T')[0];
          
          // Get Monthly workers
          const { data: workers, error: wErr } = await withCompany(supabase.from('workers').select('*').eq('salary_type', 'Monthly')).order('name');
          if (wErr) throw wErr;
          
          // Get attendance for this month
          const { data: attendance, error: aErr } = await withCompany(supabase.from('worker_attendance').select('*').gte('date', fromDateStr).lte('date', toDateStr));
          if (aErr) throw aErr;
          
          // Build summary per worker
          const summary = workers.map(w => {
            const workerAtt = attendance.filter(a => a.worker_id === w.id && a.approved);
            
            let absentNonSundays = 0;
            let halfDayNonSundays = 0;
            
            workerAtt.forEach(a => {
              if (nonSundays.includes(a.date)) {
                if (a.status === 'Absent') absentNonSundays++;
                if (a.status === 'Half Day') halfDayNonSundays++;
              }
            });
            
            const monthlySalary = Number(w.salary_amount || 0);
            const perDayAmount = monthlySalary / daysInMonth;
            
            const deductions = (absentNonSundays * perDayAmount) + (halfDayNonSundays * 0.5 * perDayAmount);
            let netPayable = monthlySalary - deductions;
            if (netPayable < 0) netPayable = 0;
            
            return {
              ...w,
              monthlyBase: monthlySalary,
              daysInMonth,
              absentDays: absentNonSundays,
              halfDays: halfDayNonSundays,
              perDayAmount,
              deductions,
              netPayable: Math.round(netPayable * 100) / 100
            };
          });
          
          return summary;
        }

        case 'workers:approveMonthlySalary': {
          const [approvals, nextMonthDateStr, monthName] = args;
          // approvals = [{ worker_id, company_id, amount, description }, ...]
          
          const inserts = approvals.map(app => ({
            company_id: app.company_id,
            worker_id: app.worker_id,
            date: nextMonthDateStr, // usually 1st of next month
            amount: app.amount,
            type: 'Credit', // Credit because they EARNED it (increases our liability/their balance)
            description: app.description || `Salary Credit for ${monthName}`,
            source_type: 'monthly_salary'
          }));
          
          if (inserts.length > 0) {
            const { error } = await supabase.from('worker_ledger').insert(inserts);
            if (error) throw error;
          }
          return true;
        }

        // =================== WORKER ATTENDANCE ===================
        case 'attendance:getByDate': {
          const [date] = args
          const { data, error } = await withCompany(supabase.from('worker_attendance').select('*, workers(name, salary_type, salary_amount)')).eq('date', date)
          if (error) throw error
          return data
        }
        case 'attendance:getByMonth': {
          const [year, month] = args; // month is 1-12
          const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
          const endDate = new Date(year, month, 0).toISOString().split('T')[0]; // Last day of month
          
          const { data, error } = await withCompany(
             supabase.from('worker_attendance').select('*, workers(name, salary_type, salary_amount)')
                     .gte('date', startDate)
                     .lte('date', endDate)
          )
          if (error) throw error
          return data
        }
        case 'attendance:mark': {
          const [attendanceData] = args
          // using upsert to handle updates if already exists for that date
          const { data, error } = await supabase.from('worker_attendance').upsert(injectCompany(attendanceData), { onConflict: 'worker_id, date' }).select().single()
          if (error) throw error
          return data
        }
        case 'attendance:approve': {
          const [date] = args
          
          // 1. Get all unapproved attendance for this date
          let query = supabase.from('worker_attendance').select('*, workers(*)').eq('date', date).eq('approved', false)
          const { data: records, error: fetchErr } = await withCompany(query)
          if (fetchErr) throw fetchErr
          
          if (!records || records.length === 0) return { success: true, count: 0 }
          
          const ledgerEntries = []
          const recordIds = []
          
          for (const rec of records) {
            recordIds.push(rec.id)
            if (rec.workers.salary_type === 'Daily' && (rec.status === 'Present' || rec.status === 'Half Day')) {
               const amount = rec.status === 'Present' ? rec.workers.salary_amount : (rec.workers.salary_amount / 2)
               ledgerEntries.push(injectCompany({
                 worker_id: rec.worker_id,
                 date: rec.date,
                 type: 'Credit',
                 amount: amount,
                 description: `Salary for ${rec.status} on ${rec.date}`
               }))
            }
          }
          
          if (ledgerEntries.length > 0) {
            const { error: ledgerErr } = await supabase.from('worker_ledger').insert(ledgerEntries)
            if (ledgerErr) throw ledgerErr
          }
          
          const { error: updateErr } = await supabase.from('worker_attendance').update({ approved: true }).in('id', recordIds)
          if (updateErr) throw updateErr
          return { success: true, count: records.length }
        }
        case 'attendance:unapprove': {
          const [date] = args
          
          // 1. Delete automatic ledger entries for this date
          // The description we used was: `Salary for ${rec.status} on ${rec.date}`
          // We can delete all Credits on this date where description starts with "Salary for"
          const { error: ledgerErr } = await withCompany(
            supabase.from('worker_ledger')
                    .delete()
                    .eq('date', date)
                    .eq('type', 'Credit')
                    .like('description', 'Salary for%')
          )
          if (ledgerErr) throw ledgerErr
          
          // 2. Set all attendance for this date back to approved: false
          const { error: updateErr } = await withCompany(
            supabase.from('worker_attendance')
                    .update({ approved: false })
                    .eq('date', date)
          )
          if (updateErr) throw updateErr
          
          return { success: true }
        }

        // =================== WORKER LEDGER ===================
        case 'workerLedger:getByWorker': {
          const [workerId] = args
          const { data, error } = await supabase.from('worker_ledger').select('*').eq('worker_id', workerId).order('date', { ascending: false })
          if (error) throw error
          return data
        }
        case 'workerLedger:update': {
          const [id, updates] = args;
          // Fetch existing entry to check source_type
          const { data: existing, error: fetchErr } = await supabase.from('worker_ledger').select('*').eq('id', id).single();
          if (fetchErr) throw fetchErr;

          const { data, error } = await withCompany(supabase.from('worker_ledger').update(updates).eq('id', id).select());
          if (error) throw error;

          // Propagate edit to source if applicable
          if (existing.source_type === 'payment' && existing.source_id) {
            await supabase.from('payments').update({
              amount: updates.amount,
              date: updates.date,
              remarks: updates.description ? updates.description.replace('Receipt Ref: ', '') : undefined
            }).eq('id', existing.source_id);
          } else if (existing.source_type === 'expense' && existing.source_id) {
            await supabase.from('expenses').update({
              amount: updates.amount,
              date: updates.date,
              description: updates.description
            }).eq('id', existing.source_id);
          }

          return data;
        }
        case 'workerLedger:delete': {
          const [id] = args;
          const { data: existing, error: fetchErr } = await supabase.from('worker_ledger').select('*').eq('id', id).single();
          if (fetchErr) throw fetchErr;

          const { error } = await withCompany(supabase.from('worker_ledger').delete().eq('id', id));
          if (error) throw error;

          // Propagate delete to source if applicable
          if (existing.source_type === 'payment' && existing.source_id) {
            await supabase.from('payments').delete().eq('id', existing.source_id);
          } else if (existing.source_type === 'expense' && existing.source_id) {
            await supabase.from('expenses').delete().eq('id', existing.source_id);
          }

          return true;
        }
        case 'workerLedger:syncAll': {
          // This backfills missing worker_ledger entries from payments/expenses
          const { data: linkedWorkers } = await withCompany(supabase.from('workers').select('id, company_id, party_id').not('party_id', 'is', null));
          if (!linkedWorkers || linkedWorkers.length === 0) return 0;
          
          let syncedCount = 0;
          for (const w of linkedWorkers) {
             const { data: existingLedgers } = await supabase.from('worker_ledger').select('source_type, source_id').eq('worker_id', w.id);
             
             // Sync missing Payments
             const paymentIds = new Set(existingLedgers.filter(l => l.source_type === 'payment').map(l => l.source_id));
             const { data: payments } = await supabase.from('payments').select('*').eq('party_id', w.party_id);
             const paymentsToInsert = (payments || []).filter(p => !paymentIds.has(p.id)).map(p => ({
                company_id: w.company_id,
                worker_id: w.id,
                date: p.date,
                amount: p.amount,
                type: p.payment_type === 'Payment from Party' ? 'Credit' : 'Debit',
                description: `Receipt Ref: ${p.mode} ${p.remarks ? '- ' + p.remarks : ''}`.trim(),
                source_type: 'payment',
                source_id: p.id
             }));

             if (paymentsToInsert.length > 0) {
               await supabase.from('worker_ledger').insert(paymentsToInsert);
               syncedCount += paymentsToInsert.length;
             }

             // Sync missing Expenses (Advance / Bad Debt)
             const expenseIds = new Set(existingLedgers.filter(l => l.source_type === 'expense').map(l => l.source_id));
             const { data: expenses } = await supabase.from('expenses').select('*, expense_types(name)').eq('party_id', w.party_id);
             const expensesToInsert = (expenses || [])
                .filter(e => !expenseIds.has(e.id) && (e.expense_types?.name === 'Advance to Party' || e.expense_types?.name === 'Bad Debt'))
                .map(e => ({
                   company_id: w.company_id,
                   worker_id: w.id,
                   date: e.date,
                   amount: e.amount,
                   type: 'Debit',
                   description: e.description || e.expense_types?.name,
                   source_type: 'expense',
                   source_id: e.id
                }));

             if (expensesToInsert.length > 0) {
               await supabase.from('worker_ledger').insert(expensesToInsert);
               syncedCount += expensesToInsert.length;
             }
          }
          return syncedCount;
        }

        default:
          console.warn('Unknown IPC channel invoked via API layer:', channel)
          return null
      }
    } catch (e) {
      console.error('API Error:', e)
      throw e
    }
  }
}
