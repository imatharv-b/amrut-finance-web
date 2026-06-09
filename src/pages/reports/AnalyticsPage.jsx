import { useState, useEffect, useContext } from 'react'
import { SeasonContext } from '../../context/SeasonContext'
import LoadingSpinner from '../../components/LoadingSpinner'
import EmptyState from '../../components/EmptyState'
import { 
  BarChart, Bar, PieChart, Pie, Cell, 
  XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, 
  ResponsiveContainer 
} from 'recharts'
import { LineChart, PieChart as PieChartIcon, AlertTriangle, TrendingUp, DollarSign, Package } from 'lucide-react'

const formatCurrency = (num) => '₹' + new Intl.NumberFormat('en-IN').format(Math.round(num || 0))
const formatCompact = (num) => {
  if (num >= 10000000) return '₹' + (num / 10000000).toFixed(1) + 'Cr'
  if (num >= 100000) return '₹' + (num / 100000).toFixed(1) + 'L'
  if (num >= 1000) return '₹' + (num / 1000).toFixed(1) + 'K'
  return '₹' + num
}

const COLORS = ['#6366f1', '#14b8a6', '#f59e0b', '#ec4899', '#8b5cf6', '#ef4444', '#10b981', '#3b82f6', '#f97316', '#64748b']

const CustomTooltip = ({ active, payload, label, isCurrency = true }) => {
  if (!active || !payload || !payload.length) return null
  return (
    <div className="bg-white rounded-xl shadow-lg border border-slate-100 px-4 py-3 min-w-[160px]">
      <p className="text-sm font-semibold text-slate-700 mb-1.5">{label}</p>
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center gap-2 text-sm">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-slate-500">{entry.name}:</span>
          <span className="font-semibold text-slate-800">
            {isCurrency ? formatCurrency(entry.value) : entry.value}
          </span>
        </div>
      ))}
    </div>
  )
}

export default function AnalyticsPage() {
  const { activeSeason } = useContext(SeasonContext)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!activeSeason) {
      setLoading(false)
      return
    }
    const fetchData = async () => {
      setLoading(true)
      try {
        const result = await window.db.invoke('analytics:getHubData', activeSeason.id)
        setData(result)
      } catch (err) {
        console.error('Analytics fetch error:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [activeSeason])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <LoadingSpinner />
      </div>
    )
  }

  if (!activeSeason) {
    return (
      <EmptyState
        icon={LineChart}
        title="No Active Season"
        message="Please select or create an active season to view analytics."
      />
    )
  }

  if (!data) {
    return (
      <EmptyState
        icon={LineChart}
        title="No Data Available"
        message="No analytics data found for the active season."
      />
    )
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-100 rounded-xl">
            <LineChart className="w-6 h-6 text-indigo-700" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Advanced Analytics Hub</h1>
            <p className="text-sm text-slate-500">Deep insights into products and party risks</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Top Products by Revenue */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
          <div className="flex items-center gap-2 mb-6">
            <DollarSign className="w-5 h-5 text-emerald-500" />
            <h2 className="text-lg font-bold text-slate-800">Top Products by Revenue</h2>
          </div>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart
              data={data.topProductsByRev || []}
              layout="vertical"
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
              <XAxis type="number" tickFormatter={formatCompact} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 12, fill: '#475569' }} axisLine={false} tickLine={false} />
              <RechartsTooltip content={<CustomTooltip isCurrency={true} />} cursor={{ fill: 'rgba(148,163,184,0.08)' }} />
              <Bar dataKey="revenue" name="Revenue" fill="#10b981" radius={[0, 4, 4, 0]} barSize={20} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Top Products by Volume */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
          <div className="flex items-center gap-2 mb-6">
            <Package className="w-5 h-5 text-indigo-500" />
            <h2 className="text-lg font-bold text-slate-800">Top Products by Volume (Qty)</h2>
          </div>
          <div className="flex h-[320px] items-center">
            <ResponsiveContainer width="60%" height="100%">
              <PieChart>
                <Pie
                  data={data.topProductsByVol || []}
                  dataKey="volume"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  innerRadius={60}
                  paddingAngle={2}
                  strokeWidth={2}
                  stroke="#fff"
                >
                  {(data.topProductsByVol || []).map((_, index) => (
                    <Cell key={index} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <RechartsTooltip content={<CustomTooltip isCurrency={false} />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="w-40% pl-4 space-y-2 overflow-y-auto max-h-[300px]">
              {(data.topProductsByVol || []).map((item, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: COLORS[i % COLORS.length] }}
                    />
                    <span className="text-slate-600 truncate max-w-[120px]">{item.name}</span>
                  </div>
                  <span className="font-semibold text-slate-800">{item.volume}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Dealer Risk Matrix */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
          <div className="flex items-center gap-2 mb-6">
            <AlertTriangle className="w-5 h-5 text-rose-500" />
            <div>
              <h2 className="text-lg font-bold text-slate-800">Dealer Risk Matrix</h2>
              <p className="text-xs text-slate-400 mt-0.5">Top outstanding accounts and their last payment dates</p>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-y border-slate-200">
                <tr>
                  <th className="px-4 py-3">Dealer Name</th>
                  <th className="px-4 py-3">Outstanding Balance</th>
                  <th className="px-4 py-3">Last Payment Received</th>
                  <th className="px-4 py-3">Risk Level</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(data.topRisks || []).map((party) => {
                  let daysSincePay = null;
                  if (party.lastPaymentDate) {
                     daysSincePay = Math.floor((new Date() - new Date(party.lastPaymentDate)) / (1000 * 60 * 60 * 24));
                  }
                  
                  // Simple risk classification
                  let riskLevel = "Medium";
                  let riskColor = "text-amber-600 bg-amber-50 border-amber-200";
                  if (party.outstanding > 100000 && (daysSincePay === null || daysSincePay > 60)) {
                     riskLevel = "High";
                     riskColor = "text-rose-600 bg-rose-50 border-rose-200";
                  } else if (party.outstanding < 20000 || (daysSincePay !== null && daysSincePay < 30)) {
                     riskLevel = "Low";
                     riskColor = "text-emerald-600 bg-emerald-50 border-emerald-200";
                  }

                  return (
                    <tr key={party.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3 font-medium text-slate-800">{party.name}</td>
                      <td className="px-4 py-3 font-bold text-slate-800">{formatCurrency(party.outstanding)}</td>
                      <td className="px-4 py-3 text-slate-500">
                        {party.lastPaymentDate 
                          ? new Date(party.lastPaymentDate).toLocaleDateString('en-IN') + ` (${daysSincePay} days ago)`
                          : 'No payments recorded'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${riskColor}`}>
                          {riskLevel}
                        </span>
                      </td>
                    </tr>
                  )
                })}
                {(!data.topRisks || data.topRisks.length === 0) && (
                  <tr>
                    <td colSpan="4" className="px-4 py-8 text-center text-slate-400">No outstanding risk data found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  )
}
