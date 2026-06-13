import React, { useState, useEffect } from 'react';
import { CalendarDays, CheckCircle, Edit, Info } from 'lucide-react';
import toast from 'react-hot-toast';
import DataTable from '../../components/DataTable';
import FormField from '../../components/FormField';

export default function MonthlySalaryPage() {
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1); // Default to previous month
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  
  const [summaryData, setSummaryData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editValues, setEditValues] = useState({});

  useEffect(() => {
    if (selectedMonth) {
      loadSummary();
    }
  }, [selectedMonth]);

  const loadSummary = async () => {
    setLoading(true);
    try {
      const [yearStr, monthStr] = selectedMonth.split('-');
      const year = parseInt(yearStr, 10);
      const month = parseInt(monthStr, 10) - 1; // 0-indexed for JS
      
      const data = await window.db.invoke('workers:getMonthlySalarySummary', year, month);
      setSummaryData(data || []);
      
      // Initialize edit values
      const initialEdits = {};
      data.forEach(w => {
        initialEdits[w.id] = {
          netPayable: w.netPayable,
          description: ''
        };
      });
      setEditValues(initialEdits);
    } catch (err) {
      toast.error('Failed to load salary summary');
    } finally {
      setLoading(false);
    }
  };

  const handleEditChange = (id, field, value) => {
    setEditValues(prev => ({
      ...prev,
      [id]: {
        ...prev[id],
        [field]: value
      }
    }));
  };

  const handleApproveAll = async () => {
    if (summaryData.length === 0) return;
    
    if (!window.confirm('Are you sure you want to approve and credit salaries for all workers in the list? This will add a Credit entry to their ledgers.')) {
      return;
    }
    
    setLoading(true);
    try {
      const [yearStr, monthStr] = selectedMonth.split('-');
      const year = parseInt(yearStr, 10);
      const month = parseInt(monthStr, 10) - 1;
      
      const date = new Date(year, month, 1);
      const monthName = date.toLocaleString('default', { month: 'long', year: 'numeric' });
      
      // Credit on 1st of NEXT month
      const nextMonthDate = new Date(year, month + 1, 1);
      const nextMonthDateStr = nextMonthDate.toISOString().split('T')[0];
      
      const approvals = summaryData.map(w => ({
        worker_id: w.id,
        company_id: w.company_id,
        amount: Number(editValues[w.id]?.netPayable !== undefined ? editValues[w.id].netPayable : w.netPayable),
        description: editValues[w.id]?.description || `Salary Credit for ${monthName}`
      })).filter(a => a.amount > 0);
      
      if (approvals.length === 0) {
        toast.error('No positive salaries to approve');
        setLoading(false);
        return;
      }

      await window.db.invoke('workers:approveMonthlySalary', approvals, nextMonthDateStr, monthName);
      toast.success('Salaries credited successfully');
      loadSummary();
    } catch (err) {
      toast.error('Failed to approve salaries');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (val) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(val || 0);

  const columns = [
    { key: 'name', label: 'Worker Name', sortable: true, render: (val) => <span className="font-semibold text-slate-800">{val}</span> },
    { key: 'monthlyBase', label: 'Monthly Base', render: (val) => <span className="text-slate-600">{formatCurrency(val)}</span> },
    { 
      key: 'attendance', 
      label: 'Attendance summary', 
      render: (_, row) => (
        <div className="text-xs text-slate-600 space-y-0.5">
          <p>Total Days: {row.daysInMonth}</p>
          <p className="text-red-600">Absent: {row.absentDays}</p>
          {row.halfDays > 0 && <p className="text-orange-600">Half Days: {row.halfDays}</p>}
        </div>
      )
    },
    { 
      key: 'deductions', 
      label: 'Deductions', 
      render: (val, row) => (
        <div className="text-sm text-red-600 font-medium">
          {formatCurrency(val)}
          <div className="text-[10px] text-slate-400 font-normal mt-0.5">(₹{Number(row.perDayAmount).toFixed(2)} / day)</div>
        </div>
      ) 
    },
    {
      key: 'netPayable',
      label: 'Final Payable',
      render: (val, row) => {
        const isEditing = editingId === row.id;
        if (isEditing) {
          return (
            <div className="flex flex-col gap-2 min-w-[150px]">
              <input
                type="number"
                step="0.01"
                value={editValues[row.id]?.netPayable !== undefined ? editValues[row.id].netPayable : val}
                onChange={(e) => handleEditChange(row.id, 'netPayable', e.target.value)}
                className="px-2 py-1 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-primary-500"
              />
              <input
                type="text"
                placeholder="Optional Note (e.g., Bonus)"
                value={editValues[row.id]?.description || ''}
                onChange={(e) => handleEditChange(row.id, 'description', e.target.value)}
                className="px-2 py-1 border border-slate-300 rounded text-xs focus:ring-2 focus:ring-primary-500"
              />
              <button 
                onClick={() => setEditingId(null)}
                className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-bold hover:bg-green-200"
              >
                Done
              </button>
            </div>
          );
        }
        
        const currentVal = editValues[row.id]?.netPayable !== undefined ? editValues[row.id].netPayable : val;
        const isModified = Number(currentVal) !== Number(val);
        
        return (
          <div className="flex items-center gap-2">
            <span className={`font-bold ${isModified ? 'text-primary-700' : 'text-slate-800'}`}>
              {formatCurrency(currentVal)}
            </span>
            <button onClick={() => setEditingId(row.id)} className="p-1 text-slate-400 hover:text-primary-600" title="Adjust Amount">
              <Edit size={14} />
            </button>
          </div>
        );
      }
    }
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto flex flex-col h-[calc(100vh-4rem)] md:h-screen">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <div className="p-2 bg-primary-100 text-primary-700 rounded-lg">
              <CalendarDays size={24} />
            </div>
            Monthly Salary Approval
          </h1>
          <p className="text-slate-500 text-sm mt-1">Calculate and credit salaries for Monthly Fixed workers</p>
        </div>
        
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none w-full sm:w-auto"
          />
          <button
            onClick={handleApproveAll}
            disabled={loading || summaryData.length === 0}
            className="px-4 py-2 bg-primary-700 hover:bg-primary-800 disabled:opacity-50 text-white rounded-lg font-medium transition flex items-center gap-2 whitespace-nowrap"
          >
            <CheckCircle size={18} />
            Approve & Credit All
          </button>
        </div>
      </div>
      
      <div className="bg-blue-50 text-blue-800 p-4 rounded-xl mb-4 border border-blue-100 flex gap-3 shrink-0">
        <Info size={20} className="shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-semibold mb-1">How it works:</p>
          <ul className="list-disc pl-4 space-y-1">
            <li>Calculates net pay for <strong>Monthly Fixed</strong> workers only.</li>
            <li>Sundays are considered <strong>paid holidays</strong> (no deduction).</li>
            <li>Absences on non-Sundays deduct 1 day's pay. Half-days deduct 0.5 day's pay.</li>
            <li>When approved, the net payable is added as a <strong>Credit</strong> to the worker's ledger on the 1st day of the <strong>following month</strong>.</li>
          </ul>
        </div>
      </div>

      <div className="flex-1 overflow-hidden bg-white rounded-xl shadow-sm border border-slate-200">
        <DataTable
          columns={columns}
          data={summaryData}
          loading={loading}
          emptyMessage={`No Monthly workers found or no data for ${selectedMonth}`}
        />
      </div>
    </div>
  );
}
