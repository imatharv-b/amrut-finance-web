export const generateInvoiceHTML = (sale, items, settings) => {
  const isPakka = sale.sale_type === 'pakka';
  
  const subtotal = sale.total_amount + sale.discount - (isPakka ? ((sale.total_amount + sale.discount) * (sale.cgst_percent + sale.sgst_percent) / (100 + sale.cgst_percent + sale.sgst_percent)) : 0);
  const cgstAmount = isPakka ? (subtotal * sale.cgst_percent / 100) : 0;
  const sgstAmount = isPakka ? (subtotal * sale.sgst_percent / 100) : 0;
  const totalTax = cgstAmount + sgstAmount;
  const taxRate = (sale.cgst_percent || 0) + (sale.sgst_percent || 0);

  // Number to words converter
  const numberToWords = (num) => {
    const a = ['','One ','Two ','Three ','Four ', 'Five ','Six ','Seven ','Eight ','Nine ','Ten ','Eleven ','Twelve ','Thirteen ','Fourteen ','Fifteen ','Sixteen ','Seventeen ','Eighteen ','Nineteen '];
    const b = ['', '', 'Twenty','Thirty','Forty','Fifty', 'Sixty','Seventy','Eighty','Ninety'];
    if ((num = num.toString()).length > 9) return 'overflow';
    let n = ('000000000' + num).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
    if (!n) return; let str = '';
    str += (n[1] != 0) ? (a[Number(n[1])] || b[n[1][0]] + ' ' + a[n[1][1]]) + 'Crore ' : '';
    str += (n[2] != 0) ? (a[Number(n[2])] || b[n[2][0]] + ' ' + a[n[2][1]]) + 'Lakh ' : '';
    str += (n[3] != 0) ? (a[Number(n[3])] || b[n[3][0]] + ' ' + a[n[3][1]]) + 'Thousand ' : '';
    str += (n[4] != 0) ? (a[Number(n[4])] || b[n[4][0]] + ' ' + a[n[4][1]]) + 'Hundred ' : '';
    str += (n[5] != 0) ? ((str != '') ? 'and ' : '') + (a[Number(n[5])] || b[n[5][0]] + ' ' + a[n[5][1]]) + 'Only ' : 'Only';
    return str.trim();
  };
  
  const formatDate = (dateStr) => dateStr.split('-').reverse().join('-');
  const amountInWords = numberToWords(Math.round(sale.total_amount));

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Invoice ${sale.invoice_no}</title>
      <script src="https://cdn.tailwindcss.com"></script>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        body { 
          font-family: 'Inter', sans-serif; 
          -webkit-print-color-adjust: exact; 
          print-color-adjust: exact; 
        }
        @media print {
          @page { size: A5; margin: 10mm; }
          body { margin: 0; padding: 0; }
        }
      </style>
    </head>
    <body class="bg-white text-xs">
      <!-- Header -->
      <div class="flex justify-between items-center mb-4 border-b-2 border-indigo-100 pb-3">
        <div class="flex gap-3 items-center">
          <img src="LOCAL_LOGO_PLACEHOLDER" class="h-12 object-contain" onerror="this.style.display='none'" />
          <div>
            <h1 class="text-xl font-bold text-indigo-800 tracking-tight">AMRUT BIOCHEM</h1>
            <p class="text-slate-500 text-[10px] mt-0.5">${settings?.address || 'Maharashtra (27)'}</p>
            ${settings?.mobile ? `<p class="text-slate-500 text-[10px]">Mob: ${settings.mobile}</p>` : ''}
          </div>
        </div>
        <div class="text-right">
          <h2 class="text-lg font-bold text-indigo-600 mb-0.5">${isPakka ? 'TAX INVOICE' : 'PRO FORMA INVOICE'}</h2>
          <p class="text-slate-600 font-semibold"># ${sale.invoice_no}</p>
          <div class="flex justify-end gap-3 mt-1 text-[11px]">
            <p class="text-slate-500">Date: <span class="text-slate-800 font-medium">${formatDate(sale.date)}</span></p>
            <p class="text-slate-500">Mode: <span class="text-slate-800 font-medium">${sale.payment_mode || 'Cash'}</span></p>
          </div>
        </div>
      </div>

      <!-- Bill To Section -->
      <div class="mb-4 p-3 bg-indigo-50/50 rounded-lg border border-indigo-100 flex justify-between items-center">
        <div>
          <p class="text-[10px] text-indigo-600 font-bold mb-0.5 uppercase tracking-wider">Bill To</p>
          <h3 class="text-base font-bold text-slate-800">${sale.party_name}</h3>
        </div>
      </div>

      <!-- Items Table -->
      <div class="min-h-[160px]">
        <table class="w-full text-left text-xs whitespace-nowrap mb-4">
          <thead class="bg-indigo-600 text-white font-semibold">
            <tr>
              <th class="px-3 py-2 border-b border-indigo-700 rounded-tl-md">S.N.</th>
              <th class="px-3 py-2 border-b border-indigo-700 w-full">Item Description</th>
              <th class="px-3 py-2 border-b border-indigo-700 text-center">Qty</th>
              <th class="px-3 py-2 border-b border-indigo-700 text-center">Unit</th>
              <th class="px-3 py-2 border-b border-indigo-700 text-center">Dis(%)</th>
              <th class="px-3 py-2 border-b border-indigo-700 text-center">Dis Amt.</th>
              <th class="px-3 py-2 border-b border-indigo-700 text-right">Rate (₹)</th>
              <th class="px-3 py-2 border-b border-indigo-700 text-right rounded-tr-md">Amount (₹)</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 border-x border-b border-slate-200 rounded-b-md">
            ${items.map((item, i) => `
              <tr class="hover:bg-slate-50 transition-colors">
                <td class="px-3 py-2 text-slate-500">${i + 1}</td>
                <td class="px-3 py-2 font-medium text-slate-800">${item.product_name}</td>
                <td class="px-3 py-2 text-center text-slate-700">${item.qty}</td>
                <td class="px-3 py-2 text-center text-slate-500 text-[10px]">${item.unit}</td>
                <td class="px-3 py-2 text-center text-slate-500">0.00</td>
                <td class="px-3 py-2 text-center text-slate-500">0.00</td>
                <td class="px-3 py-2 text-right text-slate-700">${item.rate.toFixed(2)}</td>
                <td class="px-3 py-2 text-right font-semibold text-slate-800">${item.amount.toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <!-- Totals Section -->
      <div class="flex justify-between items-start gap-4">
        <div class="w-7/12">
          ${isPakka ? `
            <div class="mb-3">
              <table class="w-full text-[10px] text-left border border-slate-200 rounded-md overflow-hidden">
                <thead class="bg-slate-50 text-slate-600 border-b border-slate-200">
                  <tr>
                    <th class="px-2 py-1.5 font-semibold">Tax Rate</th>
                    <th class="px-2 py-1.5 font-semibold">Taxable</th>
                    <th class="px-2 py-1.5 font-semibold">CGST</th>
                    <th class="px-2 py-1.5 font-semibold">SGST</th>
                  </tr>
                </thead>
                <tbody class="text-slate-700 bg-white">
                  <tr>
                    <td class="px-2 py-1.5 font-medium">${taxRate}%</td>
                    <td class="px-2 py-1.5">₹${subtotal.toFixed(2)}</td>
                    <td class="px-2 py-1.5 text-indigo-600">₹${cgstAmount.toFixed(2)}</td>
                    <td class="px-2 py-1.5 text-indigo-600">₹${sgstAmount.toFixed(2)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          ` : ''}
        </div>

        <div class="w-5/12 min-w-[200px]">
          <div class="space-y-2 text-xs bg-slate-50 p-3 rounded-lg border border-slate-100">
            <div class="flex justify-between text-slate-600 font-medium">
              <span>Subtotal</span>
              <span>₹${subtotal.toFixed(2)}</span>
            </div>
            ${sale.discount > 0 ? `
              <div class="flex justify-between text-emerald-600 font-medium">
                <span>Discount</span>
                <span>- ₹${sale.discount.toFixed(2)}</span>
              </div>
            ` : ''}
            ${isPakka ? `
              <div class="flex justify-between text-slate-600 font-medium">
                <span>CGST</span>
                <span>+ ₹${cgstAmount.toFixed(2)}</span>
              </div>
              <div class="flex justify-between text-slate-600 font-medium pb-2 border-b border-slate-200">
                <span>SGST</span>
                <span>+ ₹${sgstAmount.toFixed(2)}</span>
              </div>
            ` : ''}
            <div class="flex justify-between items-center pt-1">
              <span class="text-sm font-bold text-slate-800">Grand Total</span>
              <span class="text-xl font-bold text-indigo-700">₹${sale.total_amount.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Footer Signatures -->
      <div class="mt-12 pt-4 border-t border-slate-200 flex justify-between text-slate-500 font-medium text-[11px]">
        <div class="text-center w-48">
          <div class="border-b border-slate-300 pb-8 mb-2"></div>
          Receiver's Signature
        </div>
        <div class="text-center w-48">
          <div class="border-b border-slate-300 pb-8 mb-2"></div>
          Authorised Signatory
        </div>
      </div>

      <script>
        // Any post-render logic
      </script>
    </body>
    </html>
  `;
};
