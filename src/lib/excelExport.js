import ExcelJS from 'exceljs'
import { saveAs } from 'file-saver'

/**
 * Export data to a beautifully styled Excel file.
 */
export async function exportToExcel({
  title,
  columns,
  data,
  valueKey,
  accentColor = 'D4A843',  // Default: Gold
  filename = 'report',
  summary = null
}) {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Amrut Biochem Finance'
  wb.created = new Date()

  // Color palette derived from accent
  const colors = getColorPalette(accentColor)

  const ws = wb.addWorksheet(title, {
    properties: { tabColor: { argb: colors.accent } },
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
    views: [{ showGridLines: false }]
  })

  let currentRow = 1

  // ── Company Header ─────────────────────────────────────────
  ws.mergeCells(currentRow, 1, currentRow, columns.length + 3)
  const companyCell = ws.getCell(currentRow, 1)
  companyCell.value = 'AMRUT BIOCHEM'
  companyCell.font = { name: 'Calibri', size: 14, bold: true, color: { argb: colors.accent } }
  companyCell.alignment = { horizontal: 'center', vertical: 'middle' }
  ws.getRow(currentRow).height = 28
  currentRow++

  // ── Report Title ───────────────────────────────────────────
  ws.mergeCells(currentRow, 1, currentRow, columns.length + 3)
  const titleCell = ws.getCell(currentRow, 1)
  titleCell.value = title.toUpperCase()
  titleCell.font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FF555555' } }
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' }
  ws.getRow(currentRow).height = 22
  currentRow++

  // ── Date + Summary Line ────────────────────────────────────
  ws.mergeCells(currentRow, 1, currentRow, columns.length + 3)
  const dateCell = ws.getCell(currentRow, 1)
  const totalValue = data.reduce((sum, d) => sum + (Number(d[valueKey]) || 0), 0)
  const formattedTotal = '₹' + new Intl.NumberFormat('en-IN').format(Math.round(totalValue))
  dateCell.value = `Generated on ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}  •  ${data.length} entries  •  Total: ${formattedTotal}`
  dateCell.font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FF999999' } }
  dateCell.alignment = { horizontal: 'center', vertical: 'middle' }
  ws.getRow(currentRow).height = 20
  currentRow++

  // ── Spacer ─────────────────────────────────────────────────
  ws.getRow(currentRow).height = 8
  currentRow++

  // ── Extended columns: Rank, original columns, % Share, Visual Bar ──
  const extColumns = [
    { key: '_rank', label: '#', width: 5 },
    ...columns.map(c => ({ ...c, width: c.key === valueKey ? 18 : 35 })),
    { key: '_pct', label: '% Share', width: 12 },
    { key: '_bar', label: 'Distribution', width: 32 }
  ]

  // ── Header Row ─────────────────────────────────────────────
  const headerRowNum = currentRow
  const headerRow = ws.getRow(currentRow)
  extColumns.forEach((col, i) => {
    const cell = ws.getCell(currentRow, i + 1)
    cell.value = col.label
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.accent } }
    cell.alignment = { vertical: 'middle', horizontal: 'center' }
    cell.border = { bottom: { style: 'medium', color: { argb: colors.accentDark } } }
    ws.getColumn(i + 1).width = col.width
  })
  headerRow.height = 28
  currentRow++

  // ── Sort data by value descending ──────────────────────────
  const sortedData = [...data].sort((a, b) => Math.abs(Number(b[valueKey]) || 0) - Math.abs(Number(a[valueKey]) || 0))
  const maxVal = Math.max(...sortedData.map(d => Math.abs(Number(d[valueKey]) || 0)), 1)

  // ── Data Rows ──────────────────────────────────────────────
  sortedData.forEach((row, rowIndex) => {
    const rank = rowIndex + 1
    const val = Number(row[valueKey]) || 0
    const pct = totalValue > 0 ? ((val / totalValue) * 100) : 0
    const barLength = Math.max(1, Math.round((Math.abs(val) / maxVal) * 20))

    const rowValues = []
    extColumns.forEach((col) => {
      if (col.key === '_rank') rowValues.push(rank)
      else if (col.key === '_pct') rowValues.push(pct / 100) // Store as decimal for % format
      else if (col.key === '_bar') rowValues.push('') // We'll handle bar separately
      else if (col.key === valueKey) rowValues.push(val)
      else rowValues.push(row[col.key] || '')
    })

    const dataRow = ws.getRow(currentRow)
    dataRow.values = rowValues
    dataRow.height = 26

    extColumns.forEach((col, i) => {
      const cell = ws.getCell(currentRow, i + 1)

      // Base styling
      cell.font = { name: 'Calibri', size: 10.5 }
      cell.alignment = { vertical: 'middle' }
      cell.border = { bottom: { style: 'hair', color: { argb: 'FFE0E0E0' } } }

      // Zebra striping
      const stripeBg = rowIndex % 2 === 0 ? colors.stripe : 'FFFFFFFF'
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: stripeBg } }

      // Rank column
      if (col.key === '_rank') {
        cell.alignment = { vertical: 'middle', horizontal: 'center' }
        cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF999999' } }
        // Medal colors for top 3
        if (rank === 1) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF8E1' } }
          cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFD4A843' } }
          cell.value = '🥇'
        } else if (rank === 2) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F5F5' } }
          cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF9E9E9E' } }
          cell.value = '🥈'
        } else if (rank === 3) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF3E0' } }
          cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFBF8040' } }
          cell.value = '🥉'
        }
      }

      // Name column
      if (col.key === 'name' || col.key === 'category') {
        cell.font = { name: 'Calibri', size: 10.5, bold: rank <= 3, color: { argb: 'FF1E293B' } }
        cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 }
      }

      // Value column
      if (col.key === valueKey) {
        cell.numFmt = '₹#,##0.00'
        cell.alignment = { vertical: 'middle', horizontal: 'right' }
        cell.font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: colors.valueText } }
      }

      // Percentage column
      if (col.key === '_pct') {
        cell.numFmt = '0.0%'
        cell.alignment = { vertical: 'middle', horizontal: 'center' }
        cell.font = { name: 'Calibri', size: 10, color: { argb: 'FF777777' } }
      }

      // Visual bar column — use colored block characters
      if (col.key === '_bar') {
        cell.value = '█'.repeat(barLength)
        cell.font = { name: 'Calibri', size: 11, color: { argb: colors.barColor } }
        cell.alignment = { vertical: 'middle', horizontal: 'left' }
      }
    })

    currentRow++
  })

  // ── Spacer ─────────────────────────────────────────────────
  currentRow++

  // ── Total Row ──────────────────────────────────────────────
  const totalRowNum = currentRow
  extColumns.forEach((col, i) => {
    const cell = ws.getCell(currentRow, i + 1)
    if (i === 0) {
      cell.value = ''
    } else if (col.key === columns[0]?.key) {
      cell.value = `TOTAL (${data.length} entries)`
    } else if (col.key === valueKey) {
      cell.value = totalValue
      cell.numFmt = '₹#,##0.00'
    } else if (col.key === '_pct') {
      cell.value = 1
      cell.numFmt = '0%'
    } else {
      cell.value = ''
    }
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.accent } }
    cell.alignment = { vertical: 'middle', horizontal: col.key === valueKey || col.key === '_pct' ? 'right' : 'left', indent: 1 }
    cell.border = { top: { style: 'medium', color: { argb: colors.accentDark } } }
  })
  ws.getRow(currentRow).height = 30
  currentRow += 2

  // ── Quick Stats Box ────────────────────────────────────────
  const statsData = computeStats(sortedData, valueKey, totalValue)
  
  ws.mergeCells(currentRow, 1, currentRow, extColumns.length)
  const statsHeader = ws.getCell(currentRow, 1)
  statsHeader.value = '📊  QUICK INSIGHTS'
  statsHeader.font = { name: 'Calibri', size: 11, bold: true, color: { argb: colors.accent } }
  statsHeader.alignment = { vertical: 'middle' }
  ws.getRow(currentRow).height = 24
  currentRow++

  statsData.forEach(({ label, value }) => {
    ws.mergeCells(currentRow, 1, currentRow, 2)
    ws.mergeCells(currentRow, 3, currentRow, extColumns.length)
    const labelCell = ws.getCell(currentRow, 1)
    labelCell.value = label
    labelCell.font = { name: 'Calibri', size: 10, color: { argb: 'FF777777' } }
    labelCell.alignment = { vertical: 'middle', indent: 1 }
    const valCell = ws.getCell(currentRow, 3)
    valCell.value = value
    valCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF333333' } }
    valCell.alignment = { vertical: 'middle' }
    ws.getRow(currentRow).height = 20
    currentRow++
  })

  // ── Print Setup ────────────────────────────────────────────
  ws.headerFooter = {
    oddHeader: `&C&B${title} — Amrut Biochem Finance`,
    oddFooter: '&L&8Confidential&C&8Page &P of &N&R&8Printed: &D'
  }

  // ── Generate and Download ──────────────────────────────────
  const buffer = await wb.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  saveAs(blob, `${filename}_${new Date().toISOString().slice(0, 10)}.xlsx`)
}

