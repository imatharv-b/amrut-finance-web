import React, { useState, useEffect } from 'react';
import { CalendarDays, Printer, ChevronLeft, ChevronRight, Check, X, IndianRupee } from 'lucide-react';
import toast from 'react-hot-toast';
import Modal from '../../components/Modal';
import FormField from '../../components/FormField';

export default function WeeklySummaryPage() {
  const [baseDate, setBaseDate] = useState(() => new Date());
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [weekDays, setWeekDays] = useState([]);
  
  const [summaryData, setSummaryData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [firmSettings, setFirmSettings] = useState({});
  const [expenseTypes, setExpenseTypes] = useState([]);
  
  // Pay Modal State
  const [payWorker, setPayWorker] = useState(null);
  const [payAmount, setPayAmount] = useState('');
  const [payDate, setPayDate] = useState(new Date().toISOString().split('T')[0]);
  const [payDescription, setPayDescription] = useState('');
  const [payLoading, setPayLoading] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  useEffect(() => {
    // Calculate Friday to Thursday based on baseDate
    const d = new Date(baseDate);
    const day = d.getDay();
    // 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
    // Diff to previous Friday:
    let diffToFriday = day >= 5 ? day - 5 : day + 2;
    
    const start = new Date(d);
    start.setDate(d.getDate() - diffToFriday);
    
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    
    const startStr = start.toISOString().split('T')[0];
    const endStr = end.toISOString().split('T')[0];
    
    setFromDate(startStr);
    setToDate(endStr);
    
    // Generate the 7 days
    const days = [];
    for (let i = 0; i < 7; i++) {
      const current = new Date(start);
      current.setDate(start.getDate() + i);
      days.push({
        dateStr: current.toISOString().split('T')[0],
        dateNum: current.getDate(),
        dayName: current.toLocaleDateString('en-US', { weekday: 'short' }), // Fri, Sat, etc.
        isSunday: current.getDay() === 0
      });
    }
    setWeekDays(days);
  }, [baseDate]);

  useEffect(() => {
    if (fromDate && toDate) {
      loadSummary();
    }
  }, [fromDate, toDate]);

  const loadSettings = async () => {
    try {
      const s = await window.db.invoke('settings:get');
      setFirmSettings(s || {});
      const types = await window.db.invoke('expenseTypes:getAll');
      setExpenseTypes(types || []);
    } catch (e) {
      console.error('Failed to load settings', e);
    }
  };

  const loadSummary = async () => {
    setLoading(true);
    try {
      const data = await window.db.invoke('workers:getSummary', fromDate, toDate);
      const activeWorkers = data.filter(w => w.totalDays > 0 || w.paidAmount > 0);
      setSummaryData(activeWorkers);
    } catch (err) {
      toast.error('Failed to load summary');
    } finally {
      setLoading(false);
    }
  };

  const handlePaySubmit = async (e) => {
    e.preventDefault();
    if (!payWorker || !payAmount || payAmount <= 0) return;
    
    setPayLoading(true);
    try {
      // Determine if it's an advance or regular salary based on amount and earned.
      // Or just default to 'Worker Salary' / 'Worker Advance'.
      // Try to find "Worker Salary" expense type
      let typeId = null;
      let expType = expenseTypes.find(t => t.name.toLowerCase() === 'worker salary');
      if (!expType) expType = expenseTypes.find(t => t.name.toLowerCase() === 'worker advance');
      if (expType) typeId = expType.id;
      
      const payload = {
        date: payDate,
        amount: Number(payAmount),
        expense_type_id: typeId,
        worker_id: payWorker.id,
        description: payDescription || 'Wage Register Payment'
      };
      
      await window.db.invoke('expenses:add', payload);
      toast.success('Payment recorded successfully');
      setPayWorker(null);
      setPayAmount('');
      setPayDescription('');
      loadSummary(); // Refresh data
    } catch (err) {
      toast.error(err.message || 'Failed to record payment');
    } finally {
      setPayLoading(false);
    }
  };

  const changeWeek = (days) => {
    const d = new Date(baseDate);
    d.setDate(d.getDate() + days);
    setBaseDate(d);
  };

  const formatCurrency = (val) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(val || 0);
  
  const formatDateStr = (dStr) => {
    if (!dStr) return '';
    return new Date(dStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const handlePrint = async () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    
    const totalDays = summaryData.reduce((sum, w) => sum + w.totalDays, 0);
    const totalEarned = summaryData.reduce((sum, w) => sum + w.earned, 0);
    const totalPaid = summaryData.reduce((sum, w) => sum + w.paidAmount, 0);

    let html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Wage Register</title>
        <style>
          body { font-family: 'Arial', sans-serif; padding: 20px; color: #1e293b; font-size: 12px; }
          .header { text-align: center; border-bottom: 2px solid #1e293b; padding-bottom: 10px; margin-bottom: 20px; }
          .header h1 { margin: 0 0 5px 0; font-size: 20px; }
          .header p { margin: 0; color: #475569; font-size: 14px; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th, td { border: 1px solid #cbd5e1; padding: 6px; text-align: left; }
          th { background-color: #f8fafc; font-weight: bold; font-size: 11px; }
          .text-right { text-align: right; }
          .text-center { text-align: center; }
          .font-bold { font-weight: bold; }
          .totals { background-color: #f1f5f9; }
          .day-col { width: 25px; text-align: center; font-size: 10px; }
          .text-emerald { color: #10b981; }
          .text-amber { color: #f59e0b; }
          .text-red { color: #ef4444; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${firmSettings?.firm_name || 'Amrut Finance'}</h1>
          <p>Weekly Wage Register</p>
          <p><strong>Period:</strong> ${formatDateStr(fromDate)} to ${formatDateStr(toDate)} (Friday - Thursday)</p>
        </div>
        <table>
          <thead>
            <tr>
              <th rowspan="2" style="width: 20px;">#</th>
              <th rowspan="2">Worker Name</th>
              <th rowspan="2">Rate</th>
              <th colspan="7" class="text-center">Attendance</th>
              <th rowspan="2" class="text-right">Total Days</th>
              <th rowspan="2" class="text-right">Earned</th>
              <th rowspan="2" class="text-right">Paid/Advance</th>
            </tr>
            <tr>
              ${weekDays.map(d => `<th class="day-col">${d.dayName}<br/>${d.dateNum}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
    `;

    summaryData.forEach((w, index) => {
      html += `
        <tr>
          <td class="text-center">${index + 1}</td>
          <td><strong>${w.name}</strong></td>
          <td>${w.taking_salary}</td>
      `;
      
      weekDays.forEach(d => {
        const status = w.records && w.records[d.dateStr];
        let mark = '-';
        if (status === 'Present') mark = '<span class="text-emerald">P</span>';
        else if (status === 'Half Day') mark = '<span class="text-amber">½</span>';
        else if (status === 'Absent') mark = '<span class="text-red">A</span>';
        html += `<td class="day-col">${mark}</td>`;
      });

      html += `
          <td class="text-right">${w.totalDays}</td>
          <td class="text-right">${w.earned}</td>
          <td class="text-right">${w.paidAmount}</td>
        </tr>
      `;
    });

    html += `
            <tr class="totals">
              <td colspan="10" class="text-right font-bold">Totals</td>
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
    
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 500);
  };

  return (
    <div className="p-6 h-full flex flex-col bg-slate-50/50">
      <div className="w-full max-w-5xl mx-auto flex-1 flex flex-col">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6 gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Wage Register</h1>
            <p className="text-slate-500">Weekly attendance and payment summary</p>
          </div>
          <button
            onClick={handlePrint}
            disabled={summaryData.length === 0}
            className="px-5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-medium transition flex items-center shadow-sm disabled:opacity-50"
          >
            <Printer className="w-4 h-4 mr-2" />
            Print Register
          </button>
        </div>

        {/* Week Navigator */}
        <div className="flex items-center justify-center space-x-2 md:space-x-4 mb-8">
          <button onClick={() => changeWeek(-7)} className="p-2 md:p-2.5 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition shadow-sm"><ChevronLeft className="w-5 h-5 text-slate-600" /></button>
          <div className="flex flex-col text-center px-2 md:px-4">
            <span className="font-bold text-lg md:text-xl text-slate-800">
              {formatDateStr(fromDate)} - {formatDateStr(toDate)}
            </span>
            <span className="text-sm font-medium text-slate-500 mt-1">Friday - Thursday</span>
          </div>
          <button onClick={() => changeWeek(7)} className="p-2 md:p-2.5 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition shadow-sm"><ChevronRight className="w-5 h-5 text-slate-600" /></button>
        </div>

        {/* Calendar Cards */}
        <div className="flex-1 overflow-auto pb-20">
          {loading ? (
            <div className="flex justify-center mt-20">
              <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin"></div>
            </div>
          ) : summaryData.length === 0 ? (
            <div className="flex flex-col items-center justify-center mt-20 text-slate-500 bg-white p-12 rounded-2xl border border-slate-200">
              <CalendarDays className="w-12 h-12 mb-4 text-slate-300" />
              <p className="text-lg font-medium">No worker activity found for this week</p>
            </div>
          ) : (
            <div className="space-y-4">
              {summaryData.map(worker => {
                return (
                  <div key={worker.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                    {/* Worker Info */}
                    <div className="flex items-center space-x-4 min-w-[250px]">
                      <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-xl">
                        {worker.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-800 text-lg leading-tight">{worker.name}</h3>
                        <p className="text-sm text-slate-500 font-medium">Rate: {formatCurrency(worker.taking_salary)}</p>
                      </div>
                    </div>

                    {/* 7-Day Week Calendar */}
                    <div className="flex space-x-1.5 md:space-x-2 bg-slate-50 p-2 rounded-xl border border-slate-100 overflow-x-auto scrollbar-hide w-full md:w-auto">
                      {weekDays.map(d => {
                        const status = worker.records && worker.records[d.dateStr];
                        let bgClass = 'bg-white border-slate-200 text-slate-400';
                        
                        if (status === 'Present') {
                          bgClass = 'bg-emerald-500 border-emerald-500 text-white shadow-sm';
                        } else if (status === 'Half Day') {
                          bgClass = 'bg-amber-400 border-amber-400 text-white shadow-sm';
                        } else if (status === 'Absent') {
                          bgClass = 'bg-red-500 border-red-500 text-white shadow-sm';
                        } else if (d.isSunday && !status) {
                          bgClass = 'bg-rose-50 border-rose-100 text-rose-300';
                        } else if (new Date(d.dateStr) <= new Date() && !status) {
                          bgClass = 'bg-slate-200 border-slate-200 text-slate-500'; // Past, no data
                        }
                        
                        return (
                          <div key={d.dateNum} className="flex flex-col items-center">
                            <span className="text-[10px] font-bold text-slate-400 mb-1">{d.dayName}</span>
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm border ${bgClass}`}>
                              {status === 'Present' ? <Check className="w-4 h-4"/> : 
                               status === 'Half Day' ? '½' : 
                               status === 'Absent' ? <X className="w-4 h-4"/> : 
                               d.isSunday ? 'S' : '-'}
                            </div>
                            <span className="text-[10px] font-semibold text-slate-400 mt-1">{d.dateNum}</span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Summary Pills */}
                    <div className="flex flex-wrap items-center gap-2 mt-4 md:mt-0 w-full md:w-auto">
                      <div className="flex-1 md:flex-none text-center px-3 py-2 bg-slate-50 rounded-xl border border-slate-100">
                        <div className="text-[10px] md:text-xs font-bold text-slate-400 uppercase">Days</div>
                        <div className="font-bold text-slate-700">{worker.totalDays}</div>
                      </div>
                      <div className="flex-1 md:flex-none text-center px-3 py-2 bg-emerald-50 rounded-xl border border-emerald-100">
                        <div className="text-[10px] md:text-xs font-bold text-emerald-600/70 uppercase">Earned</div>
                        <div className="font-bold text-emerald-700">{formatCurrency(worker.earned)}</div>
                      </div>
                      <div className="flex-1 md:flex-none text-center px-3 py-2 bg-indigo-50 rounded-xl border border-indigo-100 flex flex-col items-center justify-center">
                        <div className="text-[10px] md:text-xs font-bold text-indigo-600/70 uppercase">Paid</div>
                        <div className="font-bold text-indigo-700">{formatCurrency(worker.paidAmount)}</div>
                      </div>
                      <button 
                        onClick={() => {
                          setPayWorker(worker);
                          setPayAmount('');
                          setPayDate(new Date().toISOString().split('T')[0]);
                          setPayDescription('');
                        }}
                        className="flex-1 md:flex-none flex items-center justify-center px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl transition shadow-sm h-full font-medium text-sm"
                        style={{ minHeight: '52px' }}
                      >
                        <IndianRupee className="w-4 h-4 mr-1.5" />
                        Pay
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Pay Modal */}
      <Modal
        isOpen={!!payWorker}
        onClose={() => setPayWorker(null)}
        title={`Pay ${payWorker?.name}`}
      >
        <form onSubmit={handlePaySubmit} className="space-y-4">
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mb-4 flex justify-between items-center">
            <div>
              <p className="text-sm text-slate-500">Total Earned</p>
              <p className="text-lg font-bold text-slate-800">{formatCurrency(payWorker?.earned)}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-slate-500">Already Paid</p>
              <p className="text-lg font-bold text-slate-800">{formatCurrency(payWorker?.paidAmount)}</p>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Payment Date">
              <input
                type="date"
                required
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                value={payDate}
                onChange={e => setPayDate(e.target.value)}
              />
            </FormField>
            
            <FormField label="Amount (₹)">
              <input
                type="number"
                required
                min="1"
                step="0.01"
                placeholder="Enter amount"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                value={payAmount}
                onChange={e => setPayAmount(e.target.value)}
              />
            </FormField>
          </div>

          <FormField label="Description (Optional)">
            <input
              type="text"
              placeholder="e.g. Salary, Advance, Bonus"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
              value={payDescription}
              onChange={e => setPayDescription(e.target.value)}
            />
          </FormField>

          <div className="flex justify-end pt-4 space-x-3">
            <button
              type="button"
              onClick={() => setPayWorker(null)}
              className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium"
              disabled={payLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={payLoading || !payAmount}
              className="px-4 py-2 bg-primary-700 text-white rounded-lg hover:bg-primary-800 font-medium disabled:opacity-50 flex items-center shadow-sm"
            >
              {payLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></div>
              ) : <Check className="w-5 h-5 mr-2" />}
              Record Payment
            </button>
          </div>
        </form>
      </Modal>

    </div>
  );
}
