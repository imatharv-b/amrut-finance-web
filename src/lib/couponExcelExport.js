import * as XLSX from 'xlsx';

const fmt = (num) => Number(num || 0).toFixed(2);
const fmtInt = (num) => Math.round(Number(num || 0));

export function exportCouponAnalyticsExcel(reportData, seasonName) {
  if (!reportData || !reportData.schemes) return;
  
  const wb = XLSX.utils.book_new();
  const { summary, schemes } = reportData;

  // ═══════════════════════════════════════════════
  // SHEET 1: SUMMARY OVERVIEW
  // ═══════════════════════════════════════════════
  const summaryRows = [
    ['COUPON ANALYTICS REPORT'],
    [`Season: ${seasonName || 'N/A'}`, '', '', `Generated: ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`],
    [],
    ['OVERALL SUMMARY'],
    ['Metric', 'Value'],
    ['Total Schemes', summary.totalSchemes],
    ['Total Coupons Issued', summary.totalCoupons],
    ['Total Target (₹)', fmtInt(summary.totalTarget)],
    ['Total Sales (₹)', fmtInt(summary.totalSales)],
    ['Achievement %', summary.totalTarget > 0 ? `${((summary.totalSales / summary.totalTarget) * 100).toFixed(1)}%` : '0%'],
    ['Coupons Achieved', summary.totalAchieved],
    ['Coupons In Progress', summary.totalInProgress],
    ['Coupons Not Started', summary.totalNotStarted],
    [],
    ['SCHEME-WISE SUMMARY'],
    ['Scheme Name', 'Target / Coupon (₹)', 'Benefit', 'Total Coupons', 'Total Target (₹)', 'Total Sales (₹)', 'Achievement %', 'Achieved', 'In Progress', 'Not Started'],
  ];

  schemes.forEach(s => {
    summaryRows.push([
      s.name,
      fmtInt(s.target_per_coupon),
      s.benefit_description || '-',
      s.total_coupons,
      fmtInt(s.total_target),
      fmtInt(s.total_sales),
      `${s.completion_pct.toFixed(1)}%`,
      s.achieved,
      s.in_progress,
      s.not_started,
    ]);
  });

  const summaryWs = XLSX.utils.aoa_to_sheet(summaryRows);
  
  // Column widths
  summaryWs['!cols'] = [
    { wch: 25 }, { wch: 20 }, { wch: 25 }, { wch: 16 }, { wch: 18 },
    { wch: 18 }, { wch: 16 }, { wch: 12 }, { wch: 14 }, { wch: 14 }
  ];
  
  // Merge title row
  summaryWs['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 5 } },
  ];

  XLSX.utils.book_append_sheet(wb, summaryWs, 'Summary');

  // ═══════════════════════════════════════════════
  // SHEET 2+: ONE SHEET PER SCHEME WITH ALL COUPONS
  // ═══════════════════════════════════════════════
  schemes.forEach(scheme => {
    const sheetName = scheme.name.substring(0, 28).replace(/[\/\\?*[\]]/g, '_');
    
    const rows = [
      [`SCHEME: ${scheme.name}`],
      [`Target per Coupon: ₹${fmtInt(scheme.target_per_coupon)}`, '', `Benefit: ${scheme.benefit_description || '-'}`, '', `Total Coupons: ${scheme.total_coupons}`],
      [`Total Sales: ₹${fmtInt(scheme.total_sales)}`, '', `Total Target: ₹${fmtInt(scheme.total_target)}`, '', `Achievement: ${scheme.completion_pct.toFixed(1)}%`],
      [],
      [
        'Coupon No',
        'Party (Krishi Kendra)',
        'Village',
        'District',
        'Material Sale (₹)',
        'Opening Bal (₹)',
        'Payment Jama (₹)',
        'Material Baki (₹)',
        'Payment Pending (₹)',
        'Total Balance (₹)',
        'Progress %',
        'Status'
      ]
    ];

    const coupons = scheme.coupons || [];
    
    // Sort: achieved first, then in progress, then not started
    const statusOrder = { 'ACHIEVED': 0, 'IN_PROGRESS': 1, 'NOT_STARTED': 2 };
    const sorted = [...coupons].sort((a, b) => (statusOrder[a.status] || 3) - (statusOrder[b.status] || 3));

    let totalMaterialSale = 0, totalOpeningBal = 0, totalPaymentJama = 0;
    let totalMaterialBaki = 0, totalPaymentPending = 0, totalBalance = 0;

    sorted.forEach(c => {
      totalMaterialSale += c.total_sales;
      totalOpeningBal += c.opening_bal;
      totalPaymentJama += c.party_receipts;
      totalMaterialBaki += c.material_baki;
      totalPaymentPending += c.coupon_payment_pending;
      totalBalance += c.total_balance;

      rows.push([
        c.coupon_no,
        c.party_name,
        c.party_village || '-',
        c.party_district || '-',
        Number(fmt(c.total_sales)),
        Number(fmt(c.opening_bal)),
        Number(fmt(c.party_receipts)),
        Number(fmt(c.material_baki)),
        Number(fmt(c.coupon_payment_pending)),
        Number(fmt(c.total_balance)),
        `${c.completion_pct.toFixed(1)}%`,
        c.status === 'ACHIEVED' ? '✅ Achieved' : c.status === 'IN_PROGRESS' ? '🔄 In Progress' : '⬜ Not Started'
      ]);
    });

    // Totals row
    rows.push([]);
    rows.push([
      'TOTALS',
      `${sorted.length} coupons`,
      '', '',
      Number(fmt(totalMaterialSale)),
      Number(fmt(totalOpeningBal)),
      Number(fmt(totalPaymentJama)),
      Number(fmt(totalMaterialBaki)),
      Number(fmt(totalPaymentPending)),
      Number(fmt(totalBalance)),
      scheme.completion_pct.toFixed(1) + '%',
      `${scheme.achieved} achieved`
    ]);

    const ws = XLSX.utils.aoa_to_sheet(rows);
    
    // Column widths
    ws['!cols'] = [
      { wch: 12 }, { wch: 35 }, { wch: 16 }, { wch: 14 },
      { wch: 18 }, { wch: 16 }, { wch: 18 }, { wch: 18 },
      { wch: 20 }, { wch: 18 }, { wch: 12 }, { wch: 16 }
    ];
    
    // Merge header rows
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 7 } },
    ];

    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  });

  // ═══════════════════════════════════════════════
  // SHEET: ALL COUPONS (FLAT LIST)
  // ═══════════════════════════════════════════════
  const allRows = [
    ['ALL COUPONS - DETAILED VIEW'],
    [`Season: ${seasonName || 'N/A'}`],
    [],
    [
      'Scheme',
      'Coupon No',
      'Party (Krishi Kendra)',
      'Village',
      'District',
      'Target (₹)',
      'Material Sale (₹)',
      'Opening Bal (₹)',
      'Payment Jama (₹)',
      'Material Baki (₹)',
      'Payment Pending (₹)',
      'Total Balance (₹)',
      'Progress %',
      'Status'
    ]
  ];

  const allCoupons = (reportData.coupons || []).sort((a, b) => {
    if (a.scheme_name !== b.scheme_name) return a.scheme_name.localeCompare(b.scheme_name);
    return a.coupon_no?.localeCompare(b.coupon_no);
  });

  allCoupons.forEach(c => {
    allRows.push([
      c.scheme_name,
      c.coupon_no,
      c.party_name,
      c.party_village || '-',
      c.party_district || '-',
      Number(fmt(c.target_amount)),
      Number(fmt(c.total_sales)),
      Number(fmt(c.opening_bal)),
      Number(fmt(c.party_receipts)),
      Number(fmt(c.material_baki)),
      Number(fmt(c.coupon_payment_pending)),
      Number(fmt(c.total_balance)),
      `${c.completion_pct.toFixed(1)}%`,
      c.status === 'ACHIEVED' ? '✅ Achieved' : c.status === 'IN_PROGRESS' ? '🔄 In Progress' : '⬜ Not Started'
    ]);
  });

  // Grand totals
  allRows.push([]);
  allRows.push([
    'GRAND TOTAL',
    `${allCoupons.length} coupons`,
    '', '', '',
    Number(fmt(summary.totalTarget)),
    Number(fmt(summary.totalSales)),
    '',
    '',
    '',
    '',
    '',
    summary.totalTarget > 0 ? `${((summary.totalSales / summary.totalTarget) * 100).toFixed(1)}%` : '0%',
    `${summary.totalAchieved} achieved`
  ]);

  const allWs = XLSX.utils.aoa_to_sheet(allRows);
  allWs['!cols'] = [
    { wch: 25 }, { wch: 12 }, { wch: 35 }, { wch: 16 }, { wch: 14 },
    { wch: 14 }, { wch: 18 }, { wch: 16 }, { wch: 18 }, { wch: 18 },
    { wch: 20 }, { wch: 18 }, { wch: 12 }, { wch: 16 }
  ];
  allWs['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 8 } },
  ];

  XLSX.utils.book_append_sheet(wb, allWs, 'All Coupons');

  // ═══════════════════════════════════════════════
  // DOWNLOAD
  // ═══════════════════════════════════════════════
  const fileName = `Coupon_Analytics_${(seasonName || 'Report').replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, fileName);
}
