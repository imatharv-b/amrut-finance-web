import React, { useState, useEffect, useContext } from 'react';
import { PlusCircle, Receipt } from 'lucide-react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { SeasonContext } from '../../context/SeasonContext';
import FormField from '../../components/FormField';
import SearchableSelect from '../../components/SearchableSelect';

export default function NewExpensePage() {
  const navigate = useNavigate();
  const { activeSeason } = useContext(SeasonContext);
  
  const [expenseTypes, setExpenseTypes] = useState([]);
  const [parties, setParties] = useState([]);
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    expense_type_id: '',
    amount: '',
    paid_to: '',
    payment_mode: 'Cash',
    description: '',
    party_id: ''
  });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      const [typesData, partiesData] = await Promise.all([
        window.db.invoke('expenseTypes:getAll'),
        window.db.invoke('parties:getAll')
      ]);
      setExpenseTypes(typesData || []);
      setParties(partiesData.map(p => ({ value: p.id, label: p.name, sublabel: p.village })));
    } catch (err) {
      toast.error('Failed to load initial data');
    }
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.date) newErrors.date = 'Date is required';
    if (!formData.expense_type_id) newErrors.expense_type_id = 'Expense type is required';
    if (!formData.amount || formData.amount <= 0) newErrors.amount = 'Valid amount is required';
    
    const selectedType = expenseTypes.find(t => t.id === Number(formData.expense_type_id));
    if (selectedType && (selectedType.name === 'Bad Debt' || selectedType.name === 'Advance to Party')) {
      if (!formData.party_id) {
        newErrors.party_id = 'Party selection is required for this expense type';
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    
    if (!activeSeason) {
      toast.error('No active season found');
      return;
    }

    setLoading(true);
    try {
      await window.db.invoke('expenses:add', {
        ...formData,
        season_id: activeSeason.id,
        amount: Number(formData.amount)
      });
      toast.success('Expense recorded successfully');
      navigate('/expenses/all');
    } catch (err) {
      toast.error('Failed to save expense');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 h-full flex flex-col items-center">
      <div className="w-full max-w-3xl">
        <div className="flex items-center mb-6">
          <div className="p-3 bg-red-100 text-red-600 rounded-xl mr-4">
            <Receipt className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">New Expense</h1>
            <p className="text-slate-500">Record a new expense for {activeSeason?.name || 'the current season'}</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
          <form onSubmit={handleSave} className="space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <FormField label="Date" required error={errors.date}>
                <input
                  type="date"
                  value={formData.date}
                  onChange={e => setFormData({ ...formData, date: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none transition"
                />
              </FormField>
              
              <FormField label="Expense Type" required error={errors.expense_type_id}>
                <select
                  value={formData.expense_type_id}
                  onChange={e => setFormData({ ...formData, expense_type_id: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none transition bg-white"
                >
                  <option value="">Select an expense type...</option>
                  {expenseTypes.map(type => (
                    <option key={type.id} value={type.id}>{type.name}</option>
                  ))}
                </select>
              </FormField>

              {(() => {
                const selectedType = expenseTypes.find(t => t.id === Number(formData.expense_type_id));
                if (selectedType && (selectedType.name === 'Bad Debt' || selectedType.name === 'Advance to Party')) {
                  return (
                    <FormField label="Select Party" required error={errors.party_id}>
                      <SearchableSelect
                        options={parties}
                        value={formData.party_id}
                        onChange={v => setFormData({ ...formData, party_id: v })}
                        placeholder="Search and select party..."
                      />
                    </FormField>
                  );
                }
                return null;
              })()}
            </div>

            <div className="grid grid-cols-2 gap-6">
              <FormField label="Amount (₹)" required error={errors.amount}>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.amount}
                  onChange={e => setFormData({ ...formData, amount: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none transition"
                  placeholder="0.00"
                />
              </FormField>
              
              <FormField label="Payment Mode">
                <div className="flex space-x-6 mt-2">
                  {['Cash', 'Bank', 'UPI'].map(mode => (
                    <label key={mode} className="flex items-center cursor-pointer">
                      <input
                        type="radio"
                        name="payment_mode"
                        value={mode}
                        checked={formData.payment_mode === mode}
                        onChange={e => setFormData({ ...formData, payment_mode: e.target.value })}
                        className="w-4 h-4 text-primary-600 focus:ring-primary-500"
                      />
                      <span className="ml-2 text-slate-700 font-medium">{mode}</span>
                    </label>
                  ))}
                </div>
              </FormField>
            </div>

            <FormField label="Paid To (Optional)">
              <input
                type="text"
                value={formData.paid_to}
                onChange={e => setFormData({ ...formData, paid_to: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none transition"
                placeholder="Name of person or vendor..."
              />
            </FormField>

            <FormField label="Description">
              <textarea
                rows="3"
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none transition"
                placeholder="Brief details about the expense..."
              />
            </FormField>

            <div className="pt-4 flex justify-end">
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2.5 bg-primary-700 hover:bg-primary-800 text-white rounded-lg font-medium transition flex items-center shadow-sm disabled:opacity-50"
              >
                <PlusCircle className="w-5 h-5 mr-2" />
                {loading ? 'Saving...' : 'Save Expense'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
