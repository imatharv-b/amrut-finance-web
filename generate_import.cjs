const xlsx = require('xlsx');
const fs = require('fs');
const path = require('path');

// Paths to the excel files
const partyListPath = 'C:/Users/ogath/Desktop/ABC Finance Software/PARTY LIST feb 2026.xlsx';
const outstandingPath = 'C:/Users/ogath/Desktop/ABC Finance Software/outstanding amount.xlsx';
const outputSqlPath = 'C:/Users/ogath/.gemini/antigravity/brain/fae79d69-d05f-4911-af05-4ccb9f2ad625/artifacts/parties_import.sql';

// Read Party List
const wb1 = xlsx.readFile(partyListPath);
const sheet1 = wb1.Sheets[wb1.SheetNames[0]];
const partiesData = xlsx.utils.sheet_to_json(sheet1, { defval: '' });

// Read Outstanding Amount
const wb2 = xlsx.readFile(outstandingPath);
const sheet2 = wb2.Sheets[wb2.SheetNames[0]];
const outstandingData = xlsx.utils.sheet_to_json(sheet2, { defval: 0 });

// Map outstanding data by normalized account name
const outstandingMap = new Map();
outstandingData.forEach(row => {
  if (row['Account']) {
    const normName = row['Account'].toString().trim().toLowerCase();
    const balance = parseFloat(row['Balance']) || 0;
    outstandingMap.set(normName, balance);
  }
});

// Process parties and match with outstanding
const partiesToInsert = [];
const processedNames = new Set();

partiesData.forEach(row => {
  const name = row['Name'] ? row['Name'].toString().trim() : '';
  if (!name) return;
  
  const normName = name.toLowerCase();
  const mobile = row['Mobile No.'] ? row['Mobile No.'].toString().trim() : '';
  const gstin = row['GST NO'] ? row['GST NO'].toString().trim() : '';
  const grade = row['GRADE'] ? row['GRADE'].toString().trim() : 'B';
  
  // Find outstanding
  const balance = outstandingMap.get(normName) || 0;
  
  partiesToInsert.push({ name, mobile, gstin, grade, balance });
  processedNames.add(normName);
});

// Add any parties that were in outstanding but NOT in the party list
outstandingData.forEach(row => {
  if (row['Account']) {
    const name = row['Account'].toString().trim();
    const normName = name.toLowerCase();
    if (!processedNames.has(normName)) {
      const balance = parseFloat(row['Balance']) || 0;
      partiesToInsert.push({ name, mobile: '', gstin: '', grade: 'B', balance });
    }
  }
});

// Generate SQL
let sql = '-- Auto-generated script to import parties and outstanding balances\n\n';
sql += 'INSERT INTO parties (name, mobile, gstin, rating, opening_balance)\nVALUES\n';

const values = partiesToInsert.map(p => {
  const escapeSql = (str) => str.replace(/'/g, "''");
  return `  ('${escapeSql(p.name)}', '${escapeSql(p.mobile)}', '${escapeSql(p.gstin)}', '${escapeSql(p.grade)}', ${p.balance})`;
});

sql += values.join(',\n') + '\nON CONFLICT DO NOTHING;\n';

fs.writeFileSync(outputSqlPath, sql, 'utf8');
console.log(`Generated SQL script at ${outputSqlPath} with ${partiesToInsert.length} parties.`);
