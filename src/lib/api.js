import { supabase } from './supabase'

export let globalCompanyId = null;
export const setGlobalCompanyId = (id) => {
  globalCompanyId = id;
};

// Helper to filter by company (for per-company tables)
const withCompany = (query) => globalCompanyId ? query.eq('company_id', globalCompanyId) : query;
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
          
          // Fetch balances from the view and map them
          const { data: viewParties } = await withCompany(supabase.from('parties_with_balance').select('id, balance'))
          const balanceMap = {}
          if (viewParties) {
             viewParties.forEach(vp => { balanceMap[vp.id] = Number(vp.balance || 0); })
          }
          
          allParties.forEach(p => {
             p.balance = balanceMap[p.id] !== undefined ? balanceMap[p.id] : Number(p.opening_balance || 0);
          })

          const data = allParties;
          
          // Merge worker_ledger balances for workers
          const { data: workers } = await supabase.from('workers').select('id, party_id')
          if (workers && workers.length > 0) {
            const { data: workerLedgers } = await supabase.from('worker_ledger').select('worker_id, type, amount')
            if (workerLedgers) {
              const workerBalances = {}
              for (const w of workers) {
                if (!w.party_id) continue;
                let bal = 0;
                const wl = workerLedgers.filter(l => l.worker_id === w.id);
                wl.forEach(l => {
                  if (l.type === 'Debit') bal += Number(l.amount);
                  if (l.type === 'Credit') bal -= Number(l.amount);
                });
                workerBalances[w.party_id] = bal;
              }
              data.forEach(p => {
                if (workerBalances[p.id] !== undefined) {
                  p.balance = Number(p.balance || 0) + workerBalances[p.id];
                }
              });
            }
          }
          
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
          
          const [salesRes, paymentsRes, expensesRes, returnsRes] = await Promise.all([
            supabase.from('sales').select('*, sale_items(*, products(name))').eq('party_id', partyId),
            supabase.from('payments').select('*').eq('party_id', partyId),
            supabase.from('expenses').select('*, expense_types(name)').eq('party_id', partyId),
            supabase.from('sale_returns').select('*, sale_return_items(*, products(name))').eq('party_id', partyId)
          ]);
          
          let rawEntries = [];

          salesRes.data?.forEach(s => {
             rawEntries.push({
                entry_date: s.date,
                ref: s.invoice_no + (s.coupon_no ? ` (Coupon: ${s.coupon_no})` : ''),
                vch_no: s.invoice_no,
                debit: Number(s.total_amount),
                credit: 0,
                entry_type: 'sale',
                particulars: 'Cr Sales',
                narration: s.remarks || '',
                items: s.sale_items?.map(i => ({ name: i.products?.name, qty: i.qty, unit: i.unit, rate: i.rate, amount: i.amount })) || []
             });
          });

          paymentsRes.data?.forEach(p => {
             rawEntries.push({
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

          returnsRes.data?.forEach(r => {
             rawEntries.push({
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
                type: e.entry_type
              })
            }
          }
          return { party, entries, openingBalanceForPeriod }
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
          const { error } = await supabase.from('expenses').delete().eq('id', id)
          if (error) throw error
          return true
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
          return data
        }
        case 'payments:update': {
          const [paymentData] = args
          const { data, error } = await supabase.from('payments').update(paymentData).eq('id', paymentData.id)
          if (error) throw error
          return data
        }
        case 'payments:delete': {
          const [id] = args
          const { error } = await supabase.from('payments').delete().eq('id', id)
          if (error) throw error
          return true
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
          // Supabase doesn't easily do nested inserts with relationships in the client unless structured perfectly.
          // We'll do it sequentially for simplicity.
          const { items, ...rest } = saleData
          const { data: sale, error } = await supabase.from('sales').insert(injectCompany(rest)).select().single()
          if (error) throw error
          if (items && items.length > 0) {
            const itemsToInsert = items.map(i => ({ ...i, sale_id: sale.id }))
            await supabase.from('sale_items').insert(itemsToInsert)
          }
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
          return true
        }
        case 'sales:delete': {
          const [id] = args
          await supabase.from('sales').delete().eq('id', id)
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
            const itemsToInsert = items.map(i => ({ ...i, sale_return_id: saleReturn.id }))
            await supabase.from('sale_return_items').insert(itemsToInsert)
          }
          return { id: saleReturn.id, return_no: saleReturn.return_no }
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
          
          const { data: salesData } = await withCompany(supabase.from('sales').select('*, parties(name)')).eq('season_id', seasonId)
          
          let expQuery = withCompany(supabase.from('expenses').select('*, expense_types(name)'))
          if (seasonData) {
            expQuery = expQuery.gte('date', seasonData.start_date).lte('date', seasonData.end_date)
          }
          const { data: expData } = await expQuery
          
          const { data: allCoupons } = await withCompany(supabase.from('scheme_coupons').select('*, schemes(season_id), parties(name)'))
          const couponsData = allCoupons?.filter(c => c.schemes?.season_id === seasonId) || []
          
          // For outstanding, we need all parties, all sales (all time), all payments, all returns
          const { data: partiesData } = await withCompany(supabase.from('parties').select('id, name, opening_balance'))
          const { data: allSales } = await withCompany(supabase.from('sales').select('total_amount, party_id'))
          const { data: allPayments } = await withCompany(supabase.from('payments').select('amount, party_id, date, parties(name)'))
          const { data: allReturns } = await withCompany(supabase.from('sale_returns').select('total_amount, party_id'))

          const totalSales = salesData?.reduce((sum, s) => sum + Number(s.total_amount || 0), 0) || 0
          const totalExpenses = expData?.reduce((sum, e) => sum + Number(e.amount || 0), 0) || 0
          const netBalance = totalSales - totalExpenses
          const couponsIssued = couponsData.length
          
          let seasonPayments = allPayments || []
          if (seasonData) {
             seasonPayments = seasonPayments.filter(p => {
               const pDate = p.date ? p.date.substring(0, 10) : ''
               return pDate >= seasonData.start_date && pDate <= seasonData.end_date
             })
          }
          const totalReceipts = seasonPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0)

          const partyReceiptsMap = {}
          seasonPayments.forEach(p => {
             const pName = p.parties?.name || 'Unknown'
             if(!partyReceiptsMap[pName]) partyReceiptsMap[pName] = 0
             partyReceiptsMap[pName] += Number(p.amount || 0)
          })
          const receiptsList = Object.entries(partyReceiptsMap).map(([name, total]) => ({name, total})).sort((a,b) => b.total - a.total)

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
          const expenseBreakdown = Object.entries(expBreakdownMap).map(([name, total]) => ({name, total})).sort((a,b) => b.total - a.total)

          const partySalesMap = {}
          salesData?.forEach(s => {
             const pName = s.parties?.name || 'Unknown'
             if(!partySalesMap[pName]) partySalesMap[pName] = 0
             partySalesMap[pName] += Number(s.total_amount || 0)
          })
          const salesList = Object.entries(partySalesMap).map(([name, total]) => ({name, total})).sort((a,b) => b.total - a.total)
          const topParties = salesList.slice(0, 5)

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
            couponsList: couponsData
          }
        }
        case 'settings:get': {
          const { data } = await supabase.from('settings').select('*')
          const s = {}
          data?.forEach(d => { s[d.key] = d.value })
          return s
        }
        case 'settings:update': {
          const [settingsObj] = args
          for (const [key, value] of Object.entries(settingsObj)) {
            await supabase.from('settings').upsert({ key, value })
          }
          return true
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
            supabase.from('sales').select('total_amount, party_id')
          )
          if (err4) throw err4

          const { data: paymentsForParties, error: err5 } = await withCompany(
            supabase.from('payments').select('amount, party_id')
          )
          if (err5) throw err5

          const { data: returnsForParties, error: err6 } = await withCompany(
            supabase.from('sale_returns').select('total_amount, party_id')
          )
          if (err6) throw err6

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
          const partyRisks = []
          parties?.forEach(p => {
             let bal = Number(p.opening_balance || 0)
             const pSales = salesForParties?.filter(s => s.party_id === p.id) || []
             bal += pSales.reduce((sum, s) => sum + Number(s.total_amount || 0), 0)
             const pPayments = paymentsForParties?.filter(pay => pay.party_id === p.id) || []
             bal -= pPayments.reduce((sum, pay) => sum + Number(pay.amount || 0), 0)
             const pReturns = returnsForParties?.filter(r => r.party_id === p.id) || []
             bal -= pReturns.reduce((sum, r) => sum + Number(r.total_amount || 0), 0)
             
             // Advances & Bad Debts
             const pExp = expenses?.filter(e => e.party_id === p.id) || []
             pExp.forEach(e => {
               if (e.expense_types?.name === 'Advance to Party') bal += Number(e.amount || 0)
               if (e.expense_types?.name === 'Bad Debt') bal -= Number(e.amount || 0)
             })

             if (bal > 0) {
                // Find last payment date if any
                const latestPay = pPayments.sort((a,b) => new Date(b.date || 0) - new Date(a.date || 0))[0]
                partyRisks.push({
                   id: p.id,
                   name: p.name,
                   outstanding: bal,
                   lastPaymentDate: latestPay ? latestPay.date : null
                })
             }
          })
          const topRisks = partyRisks.sort((a,b) => b.outstanding - a.outstanding).slice(0, 15)

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
          const [workerData] = args
          const { data, error } = await supabase.from('workers').update(workerData).eq('id', workerData.id).select().single()
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
          return true
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
