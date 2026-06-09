import { useState, useEffect, useContext } from 'react'
import { SeasonContext } from '../../context/SeasonContext'
import LoadingSpinner from '../../components/LoadingSpinner'
import EmptyState from '../../components/EmptyState'
import { 
  BarChart, Bar, PieChart, Pie, Cell, 
  XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, 
  ResponsiveContainer 
} from 'recharts'
import { LineChart, PieChart as PieChartIcon, AlertTriangle, TrendingUp, DollarSign, Package, Printer, Search, Users, Clock } from 'lucide-react'
import Modal from '../../components/Modal'
import DataTable from '../../components/DataTable'
import { formatDate } from '../../lib/dateUtils'
import { printHTML } from '../../lib/printUtils'

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
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [productSales, setProductSales] = useState([])
  const [sortBy, setSortBy] = useState('date')
  const [viewMode, setViewMode] = useState('timeline') // 'timeline' or 'summary'
  const [searchQuery, setSearchQuery] = useState('')
  const [modalLoading, setModalLoading] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)

  const handleProductClick = async (productName) => {
    if (!productName) return;
    setSelectedProduct(productName);
    setIsModalOpen(true);
    setModalLoading(true);
    setViewMode('timeline');
    setSearchQuery('');
    try {
      const salesData = await window.db.invoke('analytics:getProductSales', activeSeason.id, productName);
      setProductSales(salesData || []);
    } catch (err) {
      console.error('Failed to load product sales', err);
    } finally {
      setModalLoading(false);
    }
  };

  const sortedProductSales = [...productSales].sort((a, b) => {
    if (sortBy === 'party') {
      return (a.party_name || '').localeCompare(b.party_name || '');
    }
    return new Date(b.date) - new Date(a.date);
  });

  const filteredProductSales = sortedProductSales.filter(s => 
    (s.party_name || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const partySummaryMap = {};
  productSales.forEach(sale => {
    const party = sale.party_name || 'Unknown';
    if (!partySummaryMap[party]) {
      partySummaryMap[party] = { party_name: party, qty: 0, amount: 0 };
    }
    partySummaryMap[party].qty += Number(sale.qty || 0);
    partySummaryMap[party].amount += Number(sale.amount || 0);
  });

  const partySummaryData = Object.values(partySummaryMap)
    .sort((a, b) => b.qty - a.qty)
    .filter(s => s.party_name.toLowerCase().includes(searchQuery.toLowerCase()));

  const handlePrintProductSales = async () => {
    let html = '';

    if (viewMode === 'timeline') {
      const tableRows = filteredProductSales.map(row => `
        <tr>
          <td style="padding: 12px 8px; border-bottom: 1px solid #e2e8f0; color: #334155;">${formatDate(row.date)}</td>
          <td style="padding: 12px 8px; border-bottom: 1px solid #e2e8f0; color: #475569;">${row.invoice_no || '-'}</td>
          <td style="padding: 12px 8px; border-bottom: 1px solid #e2e8f0; font-weight: 500; color: #1e293b;">${row.party_name || '-'}</td>
          <td style="padding: 12px 8px; border-bottom: 1px solid #e2e8f0; font-weight: bold; color: #0f172a;">${row.qty}</td>
          <td style="padding: 12px 8px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: bold; color: #10b981;">${formatCurrency(row.amount)}</td>
        </tr>
      `).join('');

      html = `
        <div style="font-family: 'Inter', Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 40px;">
          <div style="text-align: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 30px;">
            <h1 style="color: #0f172a; margin: 0 0 8px 0; font-size: 28px; font-weight: 800;">Product Intelligence Report</h1>
            <h2 style="color: #64748b; margin: 0; font-size: 18px; font-weight: 500;">Timeline View: <span style="color: #3b82f6;">${selectedProduct}</span></h2>
          </div>
          <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 14px;">
            <thead>
              <tr style="background-color: #f8fafc;">
                <th style="padding: 12px 8px; border-bottom: 2px solid #cbd5e1; color: #64748b; font-weight: 600;">Date</th>
                <th style="padding: 12px 8px; border-bottom: 2px solid #cbd5e1; color: #64748b; font-weight: 600;">Invoice No</th>
                <th style="padding: 12px 8px; border-bottom: 2px solid #cbd5e1; color: #64748b; font-weight: 600;">Party Name</th>
                <th style="padding: 12px 8px; border-bottom: 2px solid #cbd5e1; color: #64748b; font-weight: 600;">Qty</th>
                <th style="padding: 12px 8px; border-bottom: 2px solid #cbd5e1; text-align: right; color: #64748b; font-weight: 600;">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows}
              ${filteredProductSales.length === 0 ? '<tr><td colspan="5" style="text-align:center; padding: 30px; color: #94a3b8;">No data available.</td></tr>' : ''}
            </tbody>
          </table>
          <div style="margin-top: 40px; font-size: 12px; color: #94a3b8; text-align: center;">
            Generated from Amrut Finance Advanced Analytics Hub
          </div>
        </div>
      `;
    } else {
      const totalQty = partySummaryData.reduce((sum, row) => sum + row.qty, 0);
      const totalAmt = partySummaryData.reduce((sum, row) => sum + row.amount, 0);
      
      const tableRows = partySummaryData.map(row => `
        <tr>
          <td style="padding: 14px 12px; border-bottom: 1px solid #e2e8f0; font-weight: 600; color: #1e293b;">${row.party_name}</td>
          <td style="padding: 14px 12px; border-bottom: 1px solid #e2e8f0; font-weight: bold; color: #4f46e5;">${row.qty}</td>
          <td style="padding: 14px 12px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: bold; color: #10b981;">${formatCurrency(row.amount)}</td>
        </tr>
      `).join('');

      html = `
        <div style="font-family: 'Inter', Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 40px;">
          <div style="text-align: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 30px;">
            <h1 style="color: #0f172a; margin: 0 0 8px 0; font-size: 28px; font-weight: 800;">Party Intelligence Summary</h1>
            <h2 style="color: #64748b; margin: 0; font-size: 18px; font-weight: 500;">Product: <span style="color: #3b82f6;">${selectedProduct}</span></h2>
          </div>
          <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 15px;">
            <thead>
              <tr style="background-color: #f8fafc;">
                <th style="padding: 14px 12px; border-bottom: 2px solid #cbd5e1; color: #64748b; font-weight: 700;">Party Name</th>
                <th style="padding: 14px 12px; border-bottom: 2px solid #cbd5e1; color: #64748b; font-weight: 700;">Total Bags Bought</th>
                <th style="padding: 14px 12px; border-bottom: 2px solid #cbd5e1; text-align: right; color: #64748b; font-weight: 700;">Total Value</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows}
              ${partySummaryData.length === 0 ? '<tr><td colspan="3" style="text-align:center; padding: 30px; color: #94a3b8;">No data available.</td></tr>' : ''}
            </tbody>
            ${partySummaryData.length > 0 ? `
            <tfoot>
              <tr style="background-color: #f1f5f9;">
                <td style="padding: 16px 12px; font-weight: 800; color: #0f172a;">GRAND TOTAL</td>
                <td style="padding: 16px 12px; font-weight: 800; color: #4f46e5;">${totalQty}</td>
                <td style="padding: 16px 12px; text-align: right; font-weight: 800; color: #10b981;">${formatCurrency(totalAmt)}</td>
              </tr>
            </tfoot>
            ` : ''}
          </table>
          <div style="margin-top: 40px; font-size: 12px; color: #94a3b8; text-align: center;">
            Generated from Amrut Finance Advanced Analytics Hub
          </div>
        </div>
      `;
    }

    try {
      await printHTML(html);
    } catch (err) {
      console.error('Print failed', err);
    }
  };

  const productColumns = [
    { key: 'date', label: 'Date', render: (val) => formatDate(val) },
    { key: 'invoice_no', label: 'Invoice No' },
    { key: 'party_name', label: 'Party Name' },
    { key: 'qty', label: 'Qty', render: (val) => <span className="font-semibold">{val}</span> },
    { key: 'amount', label: 'Amount', render: (val) => <span className="font-semibold text-emerald-600">{formatCurrency(val)}</span> }
  ];

  const summaryColumns = [
    { key: 'party_name', label: 'Party Name', render: (val) => <span className="font-semibold text-slate-800">{val}</span> },
    { key: 'qty', label: 'Total Bags Bought', render: (val) => <span className="font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-md">{val}</span> },
    { key: 'amount', label: 'Total Value', render: (val) => <span className="font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-md">{formatCurrency(val)}</span> }
  ];

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
              <Bar 
                dataKey="revenue" 
                name="Revenue" 
                fill="#10b981" 
                radius={[0, 4, 4, 0]} 
                barSize={20} 
                onClick={(data) => handleProductClick(data.name)} 
                style={{ cursor: 'pointer' }}
              />
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
                  {(data.topProductsByVol || []).map((entry, index) => (
                    <Cell 
                      key={index} 
                      fill={COLORS[index % COLORS.length]} 
                      onClick={() => handleProductClick(entry.name)}
                      style={{ cursor: 'pointer' }}
                    />
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

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={`Intelligence - ${selectedProduct}`}
        size="4xl"
      >
        <div className="flex flex-col gap-4 mb-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            {/* View Toggle */}
            <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
              <button
                onClick={() => setViewMode('timeline')}
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-semibold transition-all ${viewMode === 'timeline' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <Clock className="w-4 h-4" /> Timeline View
              </button>
              <button
                onClick={() => setViewMode('summary')}
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-semibold transition-all ${viewMode === 'summary' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <Users className="w-4 h-4" /> Party Summary
              </button>
            </div>

            {/* Actions: Search & Print */}
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  type="text"
                  placeholder="Search party..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-4 py-2 w-64 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                />
              </div>

              {viewMode === 'timeline' && (
                <div className="flex items-center gap-2">
                  <select 
                    value={sortBy} 
                    onChange={(e) => setSortBy(e.target.value)}
                    className="border border-slate-200 rounded-lg text-sm px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="date">Sort by Date</option>
                    <option value="party">Sort A-Z</option>
                  </select>
                </div>
              )}

              <button 
                onClick={handlePrintProductSales}
                className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-sm font-bold transition-all shadow-sm"
              >
                <Printer className="w-4 h-4" /> Print Report
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl overflow-hidden border border-slate-200 shadow-sm">
          {viewMode === 'timeline' ? (
            <DataTable
              columns={productColumns}
              data={filteredProductSales}
              loading={modalLoading}
              emptyMessage="No sales recorded matching your search."
              searchable={false}
            />
          ) : (
            <DataTable
              columns={summaryColumns}
              data={filteredSummary}
              loading={modalLoading}
              emptyMessage="No parties found matching your search."
              searchable={false}
            />
          )}
        </div>
      </Modal>
    </div>
  )
}
