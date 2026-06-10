import React, { useState, useEffect } from 'react';
import { CalendarDays, Printer, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import { printHTML } from '../../lib/printUtils';

export default function WeeklySummaryPage() {
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0];
  });
  const [toDate, setToDate] = useState(() => new Date().toISOString().split('T')[0]);
  
  const [summaryData, setSummaryData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [firmSettings, setFirmSettings] = useState({});

  useEffect(() => {
    loadSettings();
  }, []);

  useEffect(() => {
    if (fromDate && toDate) {
      loadSummary();
    }
  }, [fromDate, toDate]);

  const loadSettings = async () => {
    try {
      const s = await window.db.invoke('settings:get');
      setFirmSettings(s || {});
    } catch (e) {
      console.error('Failed to load settings', e);
    }
  };

  const loadSummary = async () => {
    setLoading(true);
    try {
      const data = await window.db.invoke('workers:getSummary', fromDate, toDate);
      // Filter out workers who had 0 days and 0 paid amount if needed, but showing all might be better.
      // Let's only show workers who have at least some activity (days > 0 or paid > 0)
      const activeWorkers = data.filter(w => w.totalDays > 0 || w.paidAmount > 0);
      setSummaryData(activeWorkers);
    } catch (err) {
      toast.error('Failed to load summary');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (val) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(val || 0);
  
  const formatDateStr = (dStr) => {
    if (!dStr) return '';
    return new Date(dStr).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const handlePrint = async () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    
    const totalDays = summaryData.reduce((sum, w) => sum + w.totalDays, 0);
    const totalEarned = summaryData.reduce((sum, w) => sum + w.earned, 0);
    const totalPaid = summaryData.reduce((sum, w) => sum + w.paidAmount, 0);

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Wage Register</title>
        <style>
          body { font-family: 'Arial', sans-serif; padding: 20px; color: #1e293b; }
          .header { text-align: center; border-bottom: 2px solid #1e293b; padding-bottom: 10px; margin-bottom: 20px; }
          .header h1 { margin: 0 0 5px 0; font-size: 24px; }
          .header p { margin: 0; color: #475569; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #cbd5e1; padding: 8px 12px; text-align: left; }
          th { background-color: #f8fafc; font-weight: bold; }
          .text-right { text-align: right; }
          .text-center { text-align: center; }
          .font-bold { font-weight: bold; }
          .totals { background-color: #f1f5f9; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${firmSettings?.firm_name || 'Amrut Finance'}</h1>
          <p>Wage Register & Attendance Summary</p>
          <p><strong>Period:</strong> ${formatDateStr(fromDate)} to ${formatDateStr(toDate)}</p>
        </div>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Worker Name</th>
              <th>Type</th>
              <th class="text-right">Rate</th>
              <th class="text-right">Days</th>
              <th class="text-right">Earned</th>
              <th class="text-right">Paid/Advance</th>
            </tr>
          </thead>
          <tbody>
            ${summaryData.map((w, index) => `
              <tr>
                <td>${index + 1}</td>
                <td>${w.name}</td>
                <td>${w.salary_type}</td>
                <td class="text-right">${w.taking_salary}</td>
                <td class="text-right">${w.totalDays}</td>
                <td class="text-right">${w.earned}</td>
                <td class="text-right">${w.paidAmount}</td>
              </tr>
            `).join('')}
            <tr class="totals">
              <td colspan="4" class="text-right font-bold">Totals</td>
              <td class="text-right font-bold">${totalDays}</td>
              <td class="text-right font-bold">${totalEarned}</td>
              <td class="text-right font-bold">${totalPaid}</td>
            </tr>
          </tbody>
        </table>
      </body>
      </html>
    `;
    
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    
    // Auto print
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 500);
  };

  return (
    <div className="p-6 h-full flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Wage Register</h1>
          <p className="text-slate-500">Weekly attendance and payment summary</p>
        </div>
        <button
          onClick={handlePrint}
          disabled={summaryData.length === 0}
          className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg font-medium transition flex items-center disabled:opacity-50"
        >
          <Printer className="w-4 h-4 mr-2" />
          Print Register
        </button>
      </div>

      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-6 flex items-end gap-4">
        <div className="w-48">
          <label className="block text-sm font-medium text-slate-700 mb-1">From Date</label>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
          />
        </div>
        <div className="w-48">
          <label className="block text-sm font-medium text-slate-700 mb-1">To Date</label>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
          />
        </div>
      </div>

      <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin"></div>
          </div>
        ) : summaryData.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-slate-500">
            <CalendarDays className="w-12 h-12 mb-4 text-slate-300" />
            <p className="text-lg">No worker activity found for this period</p>
          </div>
        ) : (
          <div className="flex-1 overflow-auto">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-white shadow-sm z-10">
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-sm font-semibold uppercase tracking-wider">
                  <th className="px-6 py-4">Worker Name</th>
                  <th className="px-6 py-4 text-center">Days Worked</th>
                  <th className="px-6 py-4 text-right">Earned (₹)</th>
                  <th className="px-6 py-4 text-right">Paid/Advance (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {summaryData.map(worker => (
                  <tr key={worker.id} className="hover:bg-slate-50 transition">
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-800">{worker.name}</div>
                      <div className="text-xs text-slate-500">{worker.salary_type} @ {worker.taking_salary}/day</div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="font-medium text-slate-800">{worker.totalDays}</span>
                      {worker.halfDays > 0 && <span className="text-xs text-slate-500 ml-1">({worker.presentDays}F + {worker.halfDays}H)</span>}
                    </td>
                    <td className="px-6 py-4 text-right font-medium text-emerald-600">
                      {formatCurrency(worker.earned)}
                    </td>
                    <td className="px-6 py-4 text-right font-medium text-indigo-600">
                      {formatCurrency(worker.paidAmount)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="sticky bottom-0 bg-slate-50 border-t border-slate-200">
                <tr>
                  <td className="px-6 py-4 font-bold text-slate-800 text-right">Totals</td>
                  <td className="px-6 py-4 font-bold text-slate-800 text-center">
                    {summaryData.reduce((sum, w) => sum + w.totalDays, 0)}
                  </td>
                  <td className="px-6 py-4 font-bold text-emerald-600 text-right">
                    {formatCurrency(summaryData.reduce((sum, w) => sum + w.earned, 0))}
                  </td>
                  <td className="px-6 py-4 font-bold text-indigo-600 text-right">
                    {formatCurrency(summaryData.reduce((sum, w) => sum + w.paidAmount, 0))}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
