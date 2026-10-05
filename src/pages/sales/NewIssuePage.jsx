import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { Save, Plus, Trash2, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import FormField from '../../components/FormField';
import SearchableSelect from '../../components/SearchableSelect';
import { SeasonContext } from '../../context/SeasonContext';

export default function NewIssuePage() {
  const navigate = useNavigate();
  const { activeSeason } = useContext(SeasonContext);
  
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState([]);
  
  const [formData, setFormData] = useState({
    issue_no: '',
    date: new Date().toISOString().split('T')[0],
    remarks: ''
  });

  const [items, setItems] = useState([
    { id: 1, product_id: '', unit: '', qty: '' }
  ]);

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      const [prods, nextNo] = await Promise.all([
        window.db.invoke('products:getAll'),
        window.db.invoke('issues:getNextNo')
      ]);
      setProducts(prods);
      setFormData(prev => ({ ...prev, issue_no: nextNo }));
    } catch (error) {
      toast.error('Failed to load initial data');
    }
  };

  const addItem = () => {
    setItems([...items, { id: Date.now(), product_id: '', unit: '', qty: '' }]);
  };

  const removeItem = (id) => {
    if (items.length === 1) return;
    setItems(items.filter(item => item.id !== id));
  };

  const updateItem = (id, field, value) => {
    setItems(items.map(item => {
      if (item.id === id) {
        const updated = { ...item, [field]: value };
        if (field === 'product_id') {
          const product = products.find(p => p.id === value);
          if (product) updated.unit = product.unit;
        }
        return updated;
      }
      return item;
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!activeSeason) {
      toast.error('Please select a season first');
      return;
    }

    const validItems = items.filter(i => i.product_id && i.qty > 0);
    if (validItems.length === 0) {
      toast.error('Please add at least one valid item');
      return;
    }

    setLoading(true);
    try {
      const issueData = {
        season_id: activeSeason.id,
        ...formData,
        items: validItems.map(i => ({
          product_id: i.product_id,
          qty: Number(i.qty),
          unit: i.unit
        }))
      };

      await window.db.invoke('issues:add', issueData);
      toast.success('Stock issued successfully!');
      navigate('/sales/issues');
    } catch (error) {
      toast.error(error.message || 'Failed to issue stock');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => navigate('/sales/issues')} className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Issue Stock</h1>
          <p className="text-slate-500 text-sm">Issue items on consignment</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <FormField label="Issue No." required>
              <input type="text" value={formData.issue_no} readOnly className="w-full px-4 py-2 border border-slate-300 rounded-lg bg-slate-50" />
            </FormField>
            
            <FormField label="Date" required>
              <input type="date" required value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" />
            </FormField>
            
            <FormField label="Remarks">
              <input type="text" value={formData.remarks} onChange={(e) => setFormData({ ...formData, remarks: e.target.value })} placeholder="Optional notes" className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" />
            </FormField>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
            <h2 className="font-semibold text-slate-800">Items</h2>
            <button type="button" onClick={addItem} className="text-primary-600 hover:text-primary-700 text-sm font-medium flex items-center gap-1">
              <Plus className="w-4 h-4" /> Add Item
            </button>
          </div>
          
          <div className="p-6 overflow-x-auto">
            <table className="w-full text-left whitespace-nowrap">
              <thead>
                <tr className="text-sm font-medium text-slate-500 border-b border-slate-200">
                  <th className="pb-3 w-12">#</th>
                  <th className="pb-3 min-w-[300px]">Product</th>
                  <th className="pb-3 w-32">Unit</th>
                  <th className="pb-3 w-32">Qty</th>
                  <th className="pb-3 w-16"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((item, index) => (
                  <tr key={item.id}>
                    <td className="py-3 text-sm text-slate-500">{index + 1}</td>
                    <td className="py-3 pr-4">
                      <SearchableSelect
                        options={products.map(p => ({ value: p.id, label: p.name, sublabel: p.unit }))}
                        value={item.product_id}
                        onChange={(val) => updateItem(item.id, 'product_id', val)}
                        placeholder="Select Product..."
                        required
                      />
                    </td>
                    <td className="py-3 pr-4">
                      <input type="text" value={item.unit} readOnly className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-500" />
                    </td>
                    <td className="py-3 pr-4">
                      <input type="number" step="0.01" min="0" required value={item.qty} onChange={(e) => updateItem(item.id, 'qty', e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none" />
                    </td>
                    <td className="py-3 text-right">
                      <button type="button" onClick={() => removeItem(item.id)} disabled={items.length === 1} className="p-2 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50 disabled:opacity-50">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <button type="button" onClick={() => navigate('/sales/issues')} className="px-6 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl font-medium transition">
            Cancel
          </button>
          <button type="submit" disabled={loading} className="px-6 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-medium transition shadow-sm flex items-center gap-2">
            <Save className="w-4 h-4" />
            {loading ? 'Saving...' : 'Save Issue'}
          </button>
        </div>
      </form>
    </div>
  );
}
