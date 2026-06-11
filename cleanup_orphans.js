import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function cleanup() {
  console.log("Fetching all worker ledger entries with a related_expense_id...");
  const { data: ledgerEntries, error: ledgerError } = await supabase
    .from('worker_ledger')
    .select('id, related_expense_id')
    .not('related_expense_id', 'is', null);

  if (ledgerError) {
    console.error("Error fetching ledger entries:", ledgerError);
    return;
  }

  console.log(`Found ${ledgerEntries.length} ledger entries linked to expenses.`);

  if (ledgerEntries.length === 0) return;

  const expenseIds = ledgerEntries.map(e => e.related_expense_id);
  
  console.log("Fetching existing expenses...");
  const { data: expenses, error: expenseError } = await supabase
    .from('expenses')
    .select('id')
    .in('id', expenseIds);

  if (expenseError) {
    console.error("Error fetching expenses:", expenseError);
    return;
  }

  const existingExpenseIds = new Set(expenses.map(e => e.id));
  
  const orphanedLedgerIds = ledgerEntries
    .filter(e => !existingExpenseIds.has(e.related_expense_id))
    .map(e => e.id);

  console.log(`Found ${orphanedLedgerIds.length} orphaned ledger entries.`);

  if (orphanedLedgerIds.length > 0) {
    console.log("Deleting orphaned entries...");
    const { error: deleteError } = await supabase
      .from('worker_ledger')
      .delete()
      .in('id', orphanedLedgerIds);
      
    if (deleteError) {
      console.error("Error deleting orphaned entries:", deleteError);
    } else {
      console.log("Successfully deleted orphaned entries.");
    }
  }
}

cleanup();
