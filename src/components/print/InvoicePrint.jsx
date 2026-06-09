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
          @page { margin: 10mm; size: auto; }
          body { margin: 0; padding: 20px; }
        }
      </style>
    </head>
    <body class="bg-white text-sm">
      <!-- Header -->
      <div class="flex justify-between items-start mb-8 border-b border-slate-200 pb-6">
        <div class="flex gap-4 items-center">
          <img src="LOCAL_LOGO_PLACEHOLDER" class="h-16 object-contain" onerror="this.style.display='none'" />
          <div>
            <h1 class="text-2xl font-bold text-slate-800">AMRUT BIOCHEM</h1>
            <p class="text-slate-500 text-sm mt-1">${settings?.address || 'Maharashtra (27)'}</p>
            ${settings?.mobile ? `<p class="text-slate-500 text-sm">Mob: ${settings.mobile}</p>` : ''}
          </div>
        </div>
        <div class="text-right">
          <h2 class="text-xl font-bold text-primary-600 mb-1">${isPakka ? 'TAX INVOICE' : 'PRO FORMA INVOICE'}</h2>
          <p class="text-slate-500 font-medium"># ${sale.invoice_no}</p>
          <p class="text-slate-500 mt-1">Date: <span class="text-slate-800 font-medium">${formatDate(sale.date)}</span></p>
          <p class="text-slate-500">Mode: <span class="text-slate-800 font-medium">${sale.payment_mode || 'Cash'}</span></p>
        </div>
      </div>

      <!-- Bill To Section -->
      <div class="mb-8 p-4 bg-slate-50 rounded-xl border border-slate-100 flex justify-between">
        <div>
          <p class="text-xs text-slate-500 font-semibold mb-1 uppercase tracking-wider">Bill To</p>
          <h3 class="text-lg font-bold text-slate-800">${sale.party_name}</h3>
        </div>
        <div class="text-right">
          <p class="text-xs text-slate-500 font-semibold mb-1 uppercase tracking-wider">Associate</p>
          <p class="text-slate-800 font-medium">${sale.associate_name || 'Direct'}</p>
        </div>
      </div>

      <!-- Items Table -->
      <table class="w-full text-left text-sm whitespace-nowrap mb-8">
        <thead class="bg-slate-50 text-slate-600 font-semibold">
          <tr>
            <th class="px-4 py-3 border-b border-slate-200 rounded-tl-lg">S.N.</th>
            <th class="px-4 py-3 border-b border-slate-200 w-full">Item Description</th>
            <th class="px-4 py-3 border-b border-slate-200 text-center">Qty</th>
            <th class="px-4 py-3 border-b border-slate-200 text-center">Unit</th>
            <th class="px-4 py-3 border-b border-slate-200 text-right">Rate (₹)</th>
            <th class="px-4 py-3 border-b border-slate-200 text-right rounded-tr-lg">Amount (₹)</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          ${items.map((item, i) => `
            <tr class="hover:bg-slate-50/50 transition-colors">
              <td class="px-4 py-3 text-slate-500">${i + 1}</td>
              <td class="px-4 py-3 font-medium text-slate-800">${item.product_name}</td>
              <td class="px-4 py-3 text-center text-slate-600">${item.qty}</td>
              <td class="px-4 py-3 text-center text-slate-500 text-xs">${item.unit}</td>
              <td class="px-4 py-3 text-right text-slate-600">${item.rate.toFixed(2)}</td>
              <td class="px-4 py-3 text-right font-medium text-slate-800">${item.amount.toFixed(2)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <!-- Totals Section -->
      <div class="flex justify-between items-end">
        <div class="w-1/2">
          ${isPakka ? `
            <div class="mb-6">
              <p class="text-xs text-slate-500 font-semibold mb-2 uppercase tracking-wider">Tax Summary</p>
              <table class="w-full text-xs text-left">
                <thead class="text-slate-500 border-b border-slate-200">
                  <tr>
                    <th class="pb-2 font-medium">Rate</th>
                    <th class="pb-2 font-medium">Taxable</th>
                    <th class="pb-2 font-medium">CGST</th>
                    <th class="pb-2 font-medium">SGST</th>
                  </tr>
                </thead>
                <tbody class="text-slate-700">
                  <tr>
                    <td class="py-2">${taxRate}%</td>
                    <td class="py-2">₹${subtotal.toFixed(2)}</td>
                    <td class="py-2">₹${cgstAmount.toFixed(2)}</td>
                    <td class="py-2">₹${sgstAmount.toFixed(2)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          ` : ''}
          <div class="bg-primary-50 p-4 rounded-xl inline-block mt-4">
            <p class="text-xs text-primary-600 font-semibold mb-1 uppercase tracking-wider">Amount in Words</p>
            <p class="text-primary-900 font-medium leading-relaxed">Rupees ${amountInWords}</p>
          </div>
        </div>

        <div class="w-1/3 min-w-[250px]">
          <div class="space-y-3 text-sm">
            <div class="flex justify-between text-slate-600">
              <span>Subtotal</span>
              <span>₹${subtotal.toFixed(2)}</span>
            </div>
            ${sale.discount > 0 ? `
              <div class="flex justify-between text-green-600">
                <span>Discount</span>
                <span>- ₹${sale.discount.toFixed(2)}</span>
              </div>
            ` : ''}
            ${isPakka ? `
              <div class="flex justify-between text-slate-600">
                <span>CGST</span>
                <span>+ ₹${cgstAmount.toFixed(2)}</span>
              </div>
              <div class="flex justify-between text-slate-600 pb-3 border-b border-slate-200">
                <span>SGST</span>
                <span>+ ₹${sgstAmount.toFixed(2)}</span>
              </div>
            ` : ''}
            <div class="flex justify-between items-center pt-2">
              <span class="text-base font-bold text-slate-800">Grand Total</span>
              <span class="text-2xl font-bold text-primary-600">₹${sale.total_amount.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Footer Signatures -->
      <div class="mt-24 pt-8 border-t border-slate-200 flex justify-between text-slate-500 font-medium">
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
