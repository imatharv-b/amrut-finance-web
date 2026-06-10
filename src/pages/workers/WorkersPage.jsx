import React, { useState, useEffect } from 'react';
import { Briefcase, PlusCircle, Search, Edit2 } from 'lucide-react';
import toast from 'react-hot-toast';
import DataTable from '../../components/DataTable';
import FormField from '../../components/FormField';

export default function WorkersPage() {
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({ name: '', phone: '', salary_type: 'Daily', salary_amount: '', taking_salary: '', opening_balance: '0' });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    loadWorkers();
  }, []);

  const loadWorkers = async () => {
    setLoading(true);
    try {
      const data = await window.db.invoke('workers:getAll');
      setWorkers(data || []);
    } catch (err) {
      toast.error('Failed to load workers');
    } finally {
      setLoading(false);
    }
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.name.trim()) newErrors.name = 'Name is required';
    if (!formData.salary_amount || formData.salary_amount <= 0) newErrors.salary_amount = 'Valid amount is required';
    if (!formData.taking_salary || formData.taking_salary <= 0) newErrors.taking_salary = 'Valid taking salary is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    try {
      if (editingId) {
        await window.db.invoke('workers:update', editingId, {
          ...formData,
          salary_amount: Number(formData.salary_amount),
          taking_salary: Number(formData.taking_salary),
          opening_balance: Number(formData.opening_balance || 0)
        });
        toast.success('Worker updated successfully');
      } else {
        await window.db.invoke('workers:add', {
          ...formData,
          salary_amount: Number(formData.salary_amount),
          taking_salary: Number(formData.taking_salary),
          opening_balance: Number(formData.opening_balance || 0)
        });
        toast.success('Worker added successfully');
      }
      setFormData({ name: '', phone: '', salary_type: 'Daily', salary_amount: '', taking_salary: '', opening_balance: '0' });
      setIsAdding(false);
      setEditingId(null);
      loadWorkers();
    } catch (err) {
      toast.error(err.message || 'Failed to add worker');
    }
  };

  const formatCurrency = (val) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(val || 0);

  const handleEditClick = (worker) => {
    setFormData({
      name: worker.name,
      phone: worker.phone || '',
      salary_type: worker.salary_type,
      salary_amount: worker.salary_amount,
      taking_salary: worker.taking_salary,
      opening_balance: worker.opening_balance
    });
    setEditingId(worker.id);
    setIsAdding(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const columns = [
    { key: 'name', label: 'Name', sortable: true, render: (val) => <span className="font-semibold text-slate-800">{val}</span> },
    { key: 'phone', label: 'Phone', render: (val) => <span className="text-slate-600">{val || '-'}</span> },
    { key: 'salary_type', label: 'Salary Type', render: (val) => (
      <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${
        val === 'Daily' ? 'bg-blue-100 text-blue-700' :
        val === 'Monthly' ? 'bg-purple-100 text-purple-700' :
        'bg-orange-100 text-orange-700'
      }`}>
        {val}
      </span>
    )},
    { key: 'salary_amount', label: 'Ledger Rate', render: (val) => <span className="font-medium text-emerald-600">{formatCurrency(val)}</span> },
    { key: 'taking_salary', label: 'Taking Salary', render: (val) => <span className="font-medium text-blue-600">{formatCurrency(val)}</span> },
    { key: 'opening_balance', label: 'Opening Bal.', render: (val) => <span className="text-slate-600">{formatCurrency(val)}</span> },
    {
      key: 'actions',
      label: 'Actions',
      render: (_, worker) => (
        <button
          onClick={() => handleEditClick(worker)}
          className="p-1.5 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition"
          title="Edit Worker"
        >
          <Edit2 className="w-4 h-4" />
        </button>
      )
    }
  ];

  return (
    <div className="p-6 h-full flex flex-col items-center">
      <div className="w-full max-w-5xl flex-1 flex flex-col">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center">
            <div className="p-3 bg-indigo-100 text-indigo-600 rounded-xl mr-4">
              <Briefcase className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-800">Workers</h1>
              <p className="text-slate-500">Manage worker profiles and salary structures</p>
            </div>
          </div>
          <button
            onClick={() => {
              if (isAdding) {
                setIsAdding(false);
                setEditingId(null);
                setFormData({ name: '', phone: '', salary_type: 'Daily', salary_amount: '', taking_salary: '', opening_balance: '0' });
              } else {
                setIsAdding(true);
              }
            }}
            className="px-4 py-2 bg-primary-700 hover:bg-primary-800 text-white rounded-lg font-medium transition flex items-center"
          >
            <PlusCircle className="w-4 h-4 mr-2" />
            {isAdding ? 'Cancel' : 'Add New Worker'}
          </button>
        </div>

        {isAdding && (
          <div className="mb-6 p-6 bg-white rounded-xl shadow-sm border border-slate-200">
            <h3 className="text-lg font-semibold text-slate-800 mb-4">{editingId ? 'Edit Worker' : 'Add New Worker'}</h3>
            <form onSubmit={handleSave} className="grid grid-cols-12 gap-4">
              <div className="col-span-12 md:col-span-4">
                <FormField label="Full Name" required error={errors.name}>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    placeholder="e.g. Ramesh Singh"
                  />
                </FormField>
              </div>
              <div className="col-span-12 md:col-span-3">
                <FormField label="Phone">
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    placeholder="Phone number"
                  />
                </FormField>
              </div>
              <div className="col-span-12 md:col-span-3">
                <FormField label="Salary Type" required>
                  <select
                    value={formData.salary_type}
                    onChange={e => setFormData({ ...formData, salary_type: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 bg-white"
                  >
                    <option value="Daily">Daily Wages</option>
                    <option value="Monthly">Monthly Fixed</option>
                    <option value="Commission">Commission Basis</option>
                  </select>
                </FormField>
              </div>
              <div className="col-span-12 md:col-span-2">
                <FormField label="Ledger Rate (₹)" required error={errors.salary_amount}>
                  <input
                    type="number"
                    value={formData.salary_amount}
                    onChange={e => setFormData({ ...formData, salary_amount: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    placeholder="0.00"
                  />
                </FormField>
              </div>
              <div className="col-span-12 md:col-span-2">
                <FormField label="Taking Salary (₹)" required error={errors.taking_salary}>
                  <input
                    type="number"
                    value={formData.taking_salary}
                    onChange={e => setFormData({ ...formData, taking_salary: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    placeholder="0.00"
                  />
                </FormField>
              </div>
              
              <div className="col-span-12 md:col-span-4 mt-2">
                <FormField label="Opening Balance (₹)">
                  <input
                    type="number"
                    value={formData.opening_balance}
                    onChange={e => setFormData({ ...formData, opening_balance: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    placeholder="0.00"
                  />
                </FormField>
              </div>
              <div className="col-span-12 md:col-span-10 flex flex-col justify-end mt-2">
                <button type="submit" className="self-end px-6 py-2.5 bg-primary-700 hover:bg-primary-800 text-white rounded-lg font-medium transition">
                  {editingId ? 'Update Worker' : 'Save Worker'}
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="flex-1 overflow-hidden bg-white rounded-xl shadow-sm border border-slate-200">
          <DataTable
            columns={columns}
            data={workers}
            searchable
            searchPlaceholder="Search workers..."
            loading={loading}
            emptyMessage="No workers found."
            emptyIcon={Briefcase}
          />
        </div>
      </div>
    </div>
  );
}
