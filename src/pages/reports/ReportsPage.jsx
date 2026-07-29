import React, { useState, useEffect, useRef } from 'react';
import { FileBarChart2, Search, Printer, Download, ChevronDown, ChevronRight, Gift, Tag, TrendingUp, Target, Package, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ReportsPage({ defaultReport = 'outstanding' }) {
  const [seasons, setSeasons] = useState([]);
  const [selectedSeason, setSelectedSeason] = useState('');
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);

  const [reportType, setReportType] = useState(defaultReport);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [expenseTypes, setExpenseTypes] = useState([]);
  const [selectedExpenseType, setSelectedExpenseType] = useState('');
  
  const [products, setProducts] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState('');
  
  const [parties, setParties] = useState([]);
  const [selectedParty, setSelectedParty] = useState('');
  const [expandedSchemes, setExpandedSchemes] = useState({});
  const [expandedCoupons, setExpandedCoupons] = useState({});
  
  useEffect(() => {
    loadSeasons();
    loadExpenseTypes();
    loadProductsAndParties();
  }, []);

  useEffect(() => {
    if (selectedSeason) {
      generateReport();
    }
  }, [selectedSeason]);

  const loadSeasons = async () => {
    try {
      const data = await window.db.invoke('seasons:getAll');
      setSeasons(data || []);
      if (data && data.length > 0) {
        const active = data.find(s => s.is_active);
        setSelectedSeason(active ? active.id : data[0].id);
      }
    } catch (err) {
      toast.error('Failed to load seasons');
    }
  };

  const loadExpenseTypes = async () => {
    try {
      const types = await window.db.invoke('expenseTypes:getAll');
      setExpenseTypes(types || []);
    } catch (err) {
      console.error(err);
    }
  };

  const loadProductsAndParties = async () => {
    try {
      const [prodData, partyData] = await Promise.all([
        window.db.invoke('products:getAll'),
        window.db.invoke('parties:getAll')
      ]);
      setProducts(prodData || []);
      setParties(partyData || []);
    } catch (err) {
      console.error(err);
    }
  };

  const generateReport = async () => {
    setLoading(true);
    try {
      if (reportType === 'outstanding') {
        const sales = await window.db.invoke('sales:getAll', { season_id: selectedSeason });
        const partyData = {};

        sales.forEach(sale => {
          if (!partyData[sale.party_id]) {
            partyData[sale.party_id] = {
              id: sale.party_id,
              name: sale.party_name,
              village: sale.party_village || '',
              total_sales: 0,
              amount_paid: 0,
              balance: 0
            };
          }
          partyData[sale.party_id].total_sales += sale.total_amount;
          partyData[sale.party_id].amount_paid += sale.amount_paid;
          partyData[sale.party_id].balance += (sale.total_amount - sale.amount_paid);
        });

        const reportArray = Object.values(partyData).sort((a, b) => b.balance - a.balance);
        
        setReportData({
          type: 'outstanding',
          parties: reportArray,
          total_sales: reportArray.reduce((acc, p) => acc + p.total_sales, 0),
          total_balance: reportArray.reduce((acc, p) => acc + p.balance, 0)
        });
      } else if (reportType === 'expense') {
        const filters = { season_id: selectedSeason };
        if (fromDate) filters.from_date = fromDate;
        if (toDate) filters.to_date = toDate;
        if (selectedExpenseType) filters.expense_type_id = selectedExpenseType;

        const expenses = await window.db.invoke('expenses:getAll', filters);
        setReportData({
          type: 'expense',
          expenses: expenses,
          total_amount: expenses.reduce((acc, e) => acc + (Number(e.amount) || 0), 0)
        });
      } else if (reportType === 'coupon') {
        const result = await window.db.invoke('reports:couponAnalytics', selectedSeason);
        setReportData({
          type: 'coupon',
          ...result
        });
        // Auto-expand all schemes
        const expanded = {};
        (result.schemes || []).forEach(s => { expanded[s.id] = true; });
        setExpandedSchemes(expanded);
        setExpandedCoupons({});
      } else if (reportType === 'batch_manufacturing') {
        if (!selectedProduct) { toast.error('Please select a product'); return; }
        const data = await window.db.invoke('reports:batchManufacturing', { productId: selectedProduct, fromDate, toDate });
        setReportData({
          type: 'batch_manufacturing',
          rows: data
        });
      } else if (reportType === 'party_schemes') {
        if (!selectedParty) { toast.error('Please select a party'); return; }
        const data = await window.db.invoke('reports:partySchemeLedger', selectedParty);
        setReportData({
          type: 'party_schemes',
          rows: data
        });
      }
    } catch (err) {
      toast.error('Failed to generate report: ' + (err.message || err));
      setReportData(null);
    } finally {
      setLoading(false);
    }
  };

  const selectedSeasonObj = seasons.find(s => s.id === Number(selectedSeason));

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Compact sticky toolbar */}
      <div className="bg-white border-b border-slate-200 px-3 py-2 sm:px-4 sm:py-2.5 flex flex-wrap gap-2 sm:gap-3 items-center shrink-0 z-20">
        <select
          value={reportType}
          onChange={(e) => {
            setReportType(e.target.value);
            setReportData(null);
          }}
          className="px-2.5 py-1.5 sm:px-3 sm:py-2 border border-slate-300 rounded-lg text-sm font-medium bg-white focus:ring-2 focus:ring-primary-500 outline-none"
        >
          <option value="outstanding">Outstanding</option>
          <option value="expense">Expenses</option>
          <option value="coupon">Coupon Analytics</option>
          <option value="batch_manufacturing">Batch Mfg.</option>
          <option value="party_schemes">Party Schemes</option>
        </select>

        <select
          value={selectedSeason}
          onChange={(e) => setSelectedSeason(e.target.value)}
          className="px-2.5 py-1.5 sm:px-3 sm:py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-primary-500 outline-none max-w-[180px]"
        >
          {seasons.map(s => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>

        {reportType === 'batch_manufacturing' && (
          <select
            value={selectedProduct}
            onChange={e => setSelectedProduct(e.target.value)}
            className="px-2.5 py-1.5 sm:px-3 sm:py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-primary-500 outline-none max-w-[180px]"
          >
            <option value="">Select Product...</option>
            {products.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        )}

        {reportType === 'party_schemes' && (
          <select
            value={selectedParty}
            onChange={e => setSelectedParty(e.target.value)}
            className="px-2.5 py-1.5 sm:px-3 sm:py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-primary-500 outline-none max-w-[180px]"
          >
            <option value="">Select Party...</option>
            {parties.map(p => (
              <option key={p.id} value={p.id}>{p.name} {p.village ? `(${p.village})` : ''}</option>
            ))}
          </select>
        )}

        {(reportType === 'expense' || reportType === 'batch_manufacturing') && (
          <>
            <input
              type="date"
              value={fromDate}
              onChange={e => setFromDate(e.target.value)}
              className="px-2 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none w-[130px]"
              placeholder="From"
            />
            <input
              type="date"
              value={toDate}
              onChange={e => setToDate(e.target.value)}
              className="px-2 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none w-[130px]"
              placeholder="To"
            />
          </>
        )}
        {reportType === 'expense' && (
          <select
            value={selectedExpenseType}
            onChange={e => setSelectedExpenseType(e.target.value)}
            className="px-2.5 py-1.5 sm:px-3 sm:py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-primary-500 outline-none max-w-[160px]"
          >
            <option value="">All Expenses</option>
            {expenseTypes.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        )}

        <button
          onClick={generateReport}
          disabled={loading || (reportType !== 'batch_manufacturing' && reportType !== 'party_schemes' && !selectedSeason)}
          className="px-3 py-1.5 sm:px-4 sm:py-2 bg-primary-700 hover:bg-primary-800 text-white rounded-lg text-sm font-medium transition flex items-center disabled:opacity-50"
        >
          <Search className="w-3.5 h-3.5 mr-1.5" />
          Generate
        </button>
        
        {reportData && (
          <button
            className="px-3 py-1.5 sm:px-4 sm:py-2 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg text-sm font-medium transition flex items-center ml-auto"
            onClick={() => window.print()}
          >
            <Printer className="w-3.5 h-3.5 mr-1.5" />
            Print
          </button>
        )}
      </div>

      {/* Full-height report content */}
      <div className="flex-1 overflow-auto bg-white border-t-0 print-area print:overflow-visible print:h-auto">
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center p-12">
            <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mb-4"></div>
            <p className="text-slate-500">Generating report...</p>
          </div>
        ) : !reportData ? (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-slate-500">
            <FileBarChart2 className="w-12 h-12 mb-4 text-slate-300" />
            <p className="text-lg">Select report type and click Generate</p>
          </div>
        ) : (
          <>
            {reportData.type === 'coupon' ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 p-4 sm:p-6 border-b border-slate-200 bg-gradient-to-br from-slate-50 to-white">
                <div className="bg-white rounded-xl p-3 sm:p-4 border border-slate-200 shadow-sm">
                  <div className="flex items-center gap-2 text-slate-500 mb-1">
                    <Gift size={16} className="text-primary-500" />
                    <span className="text-xs font-medium uppercase tracking-wider">Schemes</span>
                  </div>
                  <p className="text-2xl font-black text-slate-800">{reportData.summary?.totalSchemes || 0}</p>
                </div>
                <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
                  <div className="flex items-center gap-2 text-slate-500 mb-1">
                    <Tag size={16} className="text-blue-500" />
                    <span className="text-xs font-medium uppercase tracking-wider">Coupons Issued</span>
                  </div>
                  <p className="text-2xl font-black text-slate-800">{reportData.summary?.totalCoupons || 0}</p>
                </div>
                <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
                  <div className="flex items-center gap-2 text-slate-500 mb-1">
                    <TrendingUp size={16} className="text-green-500" />
                    <span className="text-xs font-medium uppercase tracking-wider">Total Sales</span>
                  </div>
                  <p className="text-2xl font-black text-green-700">₹{(reportData.summary?.totalSales || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                </div>
                <div className="bg-white rounded-xl p-3 sm:p-4 border border-slate-200 shadow-sm">
                  <div className="flex items-center gap-2 text-slate-500 mb-1">
                    <Target size={16} className="text-orange-500" />
                    <span className="text-[10px] sm:text-xs font-medium uppercase tracking-wider">Target</span>
                  </div>
                  <p className="text-lg sm:text-2xl font-black text-slate-800">₹{(reportData.summary?.totalTarget || 0).toLocaleString('en-IN', { minimumFractionDigits: 0 })}</p>
                  <div className="mt-2 h-1.5 sm:h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-primary-500 to-green-500 rounded-full transition-all" style={{ width: `${Math.min(100, reportData.summary?.totalTarget > 0 ? (reportData.summary.totalSales / reportData.summary.totalTarget) * 100 : 0)}%` }}></div>
                  </div>
                  <p className="text-[10px] sm:text-[11px] text-slate-500 mt-1">{reportData.summary?.totalTarget > 0 ? ((reportData.summary.totalSales / reportData.summary.totalTarget) * 100).toFixed(1) : 0}% achieved</p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-6 border-b border-slate-200 bg-slate-50">
                <div>
                  <p className="text-sm text-slate-500">Season</p>
                  <p className="text-lg font-bold text-slate-800">{selectedSeasonObj?.name}</p>
                  <p className="text-xs text-slate-500">{selectedSeasonObj?.start_date} to {selectedSeasonObj?.end_date}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-slate-500">
                    {reportData.type === 'outstanding' ? 'Total Season Outstanding' : reportData.type === 'expense' ? 'Total Expense Amount' : reportData.type === 'batch_manufacturing' ? 'Total Batches' : 'Total Schemes'}
                  </p>
                  <p className="text-2xl font-bold text-slate-800">
                    {reportData.type === 'outstanding' ? `₹${reportData.total_balance.toFixed(2)}` : reportData.type === 'expense' ? `₹${reportData.total_amount.toFixed(2)}` : reportData.type === 'batch_manufacturing' || reportData.type === 'party_schemes' ? reportData.rows.length : '—'}
                  </p>
                </div>
              </div>
            )}

            <div className="flex-1 overflow-auto p-0 print:overflow-visible print:h-auto">
              {reportData.type === 'outstanding' ? (
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-slate-100 text-slate-600 font-medium sticky top-0 z-10 shadow-sm">
                    <tr>
                      <th className="px-6 py-3 border-b border-slate-200 w-16">Sr No</th>
                      <th className="px-6 py-3 border-b border-slate-200">Krishi Kendra (Party)</th>
                      <th className="px-6 py-3 border-b border-slate-200">Village</th>
                      <th className="px-6 py-3 border-b border-slate-200 text-right">Total Sales (₹)</th>
                      <th className="px-6 py-3 border-b border-slate-200 text-right">Paid (₹)</th>
                      <th className="px-6 py-3 border-b border-slate-200 text-right">Outstanding Balance (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {reportData.parties.map((party, index) => (
                      <tr key={party.id} className="hover:bg-slate-50 transition">
                        <td className="px-6 py-3 text-slate-500">{index + 1}</td>
                        <td className="px-6 py-3 font-medium text-slate-800">{party.name}</td>
                        <td className="px-6 py-3 text-slate-600">{party.village || '-'}</td>
                        <td className="px-6 py-3 text-right">{party.total_sales.toFixed(2)}</td>
                        <td className="px-6 py-3 text-right">{party.amount_paid.toFixed(2)}</td>
                        <td className="px-6 py-3 text-right font-bold text-red-600">
                          {party.balance > 0 ? party.balance.toFixed(2) : '-'}
                        </td>
                      </tr>
                    ))}
                    {reportData.parties.length === 0 && (
                      <tr>
                        <td colSpan="6" className="px-6 py-8 text-center text-slate-500">
                          No pending balances found for this season.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              ) : reportData.type === 'expense' ? (
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-slate-100 text-slate-600 font-medium sticky top-0 z-10 shadow-sm">
                    <tr>
                      <th className="px-6 py-3 border-b border-slate-200 w-16">Sr No</th>
                      <th className="px-6 py-3 border-b border-slate-200">Date</th>
                      <th className="px-6 py-3 border-b border-slate-200">Expense Type</th>
                      <th className="px-6 py-3 border-b border-slate-200">Paid To / Party</th>
                      <th className="px-6 py-3 border-b border-slate-200">Description</th>
                      <th className="px-6 py-3 border-b border-slate-200">Mode</th>
                      <th className="px-6 py-3 border-b border-slate-200 text-right">Amount (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {reportData.expenses.map((expense, index) => (
                      <tr key={expense.id} className="hover:bg-slate-50 transition">
                        <td className="px-6 py-3 text-slate-500">{index + 1}</td>
                        <td className="px-6 py-3 text-slate-800">{expense.date}</td>
                        <td className="px-6 py-3 font-medium text-slate-800">{expense.type_name || 'General'}</td>
                        <td className="px-6 py-3 text-slate-600">{expense.party_name || expense.paid_to || '-'}</td>
                        <td className="px-6 py-3 text-slate-500">{expense.description || '-'}</td>
                        <td className="px-6 py-3 text-slate-600">{expense.payment_mode}</td>
                        <td className="px-6 py-3 text-right font-bold text-red-600">
                          {(Number(expense.amount) || 0).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                    {reportData.expenses.length === 0 && (
                      <tr>
                        <td colSpan="7" className="px-6 py-8 text-center text-slate-500">
                          No expenses found for these criteria.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              ) : reportData.type === 'batch_manufacturing' ? (
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-slate-100 text-slate-600 font-medium sticky top-0 z-10 shadow-sm">
                    <tr>
                      <th className="px-6 py-3 border-b border-slate-200">Date</th>
                      <th className="px-6 py-3 border-b border-slate-200">Party</th>
                      <th className="px-6 py-3 border-b border-slate-200">Bill/Vch No.</th>
                      <th className="px-6 py-3 border-b border-slate-200 text-right">Qty</th>
                      <th className="px-6 py-3 border-b border-slate-200">Unit</th>
                      <th className="px-6 py-3 border-b border-slate-200">Batch No</th>
                      <th className="px-6 py-3 border-b border-slate-200">Mfg Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {reportData.rows.map((row, index) => (
                      <tr key={index} className="hover:bg-slate-50 transition">
                        <td className="px-6 py-3 text-slate-600">{row.date}</td>
                        <td className="px-6 py-3 font-medium text-slate-800">{row.party_name} {row.party_village ? `(${row.party_village})` : ''}</td>
                        <td className="px-6 py-3 text-slate-600">{row.invoice_no}</td>
                        <td className="px-6 py-3 text-right text-slate-800">{row.qty}</td>
                        <td className="px-6 py-3 text-slate-500">{row.unit}</td>
                        <td className="px-6 py-3 text-slate-800">{row.batch_no || '-'}</td>
                        <td className="px-6 py-3 text-slate-500">{row.mfg_date || '-'}</td>
                      </tr>
                    ))}
                    {reportData.rows.length === 0 && (
                      <tr>
                        <td colSpan="7" className="px-6 py-8 text-center text-slate-500">
                          No manufacturing records found for this product.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              ) : reportData.type === 'party_schemes' ? (
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-slate-100 text-slate-600 font-medium sticky top-0 z-10 shadow-sm">
                    <tr>
                      <th className="px-6 py-3 border-b border-slate-200">Season</th>
                      <th className="px-6 py-3 border-b border-slate-200">Scheme</th>
                      <th className="px-6 py-3 border-b border-slate-200 text-right">Target (₹)</th>
                      <th className="px-6 py-3 border-b border-slate-200 text-right">Total Sales (₹)</th>
                      <th className="px-6 py-3 border-b border-slate-200 text-right">Total Paid (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {reportData.rows.map((row, index) => (
                      <tr key={index} className="hover:bg-slate-50 transition">
                        <td className="px-6 py-3 font-medium text-slate-800">{row.season_name}</td>
                        <td className="px-6 py-3 text-slate-600">{row.scheme_name}</td>
                        <td className="px-6 py-3 text-right text-slate-600">{row.target_amount.toFixed(2)}</td>
                        <td className="px-6 py-3 text-right font-medium text-slate-800">{row.total_sales.toFixed(2)}</td>
                        <td className="px-6 py-3 text-right text-green-600">{row.total_payments.toFixed(2)}</td>
                      </tr>
                    ))}
                    {reportData.rows.length === 0 && (
                      <tr>
                        <td colSpan="5" className="px-6 py-8 text-center text-slate-500">
                          No scheme records found for this party.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              ) : reportData.type === 'coupon' ? (
                <div className="p-4 space-y-4">
                  {(reportData.schemes || []).length === 0 ? (
                    <div className="text-center py-12 text-slate-500">
                      <Gift size={48} className="mx-auto text-slate-300 mb-3" />
                      <p className="text-lg font-medium">No schemes found for this season.</p>
                      <p className="text-sm mt-1">Create a scheme and issue coupons to see analytics here.</p>
                    </div>
                  ) : (
                    (reportData.schemes || []).map(scheme => (
                      <div key={scheme.id} className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                        {/* Scheme Header */}
                        <button
                          onClick={() => setExpandedSchemes(prev => ({ ...prev, [scheme.id]: !prev[scheme.id] }))}
                          className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-slate-50 to-white hover:from-slate-100 hover:to-slate-50 transition-colors"
                        >
                          <div className="flex items-center gap-3 text-left">
                            <div className="w-10 h-10 rounded-xl bg-primary-100 text-primary-700 flex items-center justify-center font-bold text-sm">
                              <Gift size={20} />
                            </div>
                            <div>
                              <h3 className="font-bold text-slate-800 text-base flex flex-wrap items-center gap-2">
                                {scheme.name} <span className="text-sm text-slate-700 font-bold bg-slate-100 px-3 py-1 rounded-md border border-slate-200 shadow-sm">Target: ₹{scheme.target_per_coupon.toLocaleString('en-IN')}</span>
                              </h3>
                              <p className="text-xs text-slate-500">
                                {scheme.benefit_description ? `${scheme.benefit_description} • ` : ''}{scheme.total_coupons} coupons
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-6">
                            <div className="hidden md:flex items-center gap-4">
                              <div className="text-right">
                                <p className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">Sales / Target</p>
                                <p className="text-sm font-bold text-slate-800">₹{scheme.total_sales.toLocaleString('en-IN')} / ₹{scheme.total_target.toLocaleString('en-IN')}</p>
                              </div>
                              <div className="w-24">
                                <div className="h-2.5 bg-slate-200 rounded-full overflow-hidden">
                                  <div className={`h-full rounded-full transition-all ${scheme.completion_pct >= 100 ? 'bg-green-500' : scheme.completion_pct >= 50 ? 'bg-blue-500' : 'bg-orange-400'}`} style={{ width: `${Math.min(100, scheme.completion_pct)}%` }}></div>
                                </div>
                                <p className="text-[10px] text-slate-500 mt-0.5 text-center">{scheme.completion_pct.toFixed(1)}%</p>
                              </div>
                              <div className="flex gap-1">
                                <span className="px-1.5 py-0.5 bg-green-100 text-green-700 rounded text-[10px] font-bold">{scheme.achieved}✓</span>
                                <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-[10px] font-bold">{scheme.in_progress}⏳</span>
                                <span className="px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded text-[10px] font-bold">{scheme.not_started}○</span>
                              </div>
                            </div>
                            {expandedSchemes[scheme.id] ? <ChevronDown size={20} className="text-slate-400" /> : <ChevronRight size={20} className="text-slate-400" />}
                          </div>
                        </button>

                        {/* Scheme Expanded Content */}
                        {expandedSchemes[scheme.id] && (
                          <div className="border-t border-slate-200">
                            {/* Mobile summary */}
                            <div className="md:hidden p-3 bg-slate-50 grid grid-cols-3 gap-2 text-center text-xs border-b border-slate-100">
                              <div><span className="text-slate-400">Sales</span><br/><span className="font-bold">₹{scheme.total_sales.toLocaleString('en-IN')}</span></div>
                              <div><span className="text-slate-400">Target</span><br/><span className="font-bold">₹{scheme.total_target.toLocaleString('en-IN')}</span></div>
                              <div><span className="text-slate-400">Remaining</span><br/><span className="font-bold text-red-600">₹{scheme.total_remaining.toLocaleString('en-IN')}</span></div>
                            </div>
                            <div className="hidden md:block overflow-x-auto">
                              <table className="w-full text-sm text-left">
                                <thead className="bg-slate-100 text-slate-600 font-medium text-xs uppercase tracking-wider">
                                <tr>
                                  <th className="px-4 py-2.5 w-8"></th>
                                  <th className="px-4 py-2.5">Coupon No</th>
                                  <th className="px-4 py-2.5">Party (Krishi Kendra)</th>
                                  <th className="px-4 py-2.5 text-right text-slate-800">Material Sale (₹)</th>
                                  <th className="px-4 py-2.5 text-right text-slate-600">Opening Bal (₹)</th>
                                  <th className="px-4 py-2.5 text-right text-green-600">Payment Jama (₹)</th>
                                  <th className="px-4 py-2.5 text-right hidden md:table-cell text-red-600">Material Baki (₹)</th>
                                  <th className="px-4 py-2.5 text-right text-blue-600 hidden md:table-cell">Payment Pending (₹)</th>
                                  <th className="px-4 py-2.5 text-right text-orange-600 font-bold">Total Balance (₹)</th>
                                  <th className="px-4 py-2.5 text-center">Progress</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {scheme.coupons.map(coupon => (
                                  <React.Fragment key={coupon.id}>
                                    <tr
                                      className="hover:bg-slate-50 transition-colors cursor-pointer"
                                      onClick={() => setExpandedCoupons(prev => ({ ...prev, [coupon.id]: !prev[coupon.id] }))}
                                    >
                                      <td className="px-4 py-3 text-slate-400">
                                        {expandedCoupons[coupon.id] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                      </td>
                                      <td className="px-4 py-3">
                                        <span className="font-bold text-slate-800 bg-slate-100 px-2 py-1 rounded tracking-wider text-xs">{coupon.coupon_no}</span>
                                      </td>
                                      <td className="px-4 py-3">
                                        <p className="font-medium text-slate-800">{coupon.party_name}</p>
                                        {coupon.party_village && <p className="text-[11px] text-slate-400">{coupon.party_village}{coupon.party_district ? `, ${coupon.party_district}` : ''}</p>}
                                      </td>
                                      <td className="px-4 py-3 text-right font-bold text-slate-800">₹{coupon.total_sales.toLocaleString('en-IN', { minimumFractionDigits: 0 })}</td>
                                      <td className="px-4 py-3 text-right text-slate-600">₹{Number(coupon.opening_bal || 0).toLocaleString('en-IN')}</td>
                                      <td className="px-4 py-3 text-right font-medium text-green-700">₹{Number(coupon.party_receipts || 0).toLocaleString('en-IN')}</td>
                                      <td className="px-4 py-3 text-right text-red-600 font-medium hidden md:table-cell">₹{coupon.material_baki.toLocaleString('en-IN')}</td>
                                      <td className="px-4 py-3 text-right text-blue-600 font-medium hidden md:table-cell">₹{coupon.coupon_payment_pending.toLocaleString('en-IN')}</td>
                                      <td className="px-4 py-3 text-right text-orange-600 font-bold">₹{coupon.total_balance.toLocaleString('en-IN')}</td>
                                      <td className="px-4 py-3">
                                        <div className="w-full max-w-[100px] mx-auto">
                                          <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                                            <div className={`h-full rounded-full transition-all ${coupon.completion_pct >= 100 ? 'bg-green-500' : coupon.completion_pct >= 50 ? 'bg-blue-500' : 'bg-orange-400'}`} style={{ width: `${Math.min(100, coupon.completion_pct)}%` }}></div>
                                          </div>
                                          <p className="text-[10px] text-slate-500 text-center mt-0.5">{coupon.completion_pct.toFixed(1)}%</p>
                                        </div>
                                      </td>
                                    </tr>
                                    {/* Product Breakdown */}
                                    {expandedCoupons[coupon.id] && (
                                      <tr>
                                        <td colSpan="9" className="p-0">
                                          <div className="bg-slate-50 border-y border-slate-200 px-8 py-3">
                                            {coupon.products && coupon.products.length > 0 ? (
                                              <>
                                                <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-2 flex items-center gap-1">
                                                  <Package size={12} /> Material / Products Delivered
                                                </p>
                                                <table className="w-full text-xs">
                                                  <thead>
                                                    <tr className="text-slate-500">
                                                      <th className="text-left py-1 font-medium">Product</th>
                                                      <th className="text-right py-1 font-medium">Qty</th>
                                                      <th className="text-right py-1 font-medium">Unit</th>
                                                      <th className="text-right py-1 font-medium">Amount (₹)</th>
                                                    </tr>
                                                  </thead>
                                                  <tbody>
                                                    {coupon.products.map((prod, pi) => (
                                                      <tr key={pi} className="border-t border-slate-200/50">
                                                        <td className="py-1.5 font-medium text-slate-700">{prod.product_name}</td>
                                                        <td className="text-right py-1.5 text-slate-600">{prod.qty.toFixed(2)}</td>
                                                        <td className="text-right py-1.5 text-slate-400">{prod.unit}</td>
                                                        <td className="text-right py-1.5 font-bold text-slate-800">₹{prod.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                                      </tr>
                                                    ))}
                                                  </tbody>
                                                </table>
                                              </>
                                            ) : (
                                              <p className="text-slate-400 text-xs italic">No sales recorded against this coupon yet.</p>
                                            )}
                                          </div>
                                        </td>
                                      </tr>
                                    )}
                                  </React.Fragment>
                                ))}
                                {scheme.coupons.length === 0 && (
                                  <tr>
                                    <td colSpan="9" className="px-6 py-6 text-center text-slate-400 text-sm">No coupons issued under this scheme.</td>
                                  </tr>
                                )}
                              </tbody>
                              <tfoot className="bg-slate-100 border-t-2 border-slate-300">
                                <tr className="font-bold text-sm">
                                  <td colSpan="3" className="px-4 py-3 text-right text-slate-600 uppercase text-xs tracking-wider">Scheme Total:</td>
                                  <td className="px-4 py-3 text-right font-bold text-slate-800">₹{scheme.total_sales.toLocaleString('en-IN', { minimumFractionDigits: 0 })}</td>
                                  <td className="px-4 py-3"></td>
                                  <td className="px-4 py-3"></td>
                                  <td className="px-4 py-3 hidden md:table-cell"></td>
                                  <td className="px-4 py-3 hidden md:table-cell"></td>
                                  <td className="px-4 py-3"></td>
                                  <td className="px-4 py-3 text-center text-slate-500 text-xs">{scheme.completion_pct.toFixed(1)}%</td>
                                </tr>
                              </tfoot>
                            </table>
                            </div>

                            {/* Mobile Card View */}
                            <div className="md:hidden divide-y divide-slate-100 bg-white">
                              {scheme.coupons.map(coupon => (
                                <div key={coupon.id} className="p-3 sm:p-4 flex flex-col gap-3">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <span className="font-bold text-slate-800 bg-slate-100 px-2 py-1 rounded tracking-wider text-xs">{coupon.coupon_no}</span>
                                      <span className="text-xs text-slate-500">{coupon.issue_date}</span>
                                    </div>
                                  </div>
                                  
                                  <div>
                                    <p className="font-bold text-slate-800">{coupon.party_name}</p>
                                    {coupon.party_village && <p className="text-[11px] text-slate-500">{coupon.party_village}</p>}
                                  </div>

                                  <div className="grid grid-cols-2 gap-2 text-sm bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                                    <div>
                                      {/* Placeholder for new column */}
                                    </div>
                                    <div className="text-right">
                                      <p className="text-[10px] text-slate-400 uppercase font-bold">Material Sale</p>
                                      <p className="font-bold text-slate-800">₹{coupon.total_sales.toLocaleString('en-IN', { minimumFractionDigits: 0 })}</p>
                                    </div>
                                    <div className="pt-2 border-t border-slate-200">
                                      <p className="text-[10px] text-slate-500 uppercase font-bold">Opening Bal</p>
                                      <p className="font-semibold text-slate-700">₹{Number(coupon.opening_bal || 0).toLocaleString('en-IN')}</p>
                                    </div>
                                    <div className="text-right pt-2 border-t border-slate-200">
                                      <p className="text-[10px] text-green-600 uppercase font-bold">Payment Jama</p>
                                      <p className="font-bold text-green-700">₹{Number(coupon.party_receipts || 0).toLocaleString('en-IN')}</p>
                                    </div>
                                    <div className="pt-2 border-t border-slate-200">
                                      <p className="text-[10px] text-blue-500 uppercase font-bold">Payment Pending</p>
                                      <p className="font-semibold text-blue-700">₹{Number(coupon.coupon_payment_pending || 0).toLocaleString('en-IN')}</p>
                                    </div>
                                    <div className="text-right pt-2 border-t border-slate-200">
                                      <p className="text-[10px] text-orange-500 uppercase font-bold">Total Balance</p>
                                      <p className="font-bold text-orange-700">₹{Number(coupon.total_balance || 0).toLocaleString('en-IN')}</p>
                                    </div>
                                  </div>

                                  <div className="w-full">
                                    <div className="flex justify-between text-[10px] text-slate-500 mb-1 font-medium">
                                      <span>Progress</span>
                                      <span>{coupon.completion_pct.toFixed(1)}%</span>
                                    </div>
                                    <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                      <div className={`h-full rounded-full transition-all ${coupon.completion_pct >= 100 ? 'bg-green-500' : coupon.completion_pct >= 50 ? 'bg-blue-500' : 'bg-orange-400'}`} style={{ width: `${Math.min(100, coupon.completion_pct)}%` }}></div>
                                    </div>
                                  </div>

                                  <button
                                    onClick={() => setExpandedCoupons(prev => ({ ...prev, [coupon.id]: !prev[coupon.id] }))}
                                    className="w-full mt-1 py-2 flex items-center justify-center gap-1 text-xs font-semibold text-primary-600 bg-primary-50 rounded-lg hover:bg-primary-100 transition-colors"
                                  >
                                    {expandedCoupons[coupon.id] ? (
                                      <>Hide Details <ChevronDown size={14} /></>
                                    ) : (
                                      <>View Products <ChevronRight size={14} /></>
                                    )}
                                  </button>

                                  {expandedCoupons[coupon.id] && coupon.products && (
                                    <div className="mt-1 bg-white rounded-lg border border-slate-100 overflow-hidden">
                                      {coupon.products.length > 0 ? (
                                        <>
                                          <div className="bg-slate-50 px-3 py-2 border-b border-slate-100">
                                            <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold flex items-center gap-1">
                                              <Package size={12} /> Delivered Products
                                            </p>
                                          </div>
                                          <div className="px-3 py-2 space-y-2.5">
                                            {coupon.products.map((prod, pi) => (
                                              <div key={pi} className="flex justify-between items-start text-xs border-b border-slate-100 pb-2.5 last:border-0 last:pb-0">
                                                <div>
                                                  <p className="font-medium text-slate-700">{prod.product_name}</p>
                                                  <p className="text-[11px] text-slate-500 mt-0.5">{prod.qty.toFixed(2)} {prod.unit}</p>
                                                </div>
                                                <p className="font-bold text-slate-800">₹{prod.amount.toLocaleString('en-IN', { minimumFractionDigits: 0 })}</p>
                                              </div>
                                            ))}
                                          </div>
                                        </>
                                      ) : (
                                        <p className="text-xs text-slate-500 text-center py-4">No products delivered against this coupon yet.</p>
                                      )}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              ) : null}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
