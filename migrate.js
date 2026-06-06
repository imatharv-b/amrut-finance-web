const Database = require('better-sqlite3');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const os = require('os');
require('dotenv').config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'YOUR_SUPABASE_PROJECT_URL_HERE';
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY_HERE'; // Use service_role key for migration ideally

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const dbPath = path.join(os.homedir(), 'AppData', 'Roaming', 'amrut-biochem-finance', 'amrut_biochem.db');
const db = new Database(dbPath);

async function migrateTable(tableName, orderBy = 'id') {
  console.log(`Migrating ${tableName}...`);
  const rows = db.prepare(`SELECT * FROM ${tableName} ORDER BY ${orderBy}`).all();
  if (rows.length === 0) {
    console.log(`No data in ${tableName}.`);
    return;
  }

  // Supabase inserts max 1000 rows at a time, but we chunk to 500 to be safe
  const chunkSize = 500;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await supabase.from(tableName).insert(chunk);
    if (error) {
      console.error(`Error migrating ${tableName}:`, error.message);
    } else {
      console.log(`Migrated ${chunk.length} rows to ${tableName}.`);
    }
  }
}

async function runMigration() {
  console.log('Starting migration from local SQLite to Supabase...');
  try {
    // Order matters for foreign keys!
    await migrateTable('seasons');
    await migrateTable('products');
    await migrateTable('batches');
    await migrateTable('parties');
    await migrateTable('sale_associates');
    await migrateTable('schemes');
    await migrateTable('scheme_coupons');
    await migrateTable('expense_types');
    await migrateTable('expenses');
    await migrateTable('payments');
    
    // Sales is tricky because of sale_items, but since we insert with existing IDs, it works fine
    await migrateTable('sales');
    await migrateTable('sale_items');
    
    await migrateTable('settings');
    
    console.log('Migration complete!');
  } catch (err) {
    console.error('Migration failed:', err);
  }
}

runMigration();
