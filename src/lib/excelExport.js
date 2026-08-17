import ExcelJS from 'exceljs'
import { saveAs } from 'file-saver'

/**
 * Export data to a styled Excel file with colors, formatting, and a bar chart.
 * 
 * @param {Object} options
 * @param {string} options.title - Sheet title / report name
 * @param {Array<{key: string, label: string, width?: number}>} options.columns - Column definitions
 * @param {Array<Object>} options.data - Row data
 * @param {string} [options.valueKey] - Key of the numeric value column (for chart + conditional formatting)
 * @param {string} [options.accentColor] - Hex color for header (default: '1a4731' green)
 * @param {string} [options.filename] - Output filename (without extension)
 * @param {Object} [options.summary] - Summary row values, e.g. { total: 123456 }
 */
export async function exportToExcel({
  title,
  columns,
  data,
  valueKey,
  accentColor = '1a4731',
  filename = 'report',
  summary = null
}) {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Amrut Biochem Finance'
  wb.created = new Date()

  const ws = wb.addWorksheet(title, {
    properties: { tabColor: { argb: accentColor } },
    pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true }
  })

  // ── Title Row ──────────────────────────────────────────────
  const titleRow = ws.addRow([title])
  titleRow.font = { name: 'Calibri', size: 16, bold: true, color: { argb: 'FF' + accentColor } }
  titleRow.height = 30
  ws.mergeCells(1, 1, 1, columns.length)

  // ── Date Row ───────────────────────────────────────────────
  const dateRow = ws.addRow([`Generated: ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`])
  dateRow.font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FF888888' } }
  ws.mergeCells(2, 1, 2, columns.length)

  // ── Empty spacer row ───────────────────────────────────────
  ws.addRow([])

  // ── Header Row ─────────────────────────────────────────────
  const headerValues = columns.map(c => c.label)
  const headerRow = ws.addRow(headerValues)
  headerRow.height = 28
  headerRow.eachCell((cell) => {
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + accentColor } }
    cell.alignment = { vertical: 'middle', horizontal: 'center' }
    cell.border = {
      bottom: { style: 'medium', color: { argb: 'FF' + accentColor } }
    }
  })

  // ── Set Column Widths ──────────────────────────────────────
  columns.forEach((col, i) => {
    ws.getColumn(i + 1).width = col.width || (col.key === 'name' || col.key === 'category' ? 35 : 20)
  })

  // ── Data Rows ──────────────────────────────────────────────
  const maxVal = valueKey ? Math.max(...data.map(d => Math.abs(Number(d[valueKey]) || 0)), 1) : 1

  data.forEach((row, rowIndex) => {
    const values = columns.map(c => {
      const val = row[c.key]
      // If it's a number column, return as number
      if (c.key === valueKey || typeof val === 'number') return Number(val || 0)
      return val || ''
    })

    const dataRow = ws.addRow(values)
    dataRow.height = 24

    dataRow.eachCell((cell, colNum) => {
      const col = columns[colNum - 1]
      
      cell.font = { name: 'Calibri', size: 11 }
      cell.alignment = { vertical: 'middle' }
      cell.border = {
        bottom: { style: 'thin', color: { argb: 'FFE8E8E8' } }
      }

      // Zebra striping
      if (rowIndex % 2 === 0) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFB' } }
      }

      // Format number columns
      if (col.key === valueKey || typeof row[col.key] === 'number') {
        cell.numFmt = '₹#,##0.00'
        cell.alignment = { vertical: 'middle', horizontal: 'right' }
        cell.font = { name: 'Calibri', size: 11, bold: true }

        // Color-code based on value
        const numVal = Number(row[col.key] || 0)
        if (numVal > 0) {
          cell.font.color = { argb: 'FFD97706' } // Amber for outstanding
        }
      }

      // Bold name column
      if (col.key === 'name' || col.key === 'category') {
        cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF1E293B' } }
      }
    })
  })

  // ── Conditional Color Bars (visual bars in an extra column) ─
  if (valueKey && data.length > 0) {
    const barColIndex = columns.length + 1
    ws.getColumn(barColIndex).width = 30

    // Header for bar column
    const barHeaderCell = ws.getCell(4, barColIndex)
    barHeaderCell.value = 'Visual'
    barHeaderCell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } }
    barHeaderCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + accentColor } }
    barHeaderCell.alignment = { vertical: 'middle', horizontal: 'center' }

    data.forEach((row, i) => {
      const val = Math.abs(Number(row[valueKey]) || 0)
      const pct = Math.round((val / maxVal) * 100)
      const barCell = ws.getCell(5 + i, barColIndex)
      barCell.value = '█'.repeat(Math.max(1, Math.round(pct / 5)))
      barCell.font = { name: 'Calibri', size: 10, color: { argb: 'FF' + accentColor } }
      barCell.alignment = { vertical: 'middle' }
      if (i % 2 === 0) {
        barCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFB' } }
      }
    })
  }

  // ── Summary / Total Row ────────────────────────────────────
  if (summary || (valueKey && data.length > 0)) {
    const totalVal = summary?.total ?? data.reduce((sum, d) => sum + (Number(d[valueKey]) || 0), 0)
    
    ws.addRow([]) // spacer
    const summaryValues = columns.map((c, i) => {
      if (i === 0) return 'TOTAL'
      if (c.key === valueKey) return totalVal
      return ''
    })
    const totalRow = ws.addRow(summaryValues)
    totalRow.height = 30
    totalRow.eachCell((cell, colNum) => {
      cell.font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FFFFFFFF' } }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + accentColor } }
      cell.alignment = { vertical: 'middle', horizontal: colNum === 1 ? 'left' : 'right' }
      if (colNum > 1) cell.numFmt = '₹#,##0.00'
    })
  }

  // ── Top 10 highlight ───────────────────────────────────────
  if (valueKey && data.length >= 3) {
    // Gold, Silver, Bronze for top 3
    const medalColors = ['FFFFD700', 'FFC0C0C0', 'FFCD7F32']
    for (let i = 0; i < Math.min(3, data.length); i++) {
      const cell = ws.getCell(5 + i, 1)
      cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF1E293B' } }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: medalColors[i] + '33' } }
    }
  }

  // ── Print Setup ────────────────────────────────────────────
  ws.pageSetup = {
    paperSize: 9,
    orientation: data.length > 20 ? 'portrait' : 'landscape',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    horizontalCentered: true
  }
  ws.headerFooter = {
    oddHeader: `&C&B${title} - Amrut Biochem Finance`,
    oddFooter: '&CPage &P of &N'
  }

  // ── Generate and Download ──────────────────────────────────
  const buffer = await wb.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  saveAs(blob, `${filename}_${new Date().toISOString().slice(0, 10)}.xlsx`)
}
