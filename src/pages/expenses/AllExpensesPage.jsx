import React, { useState, useEffect, useContext } from 'react';
import { Receipt, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import DataTable from '../../components/DataTable';
import ConfirmDialog from '../../components/ConfirmDialog';
import { SeasonContext } from '../../context/SeasonContext';

export default function AllExpensesPage() {
  const { activeSeason } = useContext(SeasonContext);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState(null);

  useEffect(() => {
    if (activeSeason) {
      loadExpenses();
    }
  }, [activeSeason]);

  const loadExpenses = async () => {
    setLoading(true);
    try {
      const data = await window.db.invoke('expenses:getAll', { season_id: activeSeason.id });
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
    { key: 'date', label: 'Date', sortable: true },
    { 
      key: 'expense_type_name', label: 'Type', sortable: true,
      render: (val) => <span className="font-medium text-slate-700">{val}</span>
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
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">All Expenses</h1>
          <p className="text-slate-500">
            {activeSeason?.name} | Total Expenses: <span className="text-red-600 font-semibold">₹{totalExpenses.toFixed(2)}</span>
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-hidden bg-white rounded-xl shadow-sm border border-slate-200">
        <DataTable
          columns={columns}
          data={expenses}
          searchable
          searchPlaceholder="Search expenses by type, paid to, description..."
          loading={loading}
          emptyMessage="No expenses found for this season"
          emptyIcon={Receipt}
          actions={actions}
        />
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
