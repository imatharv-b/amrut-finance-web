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
  const gap = data.achievedCount - data.couponsCount
  
  let statusText = gap === 0 ? "Perfectly matched" : (gap > 0 ? `Missing ${gap} coupons` : `Over-issued ${Math.abs(gap)} coupons`)
  let statusColor = gap === 0 ? "text-green-600" : (gap > 0 ? "text-amber-600" : "text-red-600")

  return (
    <div className="bg-white rounded-xl shadow-lg border border-slate-100 px-4 py-3 min-w-[200px]">
      <p className="text-sm font-bold text-slate-800 mb-1">{label}</p>
      <p className="text-xs text-slate-500 mb-3">Target: {formatCurrency(data.target)}</p>
      
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
            <span className="text-slate-600">Stores Achieved:</span>
          </div>
          <span className="font-semibold text-slate-800">{data.achievedCount}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span className="text-slate-600">Coupons Issued:</span>
          </div>
          <span className="font-semibold text-slate-800">{data.couponsCount}</span>
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
    { title: 'Net Balance', value: formatCurrency(stats.netBalance), icon: TrendingUp, color: 'purple', onClick: null }, // Net balance is a computed stat, no specific list
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
        {/* Monthly Sales vs Expenses */}
        <div
          className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-100 p-6 animate-fadeIn"
          style={{ animationDelay: '400ms', animationFillMode: 'both' }}
        >
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-bold text-slate-800">Monthly Sales vs Expenses</h2>
              <p className="text-xs text-slate-400 mt-0.5">Month-wise comparison</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart
              data={stats.monthlySalesExpenses || []}
              margin={{ top: 5, right: 10, left: 10, bottom: 5 }}
              barCategoryGap="20%"
            >
              <defs>
                <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#22c55e" stopOpacity={0.9} />
                  <stop offset="100%" stopColor="#15803d" stopOpacity={0.9} />
                </linearGradient>
                <linearGradient id="expenseGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f87171" stopOpacity={0.9} />
                  <stop offset="100%" stopColor="#dc2626" stopOpacity={0.9} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 12, fill: '#64748b' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={formatCompact}
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                axisLine={false}
                tickLine={false}
                width={55}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(148,163,184,0.08)' }} />
              <Legend
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ paddingTop: 12, fontSize: 13 }}
              />
              <Bar
                dataKey="sales"
                name="Sales"
                fill="url(#salesGradient)"
                radius={[6, 6, 0, 0]}
                maxBarSize={40}
              />
              <Bar
                dataKey="expenses"
                name="Expenses"
                fill="url(#expenseGradient)"
                radius={[6, 6, 0, 0]}
                maxBarSize={40}
              />
            </BarChart>
          </ResponsiveContainer>
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
                  dataKey="achievedCount"
                  name="Stores Achieved Target"
                  fill="url(#achievedGradient)"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={40}
                  onClick={(data) => navigate('/schemes/coupons')}
                  cursor="pointer"
                />
                <Bar
                  dataKey="couponsCount"
                  name="Coupons Issued"
                  fill="url(#issuedGradient)"
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
