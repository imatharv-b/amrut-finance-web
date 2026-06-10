import React, { useState, useEffect } from 'react';
import { Settings2, PlusCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import DataTable from '../../components/DataTable';
import FormField from '../../components/FormField';

export default function ExpenseTypesPage() {
  const [expenseTypes, setExpenseTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [formData, setFormData] = useState({ name: '' });
  const [errors, setErrors] = useState({});

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
      await window.db.invoke('expenseTypes:add', { name: formData.name.trim() });
      toast.success('Expense type added successfully');
      setFormData({ name: '' });
      setIsAdding(false);
      loadExpenseTypes();
    } catch (err) {
      toast.error(err.message || 'Failed to add expense type');
    }
  };

  const columns = [
    { key: 'name', label: 'Expense Type', sortable: true, render: (val) => <span className="font-medium text-slate-700">{val}</span> }
  ];

  return (
    <div className="p-6 h-full flex flex-col items-center">
      <div className="w-full max-w-4xl flex-1 flex flex-col">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Expense Types</h1>
            <p className="text-slate-500">Manage categories for your expenses</p>
          </div>
          <button
            onClick={() => setIsAdding(!isAdding)}
            className="px-4 py-2 bg-primary-700 hover:bg-primary-800 text-white rounded-lg font-medium transition flex items-center"
          >
            <PlusCircle className="w-4 h-4 mr-2" />
            {isAdding ? 'Cancel' : 'Add New Type'}
          </button>
        </div>

        {isAdding && (
          <div className="mb-6 p-6 bg-white rounded-xl shadow-sm border border-slate-200">
            <h3 className="text-lg font-semibold text-slate-800 mb-4">Add New Expense Type</h3>
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
            // actions={null} // Preset types shouldn't be deleted easily
          />
        </div>
      </div>
    </div>
  );
}
