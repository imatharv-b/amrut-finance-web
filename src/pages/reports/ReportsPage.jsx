import React, { useState, useEffect } from 'react';
import { FileBarChart2, Search, Printer, Download } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ReportsPage() {
  const [seasons, setSeasons] = useState([]);
  const [selectedSeason, setSelectedSeason] = useState('');
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);

  const [reportType, setReportType] = useState('outstanding');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [expenseTypes, setExpenseTypes] = useState([]);
  const [selectedExpenseType, setSelectedExpenseType] = useState('');
  
  const [products, setProducts] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState('');
  
  const [parties, setParties] = useState([]);
  const [selectedParty, setSelectedParty] = useState('');
  
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
        const coupons = await window.db.invoke('reports:couponAnalytics', selectedSeason);
        setReportData({
          type: 'coupon',
          coupons: coupons
        });
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
    <div className="p-6 h-full flex flex-col">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Reports</h1>
          <p className="text-slate-500">View and print various analytics reports</p>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-6 flex flex-wrap gap-4 items-end">
        <div className="w-48">
          <label className="block text-sm font-medium text-slate-700 mb-1">Report Type</label>
          <select
            value={reportType}
            onChange={(e) => {
              setReportType(e.target.value);
              setReportData(null);
            }}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none bg-white"
          >
            <option value="outstanding">Outstanding Report</option>
            <option value="expense">Expense Report</option>
            <option value="coupon">Coupon Analytics</option>
            <option value="batch_manufacturing">Batch Manufacturing Record</option>
            <option value="party_schemes">Party Scheme Ledger</option>
          </select>
        </div>
        <div className="w-48">
          <label className="block text-sm font-medium text-slate-700 mb-1">Season</label>
          <select
            value={selectedSeason}
            onChange={(e) => setSelectedSeason(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none bg-white"
          >
            {seasons.map(s => (
              <option key={s.id} value={s.id}>{s.name} ({s.start_date} to {s.end_date})</option>
            ))}
          </select>
        </div>

        {reportType === 'batch_manufacturing' && (
          <div className="w-64">
            <label className="block text-sm font-medium text-slate-700 mb-1">Product</label>
            <select
              value={selectedProduct}
              onChange={e => setSelectedProduct(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none bg-white"
            >
              <option value="">Select a product...</option>
              {products.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        )}

        {reportType === 'party_schemes' && (
          <div className="w-64">
            <label className="block text-sm font-medium text-slate-700 mb-1">Party / Krishi Kendra</label>
            <select
              value={selectedParty}
              onChange={e => setSelectedParty(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none bg-white"
            >
              <option value="">Select a party...</option>
              {parties.map(p => (
                <option key={p.id} value={p.id}>{p.name} {p.village ? `(${p.village})` : ''}</option>
              ))}
            </select>
          </div>
        )}

        {(reportType === 'expense' || reportType === 'batch_manufacturing') && (
          <>
            <div className="w-32">
              <label className="block text-sm font-medium text-slate-700 mb-1">From Date</label>
              <input
                type="date"
                value={fromDate}
                onChange={e => setFromDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
              />
            </div>
            <div className="w-32">
              <label className="block text-sm font-medium text-slate-700 mb-1">To Date</label>
              <input
                type="date"
                value={toDate}
                onChange={e => setToDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
              />
            </div>
          </>
        )}
        {reportType === 'expense' && (
            <div className="w-48">
              <label className="block text-sm font-medium text-slate-700 mb-1">Expense Type</label>
              <select
                value={selectedExpenseType}
                onChange={e => setSelectedExpenseType(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none bg-white"
              >
                <option value="">All Expenses</option>
                {expenseTypes.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
        )}
        <button
          onClick={generateReport}
          disabled={loading || (reportType !== 'batch_manufacturing' && reportType !== 'party_schemes' && !selectedSeason)}
          className="px-4 py-2 bg-primary-700 hover:bg-primary-800 text-white rounded-lg font-medium transition flex items-center disabled:opacity-50"
        >
          <Search className="w-4 h-4 mr-2" />
          Generate
        </button>
        
        {reportData && (
          <button
            className="px-4 py-2 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg font-medium transition flex items-center ml-auto"
            onClick={() => window.print()}
          >
            <Printer className="w-4 h-4 mr-2" />
            Print Report
          </button>
        )}
      </div>

      <div className="flex-1 overflow-hidden bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col print-area print:overflow-visible print:h-auto print:border-none print:shadow-none">
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center p-12">
            <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mb-4"></div>
            <p className="text-slate-500">Generating report...</p>
          </div>
        ) : !reportData ? (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-slate-500">
            <FileBarChart2 className="w-12 h-12 mb-4 text-slate-300" />
            <p className="text-lg">Select a season and click Generate</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-6 border-b border-slate-200 bg-slate-50">
              <div>
                <p className="text-sm text-slate-500">Season</p>
                <p className="text-lg font-bold text-slate-800">{selectedSeasonObj?.name}</p>
                <p className="text-xs text-slate-500">{selectedSeasonObj?.start_date} to {selectedSeasonObj?.end_date}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-slate-500">
                  {reportData.type === 'outstanding' ? 'Total Season Outstanding' : reportData.type === 'expense' ? 'Total Expense Amount' : reportData.type === 'batch_manufacturing' ? 'Total Batches' : reportData.type === 'party_schemes' ? 'Total Schemes' : 'Total Coupons'}
                </p>
                <p className="text-2xl font-bold text-slate-800">
                  {reportData.type === 'outstanding' ? `₹${reportData.total_balance.toFixed(2)}` : reportData.type === 'expense' ? `₹${reportData.total_amount.toFixed(2)}` : reportData.type === 'batch_manufacturing' || reportData.type === 'party_schemes' ? reportData.rows.length : reportData.coupons.length}
                </p>
              </div>
            </div>

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
              ) : (
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-slate-100 text-slate-600 font-medium sticky top-0 z-10 shadow-sm">
                    <tr>
                      <th className="px-6 py-3 border-b border-slate-200 w-16">Sr No</th>
                      <th className="px-6 py-3 border-b border-slate-200">Date Issued</th>
                      <th className="px-6 py-3 border-b border-slate-200">Coupon No</th>
                      <th className="px-6 py-3 border-b border-slate-200">Krishi Kendra</th>
                      <th className="px-6 py-3 border-b border-slate-200">Scheme</th>
                      <th className="px-6 py-3 border-b border-slate-200 text-right">Target (₹)</th>
                      <th className="px-6 py-3 border-b border-slate-200 text-right">Sales (₹)</th>
                      <th className="px-6 py-3 border-b border-slate-200 text-right">Paid (₹)</th>
                      <th className="px-6 py-3 border-b border-slate-200 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {reportData.coupons.map((coupon, index) => (
                      <tr key={coupon.id} className="hover:bg-slate-50 transition">
                        <td className="px-6 py-3 text-slate-500">{index + 1}</td>
                        <td className="px-6 py-3 text-slate-600">{coupon.date_issued}</td>
                        <td className="px-6 py-3 font-medium text-slate-800">{coupon.coupon_no}</td>
                        <td className="px-6 py-3 font-medium text-slate-800">{coupon.party_name}</td>
                        <td className="px-6 py-3 text-slate-600">{coupon.scheme_name}</td>
                        <td className="px-6 py-3 text-right text-slate-600">{coupon.target_amount.toFixed(2)}</td>
                        <td className="px-6 py-3 text-right font-medium text-slate-800">{coupon.total_sales.toFixed(2)}</td>
                        <td className="px-6 py-3 text-right text-green-600">{coupon.total_paid.toFixed(2)}</td>
                        <td className="px-6 py-3 text-center">
                          {coupon.total_sales >= coupon.target_amount ? (
                            coupon.total_paid >= coupon.target_amount ? (
                              <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-bold">ACHIEVED</span>
                            ) : (
                              <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-bold whitespace-nowrap">PAYMENT PENDING</span>
                            )
                          ) : (
                            <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded text-xs font-bold">PENDING</span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {reportData.coupons.length === 0 && (
                      <tr>
                        <td colSpan="9" className="px-6 py-8 text-center text-slate-500">
                          No coupons found for this season.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