// ── Color Palettes ───────────────────────────────────────────
function getColorPalette(accentHex) {
  const palettes = {
    // Outstanding — Rich Gold/Amber
    'D97706': {
      accent: 'FFD97706',
      accentDark: 'FFB45309',
      stripe: 'FFFFFBEB',
      barColor: 'FFD97706',
      valueText: 'FFB45309',
    },
    // Sales — Emerald Green
    '15803d': {
      accent: 'FF15803d',
      accentDark: 'FF166534',
      stripe: 'FFF0FDF4',
      barColor: 'FF22C55E',
      valueText: 'FF15803D',
    },
    // Expenses — Deep Red
    'DC2626': {
      accent: 'FFDC2626',
      accentDark: 'FFB91C1C',
      stripe: 'FFFFF1F2',
      barColor: 'FFEF4444',
      valueText: 'FFDC2626',
    },
    // Receipts — Royal Blue
    '2563EB': {
      accent: 'FF2563EB',
      accentDark: 'FF1D4ED8',
      stripe: 'FFEFF6FF',
      barColor: 'FF3B82F6',
      valueText: 'FF2563EB',
    },
    // Default — Gold
    'D4A843': {
      accent: 'FFD4A843',
      accentDark: 'FFB8922E',
      stripe: 'FFFFFDF5',
      barColor: 'FFD4A843',
      valueText: 'FFB8922E',
    }
  }

  return palettes[accentHex] || palettes['D4A843']
}

