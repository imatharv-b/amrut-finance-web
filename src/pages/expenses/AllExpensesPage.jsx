import React, { useState, useEffect, useContext } from 'react';
import { useLocation } from 'react-router-dom';
import { Receipt, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import DataTable from '../../components/DataTable';
import ConfirmDialog from '../../components/ConfirmDialog';
import { SeasonContext } from '../../context/SeasonContext';
import { formatDate } from '../../lib/dateUtils';

export default function AllExpensesPage() {
  const location = useLocation();
  const { activeSeason } = useContext(SeasonContext);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState(null);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  useEffect(() => {
    if (activeSeason) {
      loadExpenses();
    }
  }, [activeSeason, fromDate, toDate]);

  const loadExpenses = async () => {
    setLoading(true);
    try {
      const data = await window.db.invoke('expenses:getAll', { 
        season_id: activeSeason.id,
        fromDate: fromDate || undefined,
        toDate: toDate || undefined
      });
      setExpenses(data || []);
    } catch (err) {
      toast.error('Failed to load expenses');
    } finally {
      setLoading(false);
    }
  };

  const confirmDelete = (expense) => {
    setSelectedExpense(expense);
    setIsConfirmOpen(true);
  };

  const handleDelete = async () => {
    try {
      await window.db.invoke('expenses:delete', selectedExpense.id);
      toast.success('Expense deleted successfully');
      loadExpenses();
    } catch (err) {
      toast.error('Failed to delete expense');
    } finally {
      setIsConfirmOpen(false);
      setSelectedExpense(null);
    }
  };

  const columns = [
    { 
      key: 'date', label: 'Date', sortable: true,
      render: (val) => formatDate(val)
    },
    { 
      key: 'type_name', label: 'Type', sortable: true,
      render: (val) => <span className="font-medium text-slate-700">{val || 'General'}</span>
    },
    { key: 'amount', label: 'Amount (₹)', sortable: true, render: (val) => <span className="font-semibold">₹{val.toFixed(2)}</span> },
    { key: 'paid_to', label: 'Paid To', sortable: true },
    { 
      key: 'payment_mode', label: 'Mode',
      render: (val) => (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-800">
          {val}
        </span>
      )
    },
    { key: 'description', label: 'Description', render: (val) => <span className="text-sm text-slate-500 truncate max-w-[200px] block" title={val}>{val}</span> }
  ];

  const actions = [
    { label: 'Delete', icon: Trash2, onClick: confirmDelete, variant: 'danger' }
  ];

  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="p-6 h-full flex flex-col">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">All Expenses</h1>
          <p className="text-slate-500">
            {activeSeason?.name} | Total Expenses: <span className="text-red-600 font-semibold">₹{totalExpenses.toFixed(2)}</span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex flex-col">
            <span className="text-xs text-slate-500 font-medium mb-1">From Date</span>
            <input 
              type="date" 
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div className="flex flex-col">
            <span className="text-xs text-slate-500 font-medium mb-1">To Date</span>
            <input 
              type="date" 
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="flex-1 overflow-hidden bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col">
          <DataTable
            columns={columns}
            data={expenses}
            searchable
            initialSearch={location.state?.search || ''}
            searchPlaceholder="Search expenses by type, paid to, description..."
            loading={loading}
            emptyMessage="No expenses found for this season"
            emptyIcon={Receipt}
            actions={actions}
          />
          
          {/* Summary Footer */}
          {expenses.length > 0 && (
            <div className="bg-slate-100 p-3 sm:p-4 border-t border-slate-200 flex flex-col sm:flex-row justify-between sm:justify-end items-center gap-2 sm:gap-6 shrink-0 z-20 rounded-b-xl">
              <span className="text-slate-800 uppercase tracking-wider text-xs font-bold text-center w-full sm:w-auto">Total Expenses:</span>
              <div className="flex justify-center sm:justify-end w-full sm:w-auto font-bold text-sm">
                <span className="text-red-700 flex flex-col items-center sm:items-end">
                  <span className="text-[10px] text-slate-500 font-normal uppercase">Amount</span>
                  ₹{totalExpenses.toFixed(2)}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        isOpen={isConfirmOpen}
        onConfirm={handleDelete}
        onCancel={() => setIsConfirmOpen(false)}
        title="Delete Expense"
        message={`Are you sure you want to delete this expense of ₹${selectedExpense?.amount}? This action cannot be undone.`}
        confirmText="Delete"
        variant="danger"
      />
    </div>
  );
}
