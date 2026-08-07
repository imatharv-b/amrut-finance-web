import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

const fmtNum = (num) => Number(Number(num || 0).toFixed(2));

// ─── Color Palette ───────────────────────────────────────────────
const COLORS = {
  darkGreen: '1B5E20',
  green: '2E7D32',
  lightGreen: 'E8F5E9',
  white: 'FFFFFF',
  black: '000000',
  darkGray: '37474F',
  medGray: '546E7A',
  lightGray: 'ECEFF1',
  veryLightGray: 'F5F5F5',
  blue: '1565C0',
  lightBlue: 'E3F2FD',
  orange: 'E65100',
  lightOrange: 'FFF3E0',
  red: 'C62828',
  lightRed: 'FFEBEE',
  purple: '6A1B9A',
  lightPurple: 'F3E5F5',
  teal: '00695C',
  gold: 'F9A825',
  lightGold: 'FFFDE7',
};

// ─── Style Helpers ───────────────────────────────────────────────
const thinBorder = (color = 'B0BEC5') => ({
  top: { style: 'thin', color: { argb: color } },
  bottom: { style: 'thin', color: { argb: color } },
  left: { style: 'thin', color: { argb: color } },
  right: { style: 'thin', color: { argb: color } },
});

const applyTitleRow = (ws, row, text, colCount, bgColor = COLORS.darkGreen, fgColor = COLORS.white) => {
  const r = ws.getRow(row);
  ws.mergeCells(row, 1, row, colCount);
  const cell = ws.getCell(row, 1);
  cell.value = text;
  cell.font = { bold: true, size: 14, color: { argb: fgColor }, name: 'Calibri' };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
  cell.alignment = { horizontal: 'left', vertical: 'middle' };
  r.height = 30;
};

const applySubtitleRow = (ws, row, text, colCount, bgColor = COLORS.green) => {
  ws.mergeCells(row, 1, row, colCount);
  const cell = ws.getCell(row, 1);
  cell.value = text;
  cell.font = { bold: true, size: 10, color: { argb: COLORS.white }, name: 'Calibri' };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
  cell.alignment = { horizontal: 'left', vertical: 'middle' };
  ws.getRow(row).height = 22;
};

const applyHeaderRow = (ws, row, headers, bgColor = COLORS.darkGray) => {
  const r = ws.getRow(row);
  r.height = 24;
  headers.forEach((h, i) => {
    const cell = ws.getCell(row, i + 1);
    cell.value = h;
    cell.font = { bold: true, size: 10, color: { argb: COLORS.white }, name: 'Calibri' };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
    cell.alignment = { horizontal: i >= 4 ? 'right' : 'left', vertical: 'middle', wrapText: true };
    cell.border = thinBorder(bgColor);
  });
};

const applyDataRow = (ws, row, values, isEven, statusCol = -1) => {
  const r = ws.getRow(row);
  r.height = 20;
  const bgColor = isEven ? COLORS.veryLightGray : COLORS.white;
  
  values.forEach((v, i) => {
    const cell = ws.getCell(row, i + 1);
    cell.value = v;
    cell.font = { size: 10, color: { argb: COLORS.darkGray }, name: 'Calibri' };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
    cell.alignment = { horizontal: typeof v === 'number' ? 'right' : 'left', vertical: 'middle' };
    cell.border = thinBorder('CFD8DC');
    
    // Number formatting for currency columns
    if (typeof v === 'number' && i >= 4) {
      cell.numFmt = '#,##0.00';
    }
  });

  // Status column coloring
  if (statusCol >= 0) {
    const statusCell = ws.getCell(row, statusCol + 1);
    const statusVal = String(statusCell.value || '');
    if (statusVal.includes('Achieved')) {
      statusCell.font = { bold: true, size: 10, color: { argb: COLORS.green }, name: 'Calibri' };
      statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.lightGreen } };
    } else if (statusVal.includes('Progress')) {
      statusCell.font = { bold: true, size: 10, color: { argb: COLORS.orange }, name: 'Calibri' };
      statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.lightOrange } };
    } else if (statusVal.includes('Not Started')) {
      statusCell.font = { bold: true, size: 10, color: { argb: COLORS.red }, name: 'Calibri' };
      statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.lightRed } };
    }

    // Progress % column coloring
    const progressCell = ws.getCell(row, statusCol);
    const pctStr = String(progressCell.value || '');
    const pctVal = parseFloat(pctStr);
    if (!isNaN(pctVal)) {
      if (pctVal >= 100) {
        progressCell.font = { bold: true, size: 10, color: { argb: COLORS.green }, name: 'Calibri' };
      } else if (pctVal > 0) {
        progressCell.font = { bold: true, size: 10, color: { argb: COLORS.orange }, name: 'Calibri' };
      } else {
        progressCell.font = { bold: true, size: 10, color: { argb: COLORS.red }, name: 'Calibri' };
      }
    }
  }
};