// ── Compute quick insights ───────────────────────────────────
function computeStats(sortedData, valueKey, total) {
  const fmt = (n) => '₹' + new Intl.NumberFormat('en-IN').format(Math.round(n))

  if (!sortedData.length || !valueKey) return []

  const values = sortedData.map(d => Number(d[valueKey]) || 0)
  const avg = total / sortedData.length
  const max = values[0]
  const min = values[values.length - 1]
  const top5Total = values.slice(0, 5).reduce((a, b) => a + b, 0)
  const top5Pct = total > 0 ? ((top5Total / total) * 100).toFixed(1) : 0
  const median = values[Math.floor(values.length / 2)]

  const stats = [
    { label: 'Highest', value: `${sortedData[0]?.name || sortedData[0]?.category || '-'}  →  ${fmt(max)}` },
    { label: 'Lowest', value: `${sortedData[sortedData.length - 1]?.name || sortedData[sortedData.length - 1]?.category || '-'}  →  ${fmt(min)}` },
    { label: 'Average', value: fmt(avg) },
    { label: 'Median', value: fmt(median) },
    { label: 'Top 5 Concentration', value: `${fmt(top5Total)} (${top5Pct}% of total)` },
    { label: 'Total Entries', value: `${sortedData.length}` },
  ]

  return stats
}
