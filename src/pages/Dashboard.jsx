import { useState, useEffect, useContext } from 'react'
import { useNavigate } from 'react-router-dom'
import { SeasonContext } from '../context/SeasonContext'
import StatCard from '../components/StatCard'
import LoadingSpinner from '../components/LoadingSpinner'
import EmptyState from '../components/EmptyState'
import Modal from '../components/Modal'
import DataTable from '../components/DataTable'
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer
} from 'recharts'
import {
  IndianRupee, Receipt, TrendingUp, AlertCircle, Ticket,
  LayoutDashboard, Crown, ArrowUpRight, FileText, Wallet
} from 'lucide-react'

const formatCurrency = (num) => '₹' + new Intl.NumberFormat('en-IN').format(Math.round(num || 0))
const formatCompact = (num) => {
  if (num >= 10000000) return '₹' + (num / 10000000).toFixed(1) + 'Cr'
  if (num >= 100000) return '₹' + (num / 100000).toFixed(1) + 'L'
  if (num >= 1000) return '₹' + (num / 1000).toFixed(1) + 'K'
  return '₹' + num
}

const CHART_COLORS = ['#15803d', '#d97706', '#6366f1', '#ec4899', '#14b8a6', '#f97316', '#22c55e', '#fbbf24']

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

const PieTooltip = ({ active, payload }) => {
  if (!active || !payload || !payload.length) return null
  return (
    <div className="bg-white rounded-xl shadow-lg border border-slate-100 px-4 py-3">
      <p className="text-sm font-semibold text-slate-700">{payload[0].name}</p>
      <p className="text-sm font-bold text-slate-900 mt-0.5">{formatCurrency(payload[0].value)}</p>
    </div>
  )
}

const SchemeTooltip = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null
  const data = payload[0].payload
  const gap = data.enrolledCount - data.achievedCount
  
  let statusText = gap === 0 ? "100% conversion!" : `${gap} enrolled store(s) yet to hit target`
  let statusColor = gap === 0 ? "text-green-600" : "text-amber-600"

  return (
    <div className="bg-white rounded-xl shadow-lg border border-slate-100 px-4 py-3 min-w-[200px]">
      <p className="text-sm font-bold text-slate-800 mb-1">{label}</p>
      <p className="text-xs text-slate-500 mb-3">Target: {formatCurrency(data.target)}</p>
      
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span className="text-slate-600">Enrolled Stores:</span>
          </div>
          <span className="font-semibold text-slate-800">{data.enrolledCount}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
            <span className="text-slate-600">Successfully Achieved:</span>
          </div>
          <span className="font-semibold text-slate-800">{data.achievedCount}</span>
        </div>
      </div>
      
      <div className={`mt-3 pt-2 border-t border-slate-100 text-xs font-semibold ${statusColor}`}>
        {statusText}
      </div>
    </div>
  )
}

