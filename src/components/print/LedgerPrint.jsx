export const generateLedgerHTML = (ledgerData, settings) => {
  const { party, entries } = ledgerData;
  const currentBalance = entries.length > 0 
    ? entries[entries.length - 1].balance 
    : ledgerData.opening_balance;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Ledger - ${party.name}</title>
      <style>
        body { font-family: 'Arial', sans-serif; padding: 40px; color: #333; }
        .header { text-align: center; border-bottom: 2px solid #1a4731; padding-bottom: 20px; margin-bottom: 30px; }
        .firm-name { font-size: 28px; font-weight: bold; color: #1a4731; margin: 0; }
        .firm-details { font-size: 14px; color: #666; margin-top: 5px; }
        .report-title { font-size: 20px; font-weight: bold; text-align: center; margin-bottom: 20px; text-transform: uppercase; }
        
        .party-info { margin-bottom: 30px; border: 1px solid #ddd; padding: 15px; border-radius: 5px; display: flex; justify-content: space-between; }
        .party-info h3 { margin-top: 0; margin-bottom: 10px; font-size: 18px; color: #1a4731; }
        .party-info p { margin: 5px 0; font-size: 14px; }
        
        .balance-box { text-align: right; }
        .balance-amount { font-size: 24px; font-weight: bold; margin-top: 5px; }
        .dr { color: #dc2626; }
        .cr { color: #16a34a; }
        
        table { width: 100%; border-collapse: collapse; margin-bottom: 30px; font-size: 13px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f9f9f9; color: #1a4731; font-weight: bold; }
        .text-right { text-align: right; }
        .text-center { text-align: center; }
        
        .footer { margin-top: 40px; text-align: center; font-size: 12px; color: #888; border-top: 1px solid #ddd; padding-top: 10px; }
      </style>
    </head>
    <body>
      <div class="header" style="position: relative;">
        <img src="/logo.png" style="position: absolute; left: 0; top: 0; max-height: 80px; object-fit: contain;" onerror="this.style.display='none'" />
        <h1 class="firm-name">${settings.firm_name || 'Amrut Biochem'}</h1>
        <div class="firm-details">
          ${settings.address ? `<p>${settings.address}</p>` : ''}
          <p>Mob: ${settings.mobile || '-'}</p>
        </div>
      </div>
      
      <div class="report-title">Statement of Account (Ledger)</div>
      
      <div class="party-info">
        <div>
          <h3>${party.name}</h3>
          <p>${[party.village, party.taluka, party.district].filter(Boolean).join(', ')}</p>
          <p>Mob: ${party.mobile || '-'}</p>
        </div>
        <div class="balance-box">
          <p>Current Balance:</p>
          <div class="balance-amount ${currentBalance > 0 ? 'dr' : 'cr'}">
            ${currentBalance > 0 ? `₹${currentBalance.toFixed(2)} Dr` : currentBalance < 0 ? `₹${Math.abs(currentBalance).toFixed(2)} Cr` : '₹0.00'}
          </div>
        </div>
      </div>
      
      <table>
        <thead>
          <tr>
            <th style="width: 80px;">Date</th>
            <th style="width: 50px;">Type</th>
            <th style="width: 80px;">Vch No.</th>
            <th>Particulars</th>
            <th class="text-right" style="width: 80px;">Debit (₹)</th>
            <th class="text-right" style="width: 80px;">Credit (₹)</th>
            <th class="text-right" style="width: 90px;">Balance (₹)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td></td>
            <td></td>
            <td></td>
            <td><strong>Opening Balance</strong></td>
            <td></td>
            <td></td>
            <td class="text-right"><strong>${Number(ledgerData.openingBalanceForPeriod || 0) > 0 ? `${Number(ledgerData.openingBalanceForPeriod || 0).toFixed(2)} Dr` : Number(ledgerData.openingBalanceForPeriod || 0) < 0 ? `${Math.abs(Number(ledgerData.openingBalanceForPeriod || 0)).toFixed(2)} Cr` : '0.00'}</strong></td>
          </tr>
          ${entries.map(entry => `
            <tr>
              <td style="vertical-align: top;">${entry.date}</td>
              <td style="vertical-align: top;">${entry.type === 'sale' ? 'Sale' : entry.type === 'payment' ? 'Rcpt' : entry.type === 'expense' ? 'Jrnl' : 'Return'}</td>
              <td style="vertical-align: top;">${entry.vch_no || entry.ref}</td>
              <td style="vertical-align: top;">
                <div>${entry.particulars}</div>
                ${entry.narration ? `<div style="font-style: italic; color: #555; margin-top: 2px;">${entry.narration}</div>` : ''}
                ${entry.items && entry.items.length > 0 ? `
                  <div style="margin-top: 5px; padding-left: 15px;">
                    ${entry.items.map(item => `
                      <div style="display: flex; font-size: 11px; margin-bottom: 2px; font-style: italic;">
                        <div style="width: 180px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${item.name}</div>
                        <div style="width: 80px; text-align: right;">${Number(item.qty).toFixed(2)} ${item.unit}</div>
                        <div style="width: 70px; text-align: center;">@ ${Number(item.rate).toFixed(2)}</div>
                        <div style="width: 80px; text-align: right;">= ${Number(item.amount).toFixed(2)}</div>
                      </div>
                    `).join('')}
                  </div>
                ` : ''}
              </td>
              <td class="text-right dr" style="vertical-align: top;">${entry.debit > 0 ? entry.debit.toFixed(2) : ''}</td>
              <td class="text-right cr" style="vertical-align: top;">${entry.credit > 0 ? entry.credit.toFixed(2) : ''}</td>
              <td class="text-right" style="vertical-align: top;">
                ${entry.balance > 0 ? `${entry.balance.toFixed(2)} Dr` : entry.balance < 0 ? `${Math.abs(entry.balance).toFixed(2)} Cr` : '0.00'}
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      
      <div class="footer">
        <p>This is a computer-generated document. No signature is required.</p>
        <p>Generated on: ${new Date().toLocaleString()}</p>
      </div>
    </body>
    </html>
  `;
};
