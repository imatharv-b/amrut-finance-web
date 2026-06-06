export const generateCouponHTML = (coupon, settings) => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Coupon ${coupon.coupon_no}</title>
      <style>
        body { font-family: 'Arial', sans-serif; padding: 40px; color: #333; display: flex; justify-content: center; }
        .coupon-card { 
          width: 600px; 
          border: 2px dashed #d97706; 
          border-radius: 10px; 
          padding: 20px; 
          position: relative;
          background-color: #fffbeb;
        }
        .header { text-align: center; border-bottom: 2px solid #d97706; padding-bottom: 15px; margin-bottom: 20px; }
        .firm-name { font-size: 24px; font-weight: bold; color: #b45309; margin: 0; }
        
        .coupon-title { font-size: 22px; font-weight: bold; text-align: center; color: #92400e; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 2px; }
        .scheme-name { text-align: center; font-size: 18px; font-weight: bold; color: #d97706; margin-bottom: 25px; }
        
        .coupon-number-box { 
          background-color: #fef3c7; 
          border: 1px solid #fcd34d; 
          text-align: center; 
          padding: 10px; 
          font-size: 28px; 
          font-weight: bold; 
          letter-spacing: 4px; 
          color: #b45309;
          margin-bottom: 25px;
          border-radius: 5px;
        }
        
        .details-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 25px; }
        .detail-item { font-size: 14px; }
        .detail-label { color: #92400e; font-weight: bold; display: inline-block; width: 100px; }
        .detail-value { font-weight: bold; }
        
        .footer { text-align: center; font-size: 11px; color: #78350f; border-top: 1px dashed #d97706; padding-top: 15px; }
        
        .watermark { 
          position: absolute; 
          top: 50%; 
          left: 50%; 
          transform: translate(-50%, -50%) rotate(-30deg); 
          font-size: 80px; 
          color: rgba(217, 119, 6, 0.05); 
          font-weight: bold; 
          pointer-events: none;
          z-index: 0;
          white-space: nowrap;
        }
        
        .content { position: relative; z-index: 1; }
      </style>
    </head>
    <body>
      <div class="coupon-card">
        <div class="watermark">${settings.firm_name || 'AMRUT BIOCHEM'}</div>
        <div class="content">
          <div class="header">
            <h1 class="firm-name">${settings.firm_name || 'Amrut Biochem'}</h1>
          </div>
          
          <div class="coupon-title">REWARD COUPON</div>
          <div class="scheme-name">${coupon.scheme_name}</div>
          
          <div class="coupon-number-box">
            ${coupon.coupon_no}
          </div>
          
          <div class="details-grid">
            <div class="detail-item">
              <span class="detail-label">Issued To:</span>
              <span class="detail-value">${coupon.party_name}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Date Issued:</span>
              <span class="detail-value">${coupon.date_issued}</span>
            </div>
          </div>
          
          <div class="footer">
            <p>This coupon is non-transferable and can only be claimed by the issued party.</p>
            <p>Please present this original coupon at the time of claiming the reward.</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
};
