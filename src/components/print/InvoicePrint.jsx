export const generateInvoiceHTML = (sale, items, settings) => {
  const isPakka = sale.sale_type === 'pakka';
  
  const subtotal = sale.total_amount + sale.discount - (isPakka ? ((sale.total_amount + sale.discount) * (sale.cgst_percent + sale.sgst_percent) / (100 + sale.cgst_percent + sale.sgst_percent)) : 0);
  const cgstAmount = isPakka ? (subtotal * sale.cgst_percent / 100) : 0;
  const sgstAmount = isPakka ? (subtotal * sale.sgst_percent / 100) : 0;
  const totalTax = cgstAmount + sgstAmount;
  const taxRate = (sale.cgst_percent || 0) + (sale.sgst_percent || 0);

  // Number to words converter (simple version for rupees)
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
      <style>
        @page { size: A5 landscape; margin: 5mm; }
        html, body { 
          margin: 0; 
          padding: 0;
          font-family: 'Arial', sans-serif; 
          color: #000;
          font-size: 11px;
          background: white;
        }
        table.main-table {
          width: 100%;
          border-collapse: collapse;
          border: 1px solid #000;
        }
        table.main-table th, table.main-table td {
          border: 1px solid #000;
          padding: 3px 5px;
        }
        .no-border-table {
          width: 100%;
          border-collapse: collapse;
        }
        .no-border-table th, .no-border-table td {
          border: none !important;
          padding: 2px !important;
          text-align: right;
        }
        .no-border-table th {
          font-weight: bold;
        }
      </style>
    </head>
    <body>
      <table class="main-table">
        <tr>
          <td colspan="12" style="padding: 4px 8px; border-bottom: 2px solid #000;">
            <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 13px;">
              <span>AMRUT BIOCHEM - ${isPakka ? 'TAX INVOICE' : 'PRO FORMA'}</span>
              <span style="font-style: italic;">Original Copy</span>
            </div>
          </td>
        </tr>
        <tr>
          <td rowspan="${items.length + 1}" style="width: 12%; vertical-align: top;">
            Dated : ${formatDate(sale.date)}<br>
            Place of Supply :<br>Maharashtra (27)
          </td>
          <th style="width: 4%;">S.N.</th>
          <th style="width: 20%; text-align: left;">Goods / Services</th>
          <th style="width: 6%;">Qty.</th>
          <th style="width: 6%;">Unit</th>
          <th style="width: 6%;">Dis(%)</th>
          <th style="width: 7%;">Dis Amt.</th>
          <th style="width: 8%;">Price</th>
          <th style="width: 10%;">Amount(₹)</th>
          <td rowspan="${items.length + 1}" style="width: 10%; vertical-align: middle; text-align: center; font-weight: bold;">
            Grand<br>Total<br>₹
            <div style="border: 2px solid black; padding: 3px; margin-top: 5px; font-size: 12px;">${sale.total_amount.toFixed(2)}</div>
          </td>
          <td rowspan="${items.length + 1}" style="width: 25%; vertical-align: top;">
            <table class="no-border-table">
              <tr>
                <th style="text-align: left;">Tax<br>Rate</th>
                <th>Taxable<br>Amt.</th>
                <th>CGST<br>Amt.</th>
                <th>SGST<br>Amt.</th>
                <th>Total<br>Tax</th>
              </tr>
              <tr>
                <td style="text-align: left;">${isPakka ? taxRate : 0}%</td>
                <td>${subtotal.toFixed(2)}</td>
                <td>${cgstAmount.toFixed(2)}</td>
                <td>${sgstAmount.toFixed(2)}</td>
                <td>${totalTax.toFixed(2)}</td>
              </tr>
            </table>
            <div style="margin-top: 20px; font-weight: bold; font-size: 12px; line-height: 1.4;">
              Rupees ${amountInWords}
            </div>
          </td>
          <td rowspan="${items.length + 1}" style="width: 15%; vertical-align: top; text-align: center; font-weight: bold; font-style: italic;">
            Receiver's<br>Authorised<br>Signature Signatory
          </td>
        </tr>
        ${items.map((item, i) => `
        <tr style="text-align: center;">
          <td>${i + 1}</td>
          <td style="text-align: left;">${item.product_name}</td>
          <td>${item.qty}</td>
          <td>${item.unit}</td>
          <td>0.00</td>
          <td>0.00</td>
          <td>${item.rate.toFixed(2)}</td>
          <td>${item.amount.toFixed(2)}</td>
        </tr>
        `).join('')}
      </table>
      
      <!-- Empty space to match the screenshot bottom area -->
      <div style="min-height: 150px; border: 1px solid #000; border-top: none; width: 100%; box-sizing: border-box;"></div>
      
      <script>
        // Any post-render logic
      </script>
    </body>
    </html>
  `;
};
