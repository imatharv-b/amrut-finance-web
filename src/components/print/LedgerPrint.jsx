import { formatDate } from '../../lib/dateUtils';

export const generateLedgerHTML = (ledgerData, settings) => {
  const currentBalance = ledgerData.entries.length > 0 
    ? ledgerData.entries[ledgerData.entries.length - 1].balance 
    : Number(ledgerData.openingBalanceForPeriod || 0);
  
  const currentBalanceText = currentBalance > 0 
    ? `₹${currentBalance.toFixed(2)} Dr` 
    : `₹${Math.abs(currentBalance).toFixed(2)} Cr`;
  const currentBalanceColor = currentBalance > 0 ? 'text-red-600' : 'text-green-600';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Ledger - ${ledgerData.party.name}</title>
      <script src="https://cdn.tailwindcss.com"></script>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        body { font-family: 'Inter', sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        @media print {
          @page { margin: 10mm; size: auto; }
          body { margin: 0; padding: 20px; }
        }
      </style>
    </head>
    <body class="bg-white text-sm">
      <div class="flex justify-between items-start mb-6 border-b border-slate-200 pb-4">
        <div>
          <h2 class="text-xl font-bold text-slate-800">${ledgerData.party.name}</h2>
          ${ledgerData.party.village ? `<p class="text-slate-600 text-sm">${[ledgerData.party.village, ledgerData.party.taluka, ledgerData.party.district].filter(Boolean).join(', ')}</p>` : ''}
          <p class="text-slate-500 text-xs mt-1">Mobile: ${ledgerData.party.mobile || '-'}</p>
        </div>
        <div class="text-right">
          <p class="text-xs text-slate-500 mb-1">Current Balance</p>
          <p class="text-2xl font-bold ${currentBalanceColor}">${currentBalanceText}</p>
        </div>
      </div>

      <table class="w-full text-left text-xs whitespace-nowrap">
        <thead class="bg-slate-50 text-slate-600 font-medium">
          <tr>
            <th class="px-4 py-3 border-b border-slate-200">Date</th>
            <th class="px-4 py-3 border-b border-slate-200">Type</th>
            <th class="px-4 py-3 border-b border-slate-200">Vch No.</th>
            <th class="px-4 py-3 border-b border-slate-200">Particulars</th>
            <th class="px-4 py-3 border-b border-slate-200 text-right">Debit (₹)</th>
            <th class="px-4 py-3 border-b border-slate-200 text-right">Credit (₹)</th>
            <th class="px-4 py-3 border-b border-slate-200 text-right">Balance (₹)</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          <tr class="bg-white font-medium">
            <td class="px-4 py-3 text-slate-500">-</td>
            <td class="px-4 py-3 text-slate-500">-</td>
            <td class="px-4 py-3 text-slate-500">-</td>
            <td class="px-4 py-3 text-slate-800">Opening Balance</td>
            <td class="px-4 py-3 text-right"></td>
            <td class="px-4 py-3 text-right"></td>
            <td class="px-4 py-3 text-right text-slate-800">
              ${Number(ledgerData.openingBalanceForPeriod || 0) > 0 
                ? `${Number(ledgerData.openingBalanceForPeriod || 0).toFixed(2)} Dr` 
                : Number(ledgerData.openingBalanceForPeriod || 0) < 0 
                  ? `${Math.abs(Number(ledgerData.openingBalanceForPeriod || 0)).toFixed(2)} Cr` 
                  : '0.00'}
            </td>
          </tr>
          ${ledgerData.entries.map(entry => `
            <tr class="bg-white align-top hover:bg-slate-50">
              <td class="px-4 py-3 whitespace-nowrap">${formatDate(entry.date)}</td>
              <td class="px-4 py-3 text-slate-500 whitespace-nowrap">
                ${entry.type === 'sale' ? 'Sale' : entry.type === 'payment' ? 'Rcpt' : entry.type === 'expense' ? 'Jrnl' : 'Return'}
              </td>
              <td class="px-4 py-3 text-slate-500 whitespace-nowrap">${entry.vch_no || entry.ref}</td>
              <td class="px-4 py-3 text-slate-700 min-w-[250px] whitespace-normal">
                <div class="font-semibold text-slate-800">${entry.particulars}</div>
                ${entry.narration ? `<div class="text-[10px] italic text-slate-500 mt-0.5">${entry.narration}</div>` : ''}
                ${entry.items && entry.items.length > 0 ? `
                  <div class="mt-2 ml-4 pl-3 border-l-2 border-slate-200 space-y-1 bg-slate-50/50 py-1.5 pr-2">
                    ${entry.items.map(item => `
                      <div class="flex text-[10px] text-slate-600 items-center justify-between">
                         <div class="w-1/3 italic truncate pr-2 font-medium">${item.name}</div>
                         <div class="w-1/6 text-right whitespace-nowrap">${Number(item.qty).toFixed(2)} <span class="text-[9px] text-slate-400">${item.unit}</span></div>
                         <div class="w-1/6 text-center whitespace-nowrap"><span class="text-[9px] text-slate-400">@</span> ${Number(item.rate).toFixed(2)}</div>
                         <div class="w-1/6 text-right whitespace-nowrap"><span class="text-[9px] text-slate-400">=</span> ${Number(item.amount).toFixed(2)}</div>
                      </div>
                    `).join('')}
                  </div>
                ` : ''}
              </td>
              <td class="px-4 py-3 text-right text-red-600 font-medium whitespace-nowrap">
                ${entry.debit > 0 ? entry.debit.toFixed(2) : ''}
              </td>
              <td class="px-4 py-3 text-right text-green-600 font-medium whitespace-nowrap">
                ${entry.credit > 0 ? entry.credit.toFixed(2) : ''}
              </td>
              <td class="px-4 py-3 text-right font-bold whitespace-nowrap">
                ${!isNaN(entry.balance) && entry.balance > 0 
                  ? `${entry.balance.toFixed(2)} Dr` 
                  : !isNaN(entry.balance) && entry.balance < 0 
                    ? `${Math.abs(entry.balance).toFixed(2)} Cr` 
                    : '0.00'}
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </body>
    </html>
  `;
};
