import React, { useState, useEffect, useMemo } from 'react'
import {
  History, Filter, RefreshCw, LogIn, LogOut, Plus, Pencil, Trash2,
  FileText, CreditCard, Users, Package, Target, Ticket, Receipt,
  ChevronDown, Search, Calendar, UserCircle, Clock, Briefcase,
  AlertCircle, ShieldCheck
} from 'lucide-react'

const formatCurrency = (num) => '₹' + new Intl.NumberFormat('en-IN').format(Math.round(num || 0))

const ACTION_CONFIG = {
  CREATE: { label: 'Created', color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: Plus, dotColor: 'bg-emerald-500' },
  UPDATE: { label: 'Updated', color: 'bg-blue-100 text-blue-700 border-blue-200', icon: Pencil, dotColor: 'bg-blue-500' },
  DELETE: { label: 'Deleted', color: 'bg-red-100 text-red-700 border-red-200', icon: Trash2, dotColor: 'bg-red-500' },
  LOGIN:  { label: 'Login', color: 'bg-violet-100 text-violet-700 border-violet-200', icon: LogIn, dotColor: 'bg-violet-500' },
  LOGOUT: { label: 'Logout', color: 'bg-slate-100 text-slate-600 border-slate-200', icon: LogOut, dotColor: 'bg-slate-400' },
}

const ENTITY_ICONS = {
  SALE: FileText,
  PAYMENT: CreditCard,
  PARTY: Users,
  PRODUCT: Package,
  SCHEME: Target,
  COUPON: Ticket,
  EXPENSE: Receipt,
  WORKER: Briefcase,
  AUTH: ShieldCheck,
}

