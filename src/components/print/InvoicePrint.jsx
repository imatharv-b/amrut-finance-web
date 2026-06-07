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
          font-size: 13px;
          background: white;
        }
        
        .invoice-wrapper {
          width: 100%;
          box-sizing: border-box;
          border: 1px solid #000;
          display: flex;
          flex-direction: column;
          min-height: 95vh;
        }
        
        .top-labels {
          display: flex;
          justify-content: space-between;
          padding: 4px 12px;
          font-weight: bold;
          font-size: 14px;
          border-bottom: 1px solid #000;
        }
        
        .header-row {
          display: flex;
          border-bottom: 1px solid #000;
        }
        
        .company-details {
          flex: 1.5;
          padding: 5px 10px;
          border-right: 1px solid #000;
          text-align: center;
        }
        
        .company-details img {
          max-width: 100%;
          max-height: 55px;
          margin-bottom: 2px;
          object-fit: contain;
        }
        
        .company-details p {
          margin: 0;
          font-size: 10px;
        }
        
        .billing-details {
          flex: 1;
          padding: 5px 10px;
          font-size: 11px;
        }
        
        .billing-details p {
          margin: 1px 0;
        }
        
        .meta-row {
          display: flex;
          border-bottom: 1px solid #000;
          padding: 6px 12px;
          font-weight: bold;
          justify-content: space-between;
        }
        
        .table-container {
          flex-grow: 1;
        }
        
        table.items-table {
          width: 100%;
          border-collapse: collapse;
          height: 100%;
        }
        
        table.items-table th, table.items-table td {
          border-right: 1px solid #000;
          border-bottom: 1px solid #000;
          padding: 6px 8px;
        }
        
        table.items-table th:last-child, table.items-table td:last-child {
          border-right: none;
        }
        
        table.items-table th {
          text-align: center;
          font-weight: normal;
          background-color: #f9f9f9;
        }
        
        .text-center { text-align: center; }
        .text-right { text-align: right; }
        .text-left { text-align: left; }
        
        .grand-total-row {
          display: flex;
          justify-content: flex-end;
          align-items: center;
          border-bottom: 1px solid #000;
          padding: 6px 12px;
          font-weight: bold;
          font-size: 14px;
        }
        
        .grand-total-box {
          border: 1px solid #000;
          padding: 4px 12px;
          margin-left: 10px;
        }
        
        .tax-info-row {
          padding: 6px 12px;
          border-bottom: 1px solid #000;
        }
        
        table.tax-table {
          border-collapse: collapse;
          margin-bottom: 6px;
          text-align: right;
        }
        
        table.tax-table th, table.tax-table td {
          padding: 4px 10px;
          font-weight: bold;
          border-bottom: 1px solid #000;
        }
        
        table.tax-table th { border-bottom: 1px solid #000; }
        table.tax-table td { border-bottom: none; }
        
        .amount-words {
          font-weight: bold;
          font-size: 14px;
          padding-top: 6px;
        }
        
        .footer-row {
          display: flex;
          justify-content: space-between;
          padding: 15px 15px 5px 15px;
          font-style: italic;
          font-weight: bold;
        }
      </style>
    </head>
    <body>
      <div class="invoice-wrapper">
        <div class="top-labels">
          <div>AMRUT BIOCHEM - ${isPakka ? 'TAX INVOICE' : 'PRO FORMA'}</div>
          <div style="font-style: italic;">Original Copy</div>
        </div>
        
        <div class="header-row">
          <div class="company-details">
          <div>Dated : ${sale.date.split('-').reverse().join('-')}</div>
          <div>Place of Supply : Maharashtra (27)</div>
        </div>
        
        <table class="items-table">
          <thead>
            <tr>
              <th style="width: 30px;">S.N.</th>
              <th class="text-left">Goods / Services</th>
              <th style="width: 50px;">Qty.</th>
              <th style="width: 50px;">Unit</th>
              <th style="width: 50px;">Dis(%)</th>
              <th style="width: 60px;">Dis Amt.</th>
              <th style="width: 70px;">Price</th>
              <th style="width: 80px;">Amount(₹)</th>
            </tr>
          </thead>
          <tbody>
            ${items.map((item, i) => {
              const listPrice = item.rate;
              const itemDiscountPct = 0; 
              const itemDiscountAmt = 0;
              const priceAfterDiscount = listPrice;
              
              return `
                <tr>
                  <td class="text-center">${i + 1}</td>
                  <td>${item.product_name}</td>
                  <td class="text-center">${item.qty}</td>
                  <td class="text-center">${item.unit}</td>
                  <td class="text-right">${itemDiscountPct.toFixed(2)}</td>
                  <td class="text-right">${itemDiscountAmt.toFixed(2)}</td>
                  <td class="text-right">${priceAfterDiscount.toFixed(2)}</td>
                  <td class="text-right">${item.amount.toFixed(2)}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
        
        <div class="grand-total-row">
          <span>Grand Total ₹</span>
          <span class="grand-total-box">${sale.total_amount.toFixed(2)}</span>
        </div>
        
        <div class="tax-info-row">
          <table class="tax-table">
            <thead>
              <tr>
                <th class="text-left">Tax Rate</th>
                <th>Taxable Amt.</th>
                <th>CGST Amt.</th>
                <th>SGST Amt.</th>
                <th>Total Tax</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td class="text-left">${isPakka ? taxRate : 0}%</td>
                <td>${subtotal.toFixed(2)}</td>
                <td>${cgstAmount.toFixed(2)}</td>
                <td>${sgstAmount.toFixed(2)}</td>
                <td>${totalTax.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
          <div class="amount-words">Rupees ${amountInWords}</div>
        </div>
        
        <div class="footer-row">
          <div>Receiver's Signature</div>
          <div>Authorised Signatory</div>
        </div>
      </div>
      <script>
        // Use base64 encoded image directly. Script embed_logo.js handles injecting it into the LOCAL_LOGO_PLACEHOLDER.
      </script>
    </body>
    </html>
  `;
};