export default function Dashboard() {
  const { activeSeason } = useContext(SeasonContext)
  const navigate = useNavigate()
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeModal, setActiveModal] = useState(null) // 'sales', 'expenses', 'outstanding', 'coupons'
  const [selectedProgressSchemeId, setSelectedProgressSchemeId] = useState(null)

  useEffect(() => {
    if (!activeSeason) {
      setLoading(false)
      return
    }
    const fetchStats = async () => {
      setLoading(true)
      try {
        const data = await window.db.invoke('dashboard:stats', activeSeason.id)
        setStats(data)
      } catch (err) {
        console.error('Dashboard fetch error:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchStats()
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
        icon={LayoutDashboard}
        title="No Active Season"
        message="Please select or create an active season to view dashboard data."
      />
    )
  }

  if (!stats) {
    return (
      <EmptyState
        icon={LayoutDashboard}
        title="No Data Available"
        message="No dashboard data found for the active season."
      />
    )
  }

  const statCards = [
    { title: 'Total Sales', value: formatCurrency(stats.totalSales), icon: IndianRupee, color: 'green', onClick: () => setActiveModal('sales') },
    { title: 'Total Expenses', value: formatCurrency(stats.totalExpenses), icon: Receipt, color: 'red', onClick: () => setActiveModal('expenses') },
    { title: 'Total Receipts', value: formatCurrency(stats.totalReceipts), icon: Wallet, color: 'blue', onClick: () => setActiveModal('receipts') },
    { title: 'Outstanding', value: formatCurrency(stats.totalReceivables), icon: AlertCircle, color: 'amber', onClick: () => setActiveModal('outstanding') },
    { title: 'Coupons Issued', value: stats.couponsIssued?.toString() || '0', icon: Ticket, color: 'green', onClick: () => setActiveModal('coupons') },
  ]

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-primary-100 rounded-xl">
            <LayoutDashboard className="w-6 h-6 text-primary-700" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>
            <p className="text-sm text-slate-500">Business overview at a glance</p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-accent-100 text-accent-700 rounded-full text-sm font-semibold border border-accent-200">
          <Crown className="w-3.5 h-3.5" />
          {activeSeason.name}
        </span>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {statCards.map((card, index) => (
          <div
            key={card.title}
            className="animate-fadeIn"
            style={{ animationDelay: `${index * 80}ms`, animationFillMode: 'both' }}
          >
            <StatCard
              title={card.title}
              value={card.value}
              icon={card.icon}
              color={card.color}
              onClick={card.onClick}
            />
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Coupon Analytics Command Center */}
        <div
          className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-100 p-6 animate-fadeIn"
          style={{ animationDelay: '400ms', animationFillMode: 'both' }}
        >
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-lg font-bold text-slate-800">Coupon Performance</h2>
              <p className="text-xs text-slate-400 mt-0.5">Season-wide coupon analytics overview</p>
            </div>
            <button 
              onClick={() => navigate('/reports')}
              className="text-xs font-semibold text-primary-600 hover:text-primary-700 bg-primary-50 hover:bg-primary-100 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1"
            >
              View Details <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>

          {stats.couponSummary && stats.couponSummary.totalCoupons > 0 ? (
            <>
              {/* Top Row: Donut + Key Metrics */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-5">
                {/* Donut Chart - Coupon Status */}
                <div className="flex flex-col items-center justify-center">
                  <div className="relative">
                    <ResponsiveContainer width={140} height={140}>
                      <PieChart>
                        <Pie
                          data={[
                            { name: 'Achieved', value: stats.couponSummary.achieved, fill: '#22c55e' },
                            { name: 'In Progress', value: stats.couponSummary.inProgress, fill: '#f59e0b' },
                            { name: 'Not Started', value: stats.couponSummary.notStarted, fill: '#e2e8f0' }
                          ].filter(d => d.value > 0)}
                          dataKey="value"
                          cx="50%"
                          cy="50%"
                          outerRadius={65}
                          innerRadius={42}
                          paddingAngle={3}
                          strokeWidth={0}
                        >
                          {[
                            { fill: '#22c55e' },
                            { fill: '#f59e0b' },
                            { fill: '#e2e8f0' }
                          ].filter((_, i) => [stats.couponSummary.achieved, stats.couponSummary.inProgress, stats.couponSummary.notStarted][i] > 0).map((entry, index) => (
                            <Cell key={index} fill={entry.fill} />
                          ))}
                        </Pie>
                        <Tooltip content={<PieTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-2xl font-black text-slate-800">{stats.couponSummary.totalCoupons}</span>
                      <span className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">Coupons</span>
                    </div>
                  </div>
                  <div className="flex gap-3 mt-2 text-[10px] font-semibold">
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500"></span> {stats.couponSummary.achieved} Done</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400"></span> {stats.couponSummary.inProgress} Active</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-200"></span> {stats.couponSummary.notStarted} Idle</span>
                  </div>
                </div>

                {/* Achievement & Collection Gauges */}
                <div className="flex flex-col gap-3 justify-center">
                  {/* Target Achievement */}
                  <div className="bg-gradient-to-br from-emerald-50 to-green-50 rounded-xl p-3 border border-emerald-100">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] uppercase tracking-wider text-emerald-600 font-bold">Target Hit Rate</span>
                      <span className="text-lg font-black text-emerald-700">{stats.couponSummary.targetAchievementRate}%</span>
                    </div>
                    <div className="w-full bg-emerald-200/50 rounded-full h-2 overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600 transition-all duration-1000" style={{ width: `${Math.min(100, stats.couponSummary.targetAchievementRate)}%` }}></div>
                    </div>
                    <p className="text-[10px] text-emerald-500 mt-1">{stats.couponSummary.achieved} of {stats.couponSummary.totalCoupons} stores hit target</p>
                  </div>
                  {/* Collection Efficiency */}
                  <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-3 border border-blue-100">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] uppercase tracking-wider text-blue-600 font-bold">Collection Rate</span>
                      <span className="text-lg font-black text-blue-700">{stats.couponSummary.collectionEfficiency}%</span>
                    </div>
                    <div className="w-full bg-blue-200/50 rounded-full h-2 overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-r from-blue-400 to-blue-600 transition-all duration-1000" style={{ width: `${Math.min(100, stats.couponSummary.collectionEfficiency)}%` }}></div>
                    </div>
                    <p className="text-[10px] text-blue-500 mt-1">Jama received vs Material sold</p>
                  </div>
                </div>

                {/* Financial KPIs */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-100 text-center">
                    <p className="text-[9px] uppercase tracking-wider text-slate-400 font-bold mb-0.5">Material Sale</p>
                    <p className="text-sm font-black text-slate-800">{formatCompact(stats.couponSummary.totalMaterialSale)}</p>
                  </div>
                  <div className="bg-green-50 rounded-xl p-2.5 border border-green-100 text-center">
                    <p className="text-[9px] uppercase tracking-wider text-green-500 font-bold mb-0.5">Payment Jama</p>
                    <p className="text-sm font-black text-green-700">{formatCompact(stats.couponSummary.totalPaymentJama)}</p>
                  </div>
                  <div className="bg-red-50 rounded-xl p-2.5 border border-red-100 text-center">
                    <p className="text-[9px] uppercase tracking-wider text-red-400 font-bold mb-0.5">Material Baki</p>
                    <p className="text-sm font-black text-red-600">{formatCompact(stats.couponSummary.totalMaterialBaki)}</p>
                  </div>
                  <div className="bg-orange-50 rounded-xl p-2.5 border border-orange-100 text-center">
                    <p className="text-[9px] uppercase tracking-wider text-orange-400 font-bold mb-0.5">Total Balance</p>
                    <p className="text-sm font-black text-orange-700">{formatCompact(stats.couponSummary.totalBalance)}</p>
                  </div>
                </div>
              </div>

              {/* Per-Scheme Financial Breakdown */}
              {stats.couponSummary.schemeBreakdown && stats.couponSummary.schemeBreakdown.length > 0 && (
                <div className="border-t border-slate-100 pt-4">
                  <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-3">Scheme-wise Breakdown</p>
                  <div className="space-y-2.5 max-h-[180px] overflow-y-auto pr-1 custom-scrollbar">
                    {stats.couponSummary.schemeBreakdown.map((sb, i) => {
                      const salesPct = sb.target > 0 ? Math.min(100, (sb.materialSale / sb.target) * 100) : 0
                      return (
                        <div key={i} className="bg-slate-50 rounded-xl p-3 border border-slate-100 hover:border-slate-200 transition-colors">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-slate-800">{sb.name}</span>
                              <span className="text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded-full font-semibold">{sb.total} stores</span>
                            </div>
                            <div className="flex items-center gap-2 text-[10px] font-semibold">
                              <span className="text-green-600">{sb.achieved} ✓</span>
                              <span className="text-amber-500">{sb.inProgress} ◌</span>
                              <span className="text-slate-400">{sb.notStarted} ○</span>
                            </div>
                          </div>
                          <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden mb-2">
                            <div className="h-full rounded-full bg-gradient-to-r from-primary-400 to-primary-600 transition-all" style={{ width: `${salesPct}%` }}></div>
                          </div>
                          <div className="grid grid-cols-4 gap-2 text-[10px]">
                            <div>
                              <span className="text-slate-400">Sale</span>
                              <p className="font-bold text-slate-700">{formatCompact(sb.materialSale)}</p>
                            </div>
                            <div>
                              <span className="text-green-500">Jama</span>
                              <p className="font-bold text-green-600">{formatCompact(sb.paymentJama)}</p>
                            </div>
                            <div>
                              <span className="text-red-400">Baki</span>
                              <p className="font-bold text-red-600">{formatCompact(sb.materialBaki)}</p>
                            </div>
                            <div>
                              <span className="text-orange-400">Balance</span>
                              <p className="font-bold text-orange-600">{formatCompact(sb.totalBalance)}</p>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-[320px] text-slate-400">
              <Ticket className="w-12 h-12 mb-3 text-slate-300" />
              <p className="text-sm font-medium">No coupon data available yet</p>
              <p className="text-xs mt-1">Issue coupons to see analytics here</p>
            </div>
          )}
        </div>

        {/* Expense Breakdown */}
        <div
          className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 animate-fadeIn"
          style={{ animationDelay: '500ms', animationFillMode: 'both' }}
        >
          <div className="mb-4">
            <h2 className="text-lg font-bold text-slate-800">Expense Breakdown</h2>
            <p className="text-xs text-slate-400 mt-0.5">Category-wise split</p>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={stats.expenseBreakdown || []}
                dataKey="total"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={95}
                innerRadius={50}
                paddingAngle={3}
                strokeWidth={2}
                stroke="#fff"
              >
                {(stats.expenseBreakdown || []).map((_, index) => (
                  <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<PieTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-2 space-y-1.5 max-h-[120px] overflow-y-auto">
            {(stats.expenseBreakdown || []).map((item, i) => (
              <div 
                key={i} 
                onClick={() => navigate('/expenses/all', { state: { search: item.name } })}
                className="flex items-center justify-between text-sm cursor-pointer hover:bg-slate-50 p-1.5 -mx-1.5 rounded-lg transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                  />
                  <span className="text-slate-600 truncate max-w-[120px]">{item.name}</span>
                </div>
                <span className="font-semibold text-slate-800">{formatCurrency(item.total)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top 5 Parties */}
        <div
          className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 animate-fadeIn"
          style={{ animationDelay: '600ms', animationFillMode: 'both' }}
        >
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-lg font-bold text-slate-800">Top Parties</h2>
              <p className="text-xs text-slate-400 mt-0.5">Highest purchasing dealers</p>
            </div>
            <Crown className="w-5 h-5 text-accent-500" />
          </div>
          <div className="space-y-3">
            {(stats.topParties || []).slice(0, 5).map((party, index) => (
              <div
                key={index}
                className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors"
              >
                <div className={`
                  w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold
                  ${index === 0 ? 'bg-accent-100 text-accent-700' :
                    index === 1 ? 'bg-slate-200 text-slate-600' :
                    index === 2 ? 'bg-orange-100 text-orange-600' :
                    'bg-slate-100 text-slate-500'}
                `}>
                  {index + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-700 truncate">{party.name}</p>
                </div>
                <span className="text-sm font-bold text-primary-700">{formatCurrency(party.total)}</span>
              </div>
            ))}
            {(!stats.topParties || stats.topParties.length === 0) && (
              <p className="text-sm text-slate-400 text-center py-4">No data available</p>
            )}
          </div>
        </div>

        {/* Recent Transactions */}
        <div
          className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 animate-fadeIn"
          style={{ animationDelay: '700ms', animationFillMode: 'both' }}
        >
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-lg font-bold text-slate-800">Recent Transactions</h2>
              <p className="text-xs text-slate-400 mt-0.5">Latest sale entries</p>
            </div>
            <FileText className="w-5 h-5 text-primary-500" />
          </div>
          <div className="space-y-3">
            {(stats.recentSales || []).slice(0, 5).map((sale) => (
              <div
                key={sale.id}
                className="flex items-center justify-between p-3 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-slate-700 truncate">{sale.party_name}</p>
                    {sale.invoice_no && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-primary-50 text-primary-600 rounded font-medium">
                        #{sale.invoice_no}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {new Date(sale.date).toLocaleDateString('en-IN', {
                      day: '2-digit', month: 'short', year: 'numeric'
                    })}
                  </p>
                </div>
                <div className="flex items-center gap-1 text-sm font-bold text-primary-700">
                  {formatCurrency(sale.total_amount)}
                  <ArrowUpRight className="w-3.5 h-3.5 text-primary-500" />
                </div>
              </div>
            ))}
            {(!stats.recentSales || stats.recentSales.length === 0) && (
              <p className="text-sm text-slate-400 text-center py-4">No recent transactions</p>
            )}
          </div>
        </div>
      </div>

      {/* Scheme Performance Analytics */}
      {stats.schemesAnalytics && stats.schemesAnalytics.length > 0 && (
        <div className="grid grid-cols-1 gap-6">
          <div
            className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 animate-fadeIn"
            style={{ animationDelay: '800ms', animationFillMode: 'both' }}
          >
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-bold text-slate-800">Scheme Performance Analytics</h2>
                <p className="text-xs text-slate-400 mt-0.5">Organic target achievement vs Coupons issued</p>
              </div>
              <Ticket className="w-5 h-5 text-emerald-500" />
            </div>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart
                data={stats.schemesAnalytics}
                margin={{ top: 5, right: 10, left: 10, bottom: 5 }}
                barCategoryGap="25%"
              >
                <defs>
                  <linearGradient id="achievedGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.9} />
                    <stop offset="100%" stopColor="#2563eb" stopOpacity={0.9} />
                  </linearGradient>
                  <linearGradient id="issuedGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.9} />
                    <stop offset="100%" stopColor="#059669" stopOpacity={0.9} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 12, fill: '#64748b' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                  width={30}
                />
                <Tooltip content={<SchemeTooltip />} cursor={{ fill: 'rgba(148,163,184,0.08)' }} />
                <Legend
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ paddingTop: 12, fontSize: 13 }}
                />
                <Bar
                  dataKey="enrolledCount"
                  name="Enrolled Stores"
                  fill="url(#issuedGradient)"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={40}
                  onClick={(data) => navigate('/schemes/coupons')}
                  cursor="pointer"
                />
                <Bar
                  dataKey="achievedCount"
                  name="Successfully Achieved Target"
                  fill="url(#achievedGradient)"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={40}
                  onClick={(data) => navigate('/schemes/coupons')}
                  cursor="pointer"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Store Target Progression */}
      {stats.schemesAnalytics && stats.schemesAnalytics.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 animate-fadeIn mt-6" style={{ animationDelay: '900ms', animationFillMode: 'both' }}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-lg font-bold text-slate-800">Store Target Progression</h2>
              <p className="text-xs text-slate-400 mt-0.5">Track how close stores are to achieving scheme targets</p>
            </div>
          </div>
          
          <div className="flex gap-2 overflow-x-auto pb-4 mb-2 -mx-2 px-2 snap-x">
            {stats.schemesAnalytics.map(s => (
               <button 
                  key={s.id}
                  onClick={() => setSelectedProgressSchemeId(s.id)}
                  className={`px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-colors snap-start ${
                    (selectedProgressSchemeId || stats.schemesAnalytics[0]?.id) === s.id 
                    ? 'bg-primary-600 text-white shadow-md shadow-primary-500/20' 
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
               >
                  {s.name}
               </button>
            ))}
          </div>
          
          <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
            {(() => {
              const currentId = selectedProgressSchemeId || stats.schemesAnalytics[0]?.id;
              const schemeData = stats.schemesAnalytics.find(s => s.id === currentId);
              if (!schemeData || !schemeData.partiesProgress || schemeData.partiesProgress.length === 0) {
                 return <p className="text-sm text-slate-400 text-center py-8">No active store progression for this scheme yet.</p>
              }
              return schemeData.partiesProgress.map((p, idx) => (
                <div key={p.party_id} className="p-4 rounded-xl border border-slate-100 bg-slate-50 hover:bg-slate-100 transition-colors">
                  <div className="flex justify-between items-end mb-2.5">
                    <div>
                      <h3 className="font-bold text-slate-800 text-sm">{idx + 1}. {p.party_name}</h3>
                      <p className="text-xs font-medium mt-1">
                        {p.achieved 
                          ? <span className="text-emerald-600 flex items-center gap-1">🎉 Target Achieved!</span> 
                          : <span className="text-slate-500">Needs <span className="text-amber-600 font-bold">{formatCurrency(p.remaining)}</span> more</span>}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-slate-800 text-sm">{formatCurrency(p.total_sales)}</span>
                      <span className="text-xs text-slate-400 ml-1 block mt-0.5">of {formatCurrency(p.target)}</span>
                    </div>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2 mb-1.5 overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-1000 ${p.achieved ? 'bg-emerald-500' : 'bg-primary-500'}`} 
                      style={{width: `${p.percentage}%`}}
                    ></div>
                  </div>
                  <div className="flex justify-end">
                    <span className={`text-[11px] font-bold ${p.achieved ? 'text-emerald-600' : 'text-primary-600'}`}>
                      {p.percentage.toFixed(1)}%
                    </span>
                  </div>
                </div>
              ));
            })()}
          </div>
        </div>
      )}

      {/* Detail Modals */}
      
      {/* Sales Modal */}
      <Modal isOpen={activeModal === 'sales'} onClose={() => setActiveModal(null)} title="Total Sales Breakdown" size="lg">
        <div className="max-h-[60vh] overflow-y-auto">
          <DataTable 
            columns={[
              { key: 'name', label: 'Party Name', sortable: true },
              { key: 'total', label: 'Amount (₹)', sortable: true, render: (val) => <span className="font-bold text-green-600">₹{Number(val || 0).toFixed(2)}</span> }
            ]}
            data={stats.salesList || []}
          />
        </div>
      </Modal>

      {/* Expenses Modal */}
      <Modal isOpen={activeModal === 'expenses'} onClose={() => setActiveModal(null)} title="Expense Breakdown" size="md">
        <div className="max-h-[60vh] overflow-y-auto">
          <DataTable 
            columns={[
              { key: 'name', label: 'Category', sortable: true },
              { key: 'total', label: 'Amount (₹)', sortable: true, render: (val) => <span className="font-bold text-red-600">₹{Number(val || 0).toFixed(2)}</span> }
            ]}
            data={stats.expenseBreakdown || []}
          />
        </div>
      </Modal>

      {/* Outstanding Modal */}
      <Modal isOpen={activeModal === 'outstanding'} onClose={() => setActiveModal(null)} title="Outstanding Balances" size="lg">
        <div className="max-h-[60vh] overflow-y-auto">
          <DataTable 
            columns={[
              { key: 'name', label: 'Party Name', sortable: true },
              { key: 'balance', label: 'Outstanding (₹)', sortable: true, render: (val) => <span className="font-bold text-amber-600">₹{Number(val || 0).toFixed(2)}</span> }
            ]}
            data={stats.outstandingList || []}
            onRowClick={(row) => row.id ? navigate(`/payments/ledger?party=${row.id}`) : null}
          />
        </div>
      </Modal>

      {/* Coupons Modal */}
      <Modal isOpen={activeModal === 'coupons'} onClose={() => setActiveModal(null)} title="Coupons Issued" size="lg">
        <div className="max-h-[60vh] overflow-y-auto">
          <DataTable 
            columns={[
              { key: 'coupon_no', label: 'Coupon No', sortable: true },
              { key: 'party_id', label: 'Party Name', sortable: true, render: (_, row) => row.parties?.name || 'Unknown' },
              { key: 'amount', label: 'Gift Amount (₹)', sortable: true, render: (val) => <span className="font-bold text-purple-600">₹{Number(val || 0).toFixed(2)}</span> }
            ]}
            data={stats.couponsList || []}
          />
        </div>
      </Modal>

      {/* Receipts Modal */}
      <Modal isOpen={activeModal === 'receipts'} onClose={() => setActiveModal(null)} title="Total Receipts Breakdown" size="lg">
        <div className="max-h-[60vh] overflow-y-auto">
          <DataTable 
            columns={[
              { key: 'name', label: 'Party Name', sortable: true },
              { key: 'total', label: 'Amount (₹)', sortable: true, render: (val) => <span className="font-bold text-blue-600">₹{Number(val || 0).toFixed(2)}</span> }
            ]}
            data={stats.receiptsList || []}
            onRowClick={(row) => row.id ? navigate(`/payments/ledger?party=${row.id}`) : null}
          />
        </div>
      </Modal>

    </div>
  )
}