function renderDetails(details) {
  if (!details || Object.keys(details).length === 0) return null

  const parts = []

  if (details.party_name) {
    parts.push(<span key="party" className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary-50 text-primary-700 rounded-md text-[11px] font-semibold"><Users className="w-3 h-3" />{details.party_name}</span>)
  }
  if (details.total_amount) {
    parts.push(<span key="amount" className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-md text-[11px] font-bold">{formatCurrency(details.total_amount)}</span>)
  }
  if (details.amount) {
    parts.push(<span key="amt" className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-700 rounded-md text-[11px] font-bold">{formatCurrency(details.amount)}</span>)
  }

  // Show any remaining keys that aren't party_id, party_name, total_amount, amount, timestamp
  const skipKeys = ['party_id', 'party_name', 'total_amount', 'amount', 'timestamp']
  Object.entries(details).forEach(([k, v]) => {
    if (skipKeys.includes(k)) return
    parts.push(<span key={k} className="text-[11px] text-slate-500">{k}: <span className="font-medium text-slate-700">{String(v)}</span></span>)
  })

  return parts.length > 0 ? <div className="flex flex-wrap gap-1.5 mt-1.5">{parts}</div> : null
}

function ActiveUsersSection({ logs }) {
  // Find users with recent LOGIN who haven't logged out after
  const activeUsers = useMemo(() => {
    const userMap = new Map()
    // Process logs (already sorted by created_at desc)
    for (const log of logs) {
      if (log.entity_type !== 'AUTH') continue
      const email = log.user_email || log.entity_name
      if (!email) continue
      if (!userMap.has(email)) {
        userMap.set(email, { email, action: log.action, time: log.created_at })
      }
    }
    // Only show users whose latest AUTH action is LOGIN
    return [...userMap.values()].filter(u => u.action === 'LOGIN')
  }, [logs])

  if (activeUsers.length === 0) return null

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 mb-6 animate-fadeIn">
      <div className="flex items-center gap-2 mb-3">
        <div className="p-1.5 bg-emerald-100 rounded-lg">
          <UserCircle className="w-4 h-4 text-emerald-600" />
        </div>
        <h3 className="text-sm font-bold text-slate-800">Active Users</h3>
        <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold">{activeUsers.length} online</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {activeUsers.map(u => (
          <div key={u.email} className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-lg border border-slate-100">
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
            </span>
            <span className="text-sm font-medium text-slate-700">{u.email}</span>
            <span className="text-[10px] text-slate-400">
              {new Date(u.time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function ActivityLogPage() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({ action: '', entity_type: '', fromDate: '', toDate: '' })
  const [searchQuery, setSearchQuery] = useState('')
  const [showFilters, setShowFilters] = useState(false)

  useEffect(() => {
    fetchLogs()
  }, [])

  const fetchLogs = async (customFilters) => {
    setLoading(true)
    try {
      const f = customFilters || {}
      const activeFilters = {}
      if (f.action) activeFilters.action = f.action
      if (f.entity_type) activeFilters.entity_type = f.entity_type
      if (f.fromDate) activeFilters.fromDate = f.fromDate
      if (f.toDate) activeFilters.toDate = f.toDate
      const data = await window.db.invoke('activity:getAll', activeFilters)
      setLogs(data || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleFilterChange = (key, value) => {
    const newFilters = { ...filters, [key]: value }
    setFilters(newFilters)
    fetchLogs(newFilters)
  }

  const clearFilters = () => {
    setFilters({ action: '', entity_type: '', fromDate: '', toDate: '' })
    fetchLogs({})
  }

  const hasActiveFilters = filters.action || filters.entity_type || filters.fromDate || filters.toDate

  // Client-side search on entity_name, user_email, or party_name in details
  const filteredLogs = useMemo(() => {
    if (!searchQuery.trim()) return logs
    const q = searchQuery.toLowerCase()
    return logs.filter(log =>
      (log.entity_name || '').toLowerCase().includes(q) ||
      (log.user_email || '').toLowerCase().includes(q) ||
      (log.entity_type || '').toLowerCase().includes(q) ||
      (log.details?.party_name || '').toLowerCase().includes(q)
    )
  }, [logs, searchQuery])

  // Group logs by date
  const groupedLogs = useMemo(() => {
    const groups = {}
    filteredLogs.forEach(log => {
      const date = new Date(log.created_at).toLocaleDateString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric'
      })
      if (!groups[date]) groups[date] = []
      groups[date].push(log)
    })
    return groups
  }, [filteredLogs])

  const uniqueEntityTypes = useMemo(() => {
    return [...new Set(logs.map(l => l.entity_type).filter(Boolean))]
  }, [logs])

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-slate-100 rounded-xl">
            <History className="w-6 h-6 text-slate-700" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Activity Logs</h1>
            <p className="text-sm text-slate-500">Track system events, logins, and data changes</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-colors border ${
              hasActiveFilters
                ? 'bg-primary-50 text-primary-700 border-primary-200'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <Filter className="w-4 h-4" />
            Filters
            {hasActiveFilters && <span className="w-2 h-2 rounded-full bg-primary-500" />}
          </button>
          <button
            onClick={() => fetchLogs(filters)}
            className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium hover:bg-slate-50 flex items-center gap-1.5 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Search by name, email, entity..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all"
        />
      </div>

      {/* Filter Bar */}
      {showFilters && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 animate-fadeIn">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Action</label>
              <select
                value={filters.action}
                onChange={(e) => handleFilterChange('action', e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none"
              >
                <option value="">All Actions</option>
                <option value="CREATE">Create</option>
                <option value="UPDATE">Update</option>
                <option value="DELETE">Delete</option>
                <option value="LOGIN">Login</option>
                <option value="LOGOUT">Logout</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Entity Type</label>
              <select
                value={filters.entity_type}
                onChange={(e) => handleFilterChange('entity_type', e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none"
              >
                <option value="">All Types</option>
                {uniqueEntityTypes.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">From Date</label>
              <input
                type="date"
                value={filters.fromDate}
                onChange={(e) => handleFilterChange('fromDate', e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">To Date</label>
              <input
                type="date"
                value={filters.toDate}
                onChange={(e) => handleFilterChange('toDate', e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={clearFilters}
                className="px-4 py-2 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors w-full"
              >
                Clear All
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Active Users */}
      {!loading && <ActiveUsersSection logs={logs} />}

      {/* Stats Summary */}
      {!loading && logs.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {Object.entries(ACTION_CONFIG).map(([key, config]) => {
            const count = logs.filter(l => l.action === key).length
            if (count === 0) return null
            const Icon = config.icon
            return (
              <button
                key={key}
                onClick={() => handleFilterChange('action', filters.action === key ? '' : key)}
                className={`p-3 rounded-xl border text-left transition-all hover:shadow-sm ${
                  filters.action === key ? 'ring-2 ring-primary-500 border-primary-300 bg-primary-50' : 'bg-white border-slate-200'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Icon className="w-3.5 h-3.5 text-slate-500" />
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{config.label}</span>
                </div>
                <p className="text-lg font-black text-slate-800">{count}</p>
              </button>
            )
          })}
        </div>
      )}

      {/* Timeline */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full mx-auto mb-3" />
            <p className="text-sm text-slate-500">Loading activity logs...</p>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-12 text-center">
            <AlertCircle className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-medium text-slate-500">No activity logs found</p>
            <p className="text-xs text-slate-400 mt-1">
              {hasActiveFilters || searchQuery ? 'Try adjusting your filters or search' : 'Activity will appear here as users interact with the system'}
            </p>
          </div>
        ) : (
          <div>
            {Object.entries(groupedLogs).map(([date, dateLogs]) => (
              <div key={date}>
                {/* Date Header */}
                <div className="sticky top-0 z-10 bg-slate-50 border-b border-slate-100 px-5 py-2 flex items-center gap-2">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{date}</span>
                  <span className="text-[10px] text-slate-400 bg-slate-200 px-1.5 py-0.5 rounded-full font-medium">{dateLogs.length}</span>
                </div>

                {/* Log Entries */}
                <div className="divide-y divide-slate-50">
                  {dateLogs.map((log) => {
                    const actionCfg = ACTION_CONFIG[log.action] || ACTION_CONFIG.CREATE
                    const ActionIcon = actionCfg.icon
                    const EntityIcon = ENTITY_ICONS[log.entity_type] || FileText

                    return (
                      <div key={log.id} className="px-5 py-3.5 hover:bg-slate-50/50 transition-colors group">
                        <div className="flex items-start gap-3">
                          {/* Timeline dot */}
                          <div className="mt-1.5 shrink-0">
                            <div className={`w-2.5 h-2.5 rounded-full ${actionCfg.dotColor} ring-4 ring-white`} />
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              {/* Action badge */}
                              <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md border uppercase tracking-wider ${actionCfg.color}`}>
                                <ActionIcon className="w-3 h-3" />
                                {actionCfg.label}
                              </span>

                              {/* Entity type + name */}
                              <div className="flex items-center gap-1.5">
                                <EntityIcon className="w-3.5 h-3.5 text-slate-400" />
                                <span className="text-sm font-semibold text-slate-800">
                                  {log.entity_type}
                                </span>
                                {log.entity_name && (
                                  <span className="text-sm text-slate-600">
                                    — {log.entity_name}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Details (party name, amount, etc.) */}
                            {renderDetails(log.details)}

                            {/* User + Time */}
                            <div className="flex items-center gap-3 mt-2">
                              {log.user_email && (
                                <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
                                  <UserCircle className="w-3 h-3" />
                                  {log.user_email}
                                </span>
                              )}
                              <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                                <Clock className="w-3 h-3" />
                                {new Date(log.created_at).toLocaleTimeString('en-IN', {
                                  hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true
                                })}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Result Count */}
      {!loading && filteredLogs.length > 0 && (
        <p className="text-xs text-slate-400 text-center">
          Showing {filteredLogs.length} of {logs.length} entries
        </p>
      )}
    </div>
  )
}
