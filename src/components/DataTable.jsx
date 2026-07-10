import { useState, useMemo, useEffect } from 'react'
import { Search, ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight, Inbox } from 'lucide-react'
import LoadingSpinner from './LoadingSpinner'
import EmptyState from './EmptyState'

const PAGE_SIZE = 15

export default function DataTable({
  columns = [],
  data = [],
  onRowClick,
  actions,
  searchable = true,
  searchPlaceholder = 'Search...',
  loading = false,
  emptyMessage = 'No data found',
  emptyIcon: EmptyIcon = Inbox,
  renderMobileCard,
  initialSearch = ''
}) {
  const [searchTerm, setSearchTerm] = useState(initialSearch)
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' })
  const [currentPage, setCurrentPage] = useState(1)

  // ── Filter data by search term ─────────────────────────────────
  const filteredData = useMemo(() => {
    const term = searchTerm || '';
    if (!term.trim()) return data
    const lower = term.toLowerCase()
    return data.filter((row) =>
      columns.some((col) => {
        const val = row[col.key]
        return val != null && String(val).toLowerCase().includes(lower)
      })
    )
  }, [data, searchTerm, columns])

  // ── Sort data ──────────────────────────────────────────────────
  const sortedData = useMemo(() => {
    if (!sortConfig.key) return filteredData
    return [...filteredData].sort((a, b) => {
      const aVal = a[sortConfig.key]
      const bVal = b[sortConfig.key]
      if (aVal == null) return 1
      if (bVal == null) return -1
      const compare =
        typeof aVal === 'number'
          ? aVal - bVal
          : String(aVal).localeCompare(String(bVal))
      return sortConfig.direction === 'asc' ? compare : -compare
    })
  }, [filteredData, sortConfig])

  // ── Pagination ─────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(sortedData.length / PAGE_SIZE))
  const paginatedData = useMemo(() => {
    if (sortedData.length <= PAGE_SIZE) return sortedData
    const start = (currentPage - 1) * PAGE_SIZE
    return sortedData.slice(start, start + PAGE_SIZE)
  }, [sortedData, currentPage])

  // Reset page when search or data changes
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, data])

  // ── Sort handler ───────────────────────────────────────────────
  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }))
  }

  // ── Render sort icon ───────────────────────────────────────────
  const renderSortIcon = (col) => {
    if (!col.sortable) return null
    if (sortConfig.key !== col.key) {
      return <ArrowUpDown size={14} className="text-slate-300 ml-1" />
    }
    return sortConfig.direction === 'asc' ? (
      <ArrowUp size={14} className="text-primary-600 ml-1" />
    ) : (
      <ArrowDown size={14} className="text-primary-600 ml-1" />
    )
  }

  // ── Loading State ──────────────────────────────────────────────
  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12">
        <div className="flex items-center justify-center">
          <LoadingSpinner size="md" />
          <span className="ml-3 text-sm text-slate-500">Loading data...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full h-full flex flex-col overflow-hidden animate-fadeIn bg-white">
      {/* ── Search Bar ─────────────────────────────────────────── */}
      {searchable && (
        <div className="px-4 py-3 border-b border-slate-100 shrink-0">
          <div className="relative max-w-sm">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm || ''}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50
                focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500
                placeholder:text-slate-400 transition-all"
            />
          </div>
        </div>
      )}

      {/* ── Table ──────────────────────────────────────────────── */}
      {sortedData.length === 0 ? (
        <div className="py-16 flex-1 overflow-auto">
          <EmptyState
            icon={EmptyIcon}
            title={emptyMessage}
            description={searchTerm ? 'Try adjusting your search terms' : 'No records to display'}
          />
        </div>
      ) : (
        <>
          {renderMobileCard && (
            <div className="md:hidden flex flex-col gap-3 p-4 overflow-y-auto flex-1 bg-slate-50/50">
              {paginatedData.map((row, idx) => (
                <div key={row.id ?? idx} onClick={() => onRowClick?.(row)}>
                  {renderMobileCard(row)}
                </div>
              ))}
            </div>
          )}

          <div className={`flex-1 overflow-auto ${renderMobileCard ? 'hidden md:block' : ''}`}>
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  {columns.map((col) => (
                    <th
                      key={col.key}
                      style={col.width ? { width: col.width } : undefined}
                      className={`
                        px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap
                        ${col.sortable ? 'cursor-pointer hover:text-slate-700 select-none' : ''}
                      `}
                      onClick={() => col.sortable && handleSort(col.key)}
                    >
                      <span className="inline-flex items-center">
                        {col.label}
                        {renderSortIcon(col)}
                      </span>
                    </th>
                  ))}
                  {actions && (
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap w-[100px]">
                      Actions
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedData.map((row, idx) => (
                  <tr
                    key={row.id ?? idx}
                    onClick={() => onRowClick?.(row)}
                    className={`
                      transition-colors duration-150
                      ${onRowClick ? 'cursor-pointer' : ''}
                      hover:bg-slate-50/80
                    `}
                  >
                    {columns.map((col) => (
                      <td key={col.key} className="px-4 py-3 text-sm text-slate-700 whitespace-nowrap">
                        {col.render ? col.render(row[col.key], row) : row[col.key]}
                      </td>
                    ))}
                    {actions && (
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          {typeof actions === 'function' ? actions(row) : (
                            Array.isArray(actions) && actions.map((act, i) => (
                              <button
                                key={i}
                                onClick={(e) => { e.stopPropagation(); act.onClick(row) }}
                                className={`p-1.5 rounded-lg transition ${
                                  act.variant === 'danger'
                                    ? 'text-slate-400 hover:text-red-600 hover:bg-red-50'
                                    : 'text-slate-400 hover:text-primary-600 hover:bg-slate-100'
                                }`}
                                title={act.label}
                              >
                                <act.icon size={16} />
                              </button>
                            ))
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ── Pagination ───────────────────────────────────────── */}
          {sortedData.length > PAGE_SIZE && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 shrink-0">
              <span className="text-xs text-slate-500">
                Showing {(currentPage - 1) * PAGE_SIZE + 1}–
                {Math.min(currentPage * PAGE_SIZE, sortedData.length)} of {sortedData.length}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft size={16} className="text-slate-600" />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(
                    (p) =>
                      p === 1 ||
                      p === totalPages ||
                      Math.abs(p - currentPage) <= 1
                  )
                  .reduce((acc, p, i, arr) => {
                    if (i > 0 && p - arr[i - 1] > 1) {
                      acc.push('...')
                    }
                    acc.push(p)
                    return acc
                  }, [])
                  .map((p, idx) =>
                    p === '...' ? (
                      <span key={`dots-${idx}`} className="px-1 text-xs text-slate-400">
                        ...
                      </span>
                    ) : (
                      <button
                        key={p}
                        onClick={() => setCurrentPage(p)}
                        className={`w-8 h-8 rounded-lg text-xs font-medium transition-colors
                          ${
                            currentPage === p
                              ? 'bg-primary-700 text-white shadow-sm'
                              : 'text-slate-600 hover:bg-slate-100'
                          }`}
                      >
                        {p}
                      </button>
                    )
                  )}
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight size={16} className="text-slate-600" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
