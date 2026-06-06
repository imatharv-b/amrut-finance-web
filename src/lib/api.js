import { supabase } from './supabase'

export const api = {
  invoke: async (channel, ...args) => {
    try {
      switch (channel) {
        // =================== SEASONS ===================
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
          const insertData = { ...data, name, start_date, end_date, is_active: false }
          const { data: result, error } = await supabase.from('seasons').insert(insertData).select().single()
          if (error) throw error
          return result
        }
        case 'seasons:setActive': {
          const [id] = args
          await supabase.from('seasons').update({ is_active: false }).neq('id', 0)
          const { data, error } = await supabase.from('seasons').update({ is_active: true }).eq('id', id)
          if (error) throw error
          return data
        }

        // =================== PARTIES ===================
        case 'parties:getAll': {
          const { data, error } = await supabase.from('parties_with_balance').select('*').order('name')
          if (error) throw error
          return data
        }
        case 'parties:add': {
          const [partyData] = args
          const { data, error } = await supabase.from('parties').insert(partyData).select().single()
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
          
          const { data: ledgerEntries, error } = await supabase.rpc('get_party_ledger', { p_id: partyId })
          if (error) throw error
          
          let allEntries = ledgerEntries.sort((a, b) => a.entry_date.localeCompare(b.entry_date))
          let runningBalance = party.opening_balance || 0
          let openingBalanceForPeriod = runningBalance
          let entries = []
          
          for (const e of allEntries) {
            if (fromDate && e.entry_date < fromDate) {
              runningBalance += (Number(e.debit) - Number(e.credit))
              openingBalanceForPeriod = runningBalance
            } else if ((!fromDate || e.entry_date >= fromDate) && (!toDate || e.entry_date <= toDate)) {
              runningBalance += (Number(e.debit) - Number(e.credit))
              entries.push({
                date: e.entry_date,
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
          const { data, error } = await supabase.from('sale_associates').select('*').order('name')
          if (error) throw error
          return data
        }
        case 'associates:add': {
          const [assocData] = args
          const { data, error } = await supabase.from('sale_associates').insert(assocData).select().single()
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
        case 'expenses:getAll': {
          const [filters] = args || [{}]
          let q = supabase.from('expenses').select('*, expense_types(name), parties(name)').order('date', { ascending: false })
          if (filters?.season_id) {
            // Note: Currently expenses don't have season_id in schema, skipping filter or join if needed
          }
          const { data, error } = await q
          if (error) throw error
          return data.map(d => ({...d, type_name: d.expense_types?.name, party_name: d.parties?.name}))
        }
        case 'expenses:add': {
          const [expData] = args
          const { data, error } = await supabase.from('expenses').insert(expData).select().single()
          if (error) throw error
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
          const { data, error } = await supabase.from('payments').select('*, parties(name)').order('date', { ascending: false })
          if (error) throw error
          return data.map(d => ({...d, party_name: d.parties?.name}))
        }
        case 'payments:add': {
          const [paymentData] = args
          const { data, error } = await supabase.from('payments').insert(paymentData).select().single()
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
          let q = supabase.from('sales_with_details').select('*').order('date', { ascending: false }).order('id', { ascending: false })
          if (filters?.season_id) q = q.eq('season_id', filters.season_id)
          const { data, error } = await q
          if (error) throw error
          return data
        }
        case 'sales:getNextInvoice': {
          // This is a naive implementation. For production, a sequence or transaction is better.
          const { data } = await supabase.from('sales').select('invoice_no').order('id', { ascending: false }).limit(1)
          if (!data || data.length === 0) return 'INV-001'
          const num = parseInt(data[0].invoice_no.replace('INV-', '')) + 1
          return `INV-${String(num).padStart(3, '0')}`
        }
        case 'sales:add': {
          const [saleData] = args
          // Supabase doesn't easily do nested inserts with relationships in the client unless structured perfectly.
          // We'll do it sequentially for simplicity.
          const { items, ...rest } = saleData
          const { data: sale, error } = await supabase.from('sales').insert(rest).select().single()
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
          let q = supabase.from('sale_returns')
            .select('*, parties(name), sales(invoice_no)')
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
          const { data } = await supabase.from('sale_returns').select('return_no').order('id', { ascending: false }).limit(1)
          if (!data || data.length === 0) return 'RET-001'
          const num = parseInt(data[0].return_no.replace('RET-', '')) + 1
          return `RET-${String(num).padStart(3, '0')}`
        }
        case 'saleReturns:add': {
          const [returnData] = args
          const { items, ...rest } = returnData
          const { data: saleReturn, error } = await supabase.from('sale_returns').insert(rest).select().single()
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
          let q = supabase.from('schemes').select('*').order('name')
          if (seasonId) q = q.eq('season_id', seasonId)
          const { data, error } = await q
          if (error) throw error
          return data
        }
        case 'schemes:add': {
          const [schemeData] = args
          const { data, error } = await supabase.from('schemes').insert(schemeData).select().single()
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
          let q = supabase.from('scheme_coupons').select('*, schemes(name, season_id), parties(name)').order('issue_date', { ascending: false })
          const { data, error } = await q
          if (error) throw error
          // Filter by season
          const filtered = seasonId ? data.filter(d => d.schemes?.season_id === seasonId) : data
          return filtered.map(d => ({...d, scheme_name: d.schemes?.name, party_name: d.parties?.name}))
        }
        case 'coupons:add': {
          const [couponData] = args
          const { data, error } = await supabase.from('scheme_coupons').insert(couponData).select().single()
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
          const { data: salesData } = await supabase.from('sales').select('total_amount').eq('season_id', seasonId)
          const { data: expData } = await supabase.from('expenses').select('amount')
          const totalSales = salesData?.reduce((sum, s) => sum + Number(s.total_amount), 0) || 0
          const totalExpenses = expData?.reduce((sum, e) => sum + Number(e.amount), 0) || 0
          return { totalSales, totalExpenses }
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
