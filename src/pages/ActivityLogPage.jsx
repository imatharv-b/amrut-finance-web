import React, { useState, useEffect } from 'react'

export default function ActivityLogPage() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchLogs()
  }, [])

  const fetchLogs = async () => {
    try {
      const data = await window.db.invoke('activity:getAll')
      setLogs(data || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const getActionColor = (action) => {
    switch (action) {
      case 'CREATE': return 'bg-emerald-100 text-emerald-700'
      case 'UPDATE': return 'bg-blue-100 text-blue-700'
      case 'DELETE': return 'bg-red-100 text-red-700'
      default: return 'bg-slate-100 text-slate-700'
    }
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Activity Logs</h1>
          <p className="text-sm text-slate-500">Track system events and data changes</p>
        </div>
        <button onClick={fetchLogs} className="px-4 py-2 bg-white border border-slate-200 rounded-lg shadow-sm text-sm font-medium hover:bg-slate-50">
          Refresh
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-500">Loading activity...</div>
        ) : logs.length === 0 ? (
          <div className="p-8 text-center text-slate-500">No activity logged yet.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {logs.map((log) => (
              <div key={log.id} className="p-4 hover:bg-slate-50 flex items-start gap-4">
                <div className="mt-1">
                  <span className={`text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider ${getActionColor(log.action)}`}>
                    {log.action}
                  </span>
                </div>
                <div className="flex-1">
                  <p className="text-sm text-slate-800 font-medium">
                    {log.entity_type} {log.entity_name ? `- ${log.entity_name}` : ''}
                  </p>
                  <p className="text-xs text-slate-500 mt-1 font-mono bg-slate-100 inline-block px-2 py-1 rounded">
                    {JSON.stringify(log.details)}
                  </p>
                </div>
                <div className="text-xs text-slate-400 whitespace-nowrap">
                  {new Date(log.created_at).toLocaleString('en-IN', {
                    day: '2-digit', month: 'short', year: 'numeric',
                    hour: '2-digit', minute: '2-digit', hour12: true
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
