import React, { useState, useEffect } from 'react';
import { Settings2, PlusCircle, Edit2, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import DataTable from '../../components/DataTable';
import FormField from '../../components/FormField';
import ConfirmDialog from '../../components/ConfirmDialog';

export default function ExpenseTypesPage() {
  const [expenseTypes, setExpenseTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({ name: '' });
  const [errors, setErrors] = useState({});
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [selectedType, setSelectedType] = useState(null);

  useEffect(() => {
    loadExpenseTypes();
  }, []);

  const loadExpenseTypes = async () => {
    setLoading(true);
    try {
      const data = await window.db.invoke('expenseTypes:getAll');
      setExpenseTypes(data || []);
    } catch (err) {
      toast.error('Failed to load expense types');
    } finally {
      setLoading(false);
    }
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.name.trim()) newErrors.name = 'Name is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    try {
      if (editingId) {
        await window.db.invoke('expenseTypes:update', editingId, { name: formData.name.trim() });
        toast.success('Expense type updated successfully');
      } else {
        await window.db.invoke('expenseTypes:add', { name: formData.name.trim() });
        toast.success('Expense type added successfully');
      }
      setFormData({ name: '' });
      setIsAdding(false);
      setEditingId(null);
      loadExpenseTypes();
    } catch (err) {
      toast.error(err.message || 'Failed to save expense type');
    }
  };

  const handleEdit = (type) => {
    setFormData({ name: type.name });
    setEditingId(type.id);
    setIsAdding(true);
  };

  const confirmDelete = (type) => {
    setSelectedType(type);
    setIsConfirmOpen(true);
  };

  const handleDelete = async () => {
    try {
      await window.db.invoke('expenseTypes:delete', selectedType.id);
      toast.success('Expense type deleted successfully');
      loadExpenseTypes();
    } catch (err) {
      toast.error('Failed to delete expense type. It might be in use.');
    } finally {
      setIsConfirmOpen(false);
      setSelectedType(null);
    }
  };

  const PROTECTED_TYPES = [
    'Office Expense', 
    'Transport', 
    'Salary', 
    'Worker Salary', 
    'Worker Advance', 
    'Marketing', 
    'Bad Debt', 
    'Advance to Party', 
    'Other'
  ];

  const columns = [
    { key: 'name', label: 'Expense Type', sortable: true, render: (val) => <span className="font-medium text-slate-700">{val}</span> }
  ];

  const actions = (row) => {
    if (PROTECTED_TYPES.includes(row.name)) {
      return <span className="text-xs font-semibold text-slate-400 bg-slate-100 px-2 py-1 rounded">System Default</span>;
    }
    return (
      <>
        <button
          onClick={(e) => { e.stopPropagation(); handleEdit(row) }}
          className="p-1.5 rounded-lg text-slate-400 hover:text-primary-600 hover:bg-slate-100 transition"
          title="Edit"
        >
          <Edit2 size={16} />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); confirmDelete(row) }}
          className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition"
          title="Delete"
        >
          <Trash2 size={16} />
        </button>
      </>
    );
  };

  return (
    <div className="p-6 h-full flex flex-col items-center">
      <div className="w-full max-w-4xl flex-1 flex flex-col">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Expense Types</h1>
            <p className="text-slate-500">Manage categories for your expenses</p>
          </div>
          <button
            onClick={() => {
              setIsAdding(!isAdding);
              if (isAdding) {
                setEditingId(null);
                setFormData({ name: '' });
                setErrors({});
              }
            }}
            className="px-4 py-2 bg-primary-700 hover:bg-primary-800 text-white rounded-lg font-medium transition flex items-center"
          >
            <PlusCircle className="w-4 h-4 mr-2" />
            {isAdding ? 'Cancel' : 'Add New Type'}
          </button>
        </div>

        {isAdding && (
          <div className="mb-6 p-6 bg-white rounded-xl shadow-sm border border-slate-200">
            <h3 className="text-lg font-semibold text-slate-800 mb-4">{editingId ? 'Edit Expense Type' : 'Add New Expense Type'}</h3>
            <form onSubmit={handleSave} className="grid grid-cols-12 gap-4">
              <div className="col-span-12 md:col-span-10">
                <FormField label="Name" required error={errors.name}>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none transition"
                    placeholder="e.g. Refreshments, Transportation, Office Supplies..."
                  />
                </FormField>
              </div>
              <div className="col-span-12 md:col-span-2 flex items-end mb-4">
                <button
                  type="submit"
                  className="w-full px-4 py-2 bg-primary-700 hover:bg-primary-800 text-white rounded-lg font-medium transition"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="flex-1 overflow-hidden bg-white rounded-xl shadow-sm border border-slate-200">
          <DataTable
            columns={columns}
            data={expenseTypes}
            searchable
            searchPlaceholder="Search expense types..."
            loading={loading}
            emptyMessage="No expense types found"
            emptyIcon={Settings2}
            actions={actions}
          />
        </div>

        <ConfirmDialog
          isOpen={isConfirmOpen}
          onConfirm={handleDelete}
          onCancel={() => setIsConfirmOpen(false)}
          title="Delete Expense Type"
          message={`Are you sure you want to delete "${selectedType?.name}"? This action cannot be undone.`}
          confirmText="Delete"
          variant="danger"
        />
      </div>
    </div>
  );
}