const applyTotalsRow = (ws, row, values, colCount) => {
  const r = ws.getRow(row);
  r.height = 24;
  values.forEach((v, i) => {
    const cell = ws.getCell(row, i + 1);
    cell.value = v;
    cell.font = { bold: true, size: 11, color: { argb: COLORS.white }, name: 'Calibri' };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.teal } };
    cell.alignment = { horizontal: typeof v === 'number' ? 'right' : 'left', vertical: 'middle' };
    cell.border = thinBorder(COLORS.teal);
    if (typeof v === 'number') cell.numFmt = '#,##0.00';
  });
};

// ═══════════════════════════════════════════════════════════════
// MAIN EXPORT FUNCTION
// ═══════════════════════════════════════════════════════════════
export async function exportCouponAnalyticsExcel(reportData, seasonName) {
  if (!reportData || !reportData.schemes) return;

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Amrut Biochem Finance';
  wb.created = new Date();

  const { summary, schemes } = reportData;

  // ═══════════════════════════════════════════════
  // SHEET 1: SUMMARY
  // ═══════════════════════════════════════════════
  const ws1 = wb.addWorksheet('Summary', {
    properties: { tabColor: { argb: COLORS.darkGreen } },
    views: [{ showGridLines: false }]
  });

  // Column widths
  ws1.columns = [
    { width: 28 }, { width: 22 }, { width: 26 }, { width: 18 }, { width: 20 },
    { width: 20 }, { width: 18 }, { width: 14 }, { width: 16 }, { width: 16 }
  ];

  // Title
  applyTitleRow(ws1, 1, '📊  COUPON ANALYTICS REPORT', 10);

  // Season & Date info
  applySubtitleRow(ws1, 2, `   Season: ${seasonName || 'N/A'}  •  Generated: ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`, 10, COLORS.green);

  // Empty row
  let r = 4;

  // ─── KPI Cards ───
  const kpis = [
    ['📋 Total Schemes', summary.totalSchemes, '🎫 Total Coupons', summary.totalCoupons],
    ['🎯 Total Target (₹)', fmtNum(summary.totalTarget), '💰 Total Sales (₹)', fmtNum(summary.totalSales)],
    ['📈 Achievement', summary.totalTarget > 0 ? `${((summary.totalSales / summary.totalTarget) * 100).toFixed(1)}%` : '0%', '', ''],
    ['✅ Achieved', summary.totalAchieved, '🔄 In Progress', summary.totalInProgress],
    ['⬜ Not Started', summary.totalNotStarted, '', ''],
  ];

  kpis.forEach(kpi => {
    const row = ws1.getRow(r);
    row.height = 24;
    
    // Left KPI
    const c1 = ws1.getCell(r, 1);
    c1.value = kpi[0];
    c1.font = { size: 10, color: { argb: COLORS.medGray }, name: 'Calibri' };
    c1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.lightGray } };
    c1.border = thinBorder('CFD8DC');
    
    const c2 = ws1.getCell(r, 2);
    c2.value = kpi[1];
    c2.font = { bold: true, size: 12, color: { argb: COLORS.darkGreen }, name: 'Calibri' };
    c2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.lightGray } };
    c2.alignment = { horizontal: 'right' };
    c2.border = thinBorder('CFD8DC');
    if (typeof kpi[1] === 'number' && kpi[0].includes('₹')) c2.numFmt = '#,##0.00';

    // Right KPI
    if (kpi[2]) {
      const c3 = ws1.getCell(r, 4);
      c3.value = kpi[2];
      c3.font = { size: 10, color: { argb: COLORS.medGray }, name: 'Calibri' };
      c3.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.lightGray } };
      c3.border = thinBorder('CFD8DC');
      
      const c4 = ws1.getCell(r, 5);
      c4.value = kpi[3];
      c4.font = { bold: true, size: 12, color: { argb: COLORS.darkGreen }, name: 'Calibri' };
      c4.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.lightGray } };
      c4.alignment = { horizontal: 'right' };
      c4.border = thinBorder('CFD8DC');
      if (typeof kpi[3] === 'number' && kpi[2].includes('₹')) c4.numFmt = '#,##0.00';
    }
    r++;
  });

  r += 2;

  // ─── Scheme-wise Table ───
  applySubtitleRow(ws1, r, '   SCHEME-WISE BREAKDOWN', 10, COLORS.purple);
  r++;

  const schemeHeaders = ['Scheme Name', 'Target / Coupon (₹)', 'Benefit', 'Total Coupons', 'Total Target (₹)', 'Total Sales (₹)', 'Achievement %', 'Achieved', 'In Progress', 'Not Started'];
  applyHeaderRow(ws1, r, schemeHeaders, COLORS.purple);
  r++;

  schemes.forEach((s, idx) => {
    applyDataRow(ws1, r, [
      s.name,
      fmtNum(s.target_per_coupon),
      s.benefit_description || '-',
      s.total_coupons,
      fmtNum(s.total_target),
      fmtNum(s.total_sales),
      `${s.completion_pct.toFixed(1)}%`,
      s.achieved,
      s.in_progress,
      s.not_started,
    ], idx % 2 === 0);

    // Color the achievement cell
    const achCell = ws1.getCell(r, 7);
    const pct = s.completion_pct;
    if (pct >= 100) {
      achCell.font = { bold: true, size: 10, color: { argb: COLORS.green }, name: 'Calibri' };
      achCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.lightGreen } };
    } else if (pct > 0) {
      achCell.font = { bold: true, size: 10, color: { argb: COLORS.orange }, name: 'Calibri' };
      achCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.lightOrange } };
    }

    r++;
  });

  // ═══════════════════════════════════════════════
  // SHEET 2+: PER-SCHEME DETAIL
  // ═══════════════════════════════════════════════
  const schemeHeaders2 = [
    'Coupon No', 'Party (Krishi Kendra)', 'Village', 'District',
    'Material Sale (₹)', 'Opening Bal (₹)', 'Payment Jama (₹)',
    'Material Baki (₹)', 'Payment Pending (₹)', 'Total Balance (₹)',
    'Progress %', 'Status'
  ];

  schemes.forEach(scheme => {
    const sheetName = scheme.name.substring(0, 28).replace(/[\/\\?*[\]:]/g, '_');
    const ws = wb.addWorksheet(sheetName, {
      properties: { tabColor: { argb: COLORS.blue } },
      views: [{ showGridLines: false }]
    });

    ws.columns = [
      { width: 14 }, { width: 36 }, { width: 18 }, { width: 16 },
      { width: 18 }, { width: 16 }, { width: 18 }, { width: 18 },
      { width: 20 }, { width: 18 }, { width: 14 }, { width: 18 }
    ];

    // Header
    applyTitleRow(ws, 1, `🏷️  ${scheme.name}`, 12, COLORS.blue);
    applySubtitleRow(ws, 2, `   Target: ₹${fmtNum(scheme.target_per_coupon).toLocaleString('en-IN')}  •  Benefit: ${scheme.benefit_description || '-'}  •  Coupons: ${scheme.total_coupons}  •  Sales: ₹${fmtNum(scheme.total_sales).toLocaleString('en-IN')}  /  ₹${fmtNum(scheme.total_target).toLocaleString('en-IN')}  •  Achievement: ${scheme.completion_pct.toFixed(1)}%`, 12, COLORS.blue);

    // KPI mini bar row 3
    const kpiRow = ws.getRow(3);
    kpiRow.height = 22;
    const kpiItems = [
      { label: '✅ Achieved', val: scheme.achieved, color: COLORS.green, bg: COLORS.lightGreen },
      { label: '🔄 In Progress', val: scheme.in_progress, color: COLORS.orange, bg: COLORS.lightOrange },
      { label: '⬜ Not Started', val: scheme.not_started, color: COLORS.red, bg: COLORS.lightRed },
    ];
    let col = 1;
    kpiItems.forEach(k => {
      ws.mergeCells(3, col, 3, col + 1);
      const cell = ws.getCell(3, col);
      cell.value = `${k.label}: ${k.val}`;
      cell.font = { bold: true, size: 10, color: { argb: k.color }, name: 'Calibri' };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: k.bg } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = thinBorder('CFD8DC');
      // Also fill the merged cell's right side
      const cell2 = ws.getCell(3, col + 1);
      cell2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: k.bg } };
      cell2.border = thinBorder('CFD8DC');
      col += 2;
    });

    // Column headers row 5
    applyHeaderRow(ws, 5, schemeHeaders2, COLORS.darkGray);

    // Data rows
    const coupons = scheme.coupons || [];
    const statusOrder = { 'ACHIEVED': 0, 'IN_PROGRESS': 1, 'NOT_STARTED': 2 };
    const sorted = [...coupons].sort((a, b) => (statusOrder[a.status] || 3) - (statusOrder[b.status] || 3));

    let totalMS = 0, totalOB = 0, totalPJ = 0, totalMB = 0, totalPP = 0, totalTB = 0;
    let dataRow = 6;

    sorted.forEach((c, idx) => {
      totalMS += c.total_sales;
      totalOB += c.opening_bal;
      totalPJ += c.party_receipts;
      totalMB += c.material_baki;
      totalPP += c.coupon_payment_pending;
      totalTB += c.total_balance;

      const statusLabel = c.status === 'ACHIEVED' ? '✅ Achieved' : c.status === 'IN_PROGRESS' ? '🔄 In Progress' : '⬜ Not Started';

      applyDataRow(ws, dataRow, [
        c.coupon_no,
        c.party_name,
        c.party_village || '-',
        c.party_district || '-',
        fmtNum(c.total_sales),
        fmtNum(c.opening_bal),
        fmtNum(c.party_receipts),
        fmtNum(c.material_baki),
        fmtNum(c.coupon_payment_pending),
        fmtNum(c.total_balance),
        `${c.completion_pct.toFixed(1)}%`,
        statusLabel
      ], idx % 2 === 0, 11); // statusCol = 11 (0-indexed)

      dataRow++;
    });

    // Totals row
    dataRow++;
    applyTotalsRow(ws, dataRow, [
      'TOTALS',
      `${sorted.length} coupons`,
      '', '',
      fmtNum(totalMS),
      fmtNum(totalOB),
      fmtNum(totalPJ),
      fmtNum(totalMB),
      fmtNum(totalPP),
      fmtNum(totalTB),
      `${scheme.completion_pct.toFixed(1)}%`,
      `${scheme.achieved} achieved`
    ], 12);
  });

  // ═══════════════════════════════════════════════
  // LAST SHEET: ALL COUPONS FLAT
  // ═══════════════════════════════════════════════
  const wsAll = wb.addWorksheet('All Coupons', {
    properties: { tabColor: { argb: COLORS.teal } },
    views: [{ showGridLines: false }]
  });

  const allHeaders = [
    'Scheme', 'Coupon No', 'Party (Krishi Kendra)', 'Village', 'District',
    'Target (₹)', 'Material Sale (₹)', 'Opening Bal (₹)', 'Payment Jama (₹)',
    'Material Baki (₹)', 'Payment Pending (₹)', 'Total Balance (₹)',
    'Progress %', 'Status'
  ];

  wsAll.columns = [
    { width: 26 }, { width: 14 }, { width: 36 }, { width: 18 }, { width: 16 },
    { width: 16 }, { width: 18 }, { width: 16 }, { width: 18 }, { width: 18 },
    { width: 20 }, { width: 18 }, { width: 14 }, { width: 18 }
  ];

  applyTitleRow(wsAll, 1, '📋  ALL COUPONS — DETAILED VIEW', 14, COLORS.teal);
  applySubtitleRow(wsAll, 2, `   Season: ${seasonName || 'N/A'}  •  Total: ${summary.totalCoupons} coupons  •  ✅ ${summary.totalAchieved} achieved  •  🔄 ${summary.totalInProgress} in progress  •  ⬜ ${summary.totalNotStarted} not started`, 14, COLORS.teal);

  applyHeaderRow(wsAll, 4, allHeaders, COLORS.darkGray);

  const allCoupons = (reportData.coupons || []).sort((a, b) => {
    if (a.scheme_name !== b.scheme_name) return a.scheme_name.localeCompare(b.scheme_name);
    return (a.coupon_no || '').localeCompare(b.coupon_no || '');
  });

  let allRow = 5;
  allCoupons.forEach((c, idx) => {
    const statusLabel = c.status === 'ACHIEVED' ? '✅ Achieved' : c.status === 'IN_PROGRESS' ? '🔄 In Progress' : '⬜ Not Started';

    applyDataRow(wsAll, allRow, [
      c.scheme_name,
      c.coupon_no,
      c.party_name,
      c.party_village || '-',
      c.party_district || '-',
      fmtNum(c.target_amount),
      fmtNum(c.total_sales),
      fmtNum(c.opening_bal),
      fmtNum(c.party_receipts),
      fmtNum(c.material_baki),
      fmtNum(c.coupon_payment_pending),
      fmtNum(c.total_balance),
      `${c.completion_pct.toFixed(1)}%`,
      statusLabel
    ], idx % 2 === 0, 13); // statusCol = 13 (0-indexed)

    allRow++;
  });

  // Grand totals
  allRow++;
  applyTotalsRow(wsAll, allRow, [
    'GRAND TOTAL',
    `${allCoupons.length}`,
    '', '', '',
    fmtNum(summary.totalTarget),
    fmtNum(summary.totalSales),
    '', '', '', '', '',
    summary.totalTarget > 0 ? `${((summary.totalSales / summary.totalTarget) * 100).toFixed(1)}%` : '0%',
    `${summary.totalAchieved} achieved`
  ], 14);

  // ═══════════════════════════════════════════════
  // DOWNLOAD
  // ═══════════════════════════════════════════════
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const fileName = `Coupon_Analytics_${(seasonName || 'Report').replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  saveAs(blob, fileName);
}
