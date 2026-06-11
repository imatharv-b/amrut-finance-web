import React, { useState, useEffect, useContext } from 'react';
import { Gift, Trash2, Edit } from 'lucide-react';
import toast from 'react-hot-toast';
import DataTable from '../../components/DataTable';
import Modal from '../../components/Modal';
import FormField from '../../components/FormField';
import ConfirmDialog from '../../components/ConfirmDialog';
import { SeasonContext } from '../../context/SeasonContext';

export default function SchemeSetupPage() {
  const { activeSeason } = useContext(SeasonContext);
  const [schemes, setSchemes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [selectedScheme, setSelectedScheme] = useState(null);
  const [formData, setFormData] = useState({ name: '', target_amount: '', benefit_description: '' });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (activeSeason) {
      loadSchemes();
    }
  }, [activeSeason]);

  const loadSchemes = async () => {
    setLoading(true);
    try {
      const data = await window.db.invoke('schemes:getAll', activeSeason.id);
      setSchemes(data || []);
    } catch (err) {
      toast.error('Failed to load schemes');
    } finally {
      setLoading(false);
    }
  };

  const openModal = (scheme = null) => {
    setSelectedScheme(scheme);
    if (scheme) {
      setFormData({
        name: scheme.name || '',
        target_amount: scheme.target_amount || '',
        benefit_description: scheme.benefit_description || ''
      });
    } else {
      setFormData({ name: '', target_amount: '', benefit_description: '' });
    }
    setErrors({});
    setIsModalOpen(true);
  };

  const confirmDelete = (scheme) => {
    setSelectedScheme(scheme);
    setIsConfirmOpen(true);
  };

  const handleDelete = async () => {
    try {
      await window.db.invoke('schemes:delete', selectedScheme.id);
      toast.success('Scheme deleted successfully');
      loadSchemes();
    } catch (err) {
      toast.error('Failed to delete scheme');
    } finally {
      setIsConfirmOpen(false);
      setSelectedScheme(null);
    }
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.name.trim()) newErrors.name = 'Scheme name is required';
    if (!formData.target_amount || formData.target_amount <= 0) newErrors.target_amount = 'Target amount is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    try {
      const dataToSave = { 
        ...formData, 
        target_amount: Number(formData.target_amount),
        season_id: activeSeason.id 
      };

      if (selectedScheme) {
        await window.db.invoke('schemes:update', { id: selectedScheme.id, ...dataToSave });
        toast.success('Scheme updated successfully');
      } else {
        await window.db.invoke('schemes:add', dataToSave);
        toast.success('Scheme added successfully');
      }
      setIsModalOpen(false);
      loadSchemes();
    } catch (err) {
      toast.error('Failed to save scheme');
    }
  };

  const columns = [
    { key: 'name', label: 'Scheme Name', sortable: true, render: (val) => <span className="font-medium text-slate-800">{val}</span> },
    { key: 'target_amount', label: 'Target Amount (₹)', sortable: true, render: (val) => `₹${val.toFixed(2)}` },
    { key: 'benefit_description', label: 'Benefit', render: (val) => <span className="text-slate-600">{val || '-'}</span> }
  ];

  const actions = [
    { label: 'Edit', icon: Edit, onClick: openModal },
    { label: 'Delete', icon: Trash2, onClick: confirmDelete, variant: 'danger' }
  ];

  return (
    <div className="p-6 h-full flex flex-col">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Scheme Setup</h1>
          <p className="text-slate-500">Manage reward schemes for {activeSeason?.name}</p>
        </div>
        <button
          onClick={() => openModal()}
          className="px-4 py-2 bg-primary-700 hover:bg-primary-800 text-white rounded-lg font-medium transition flex items-center"
        >
          <Gift className="w-4 h-4 mr-2" />
          Add Scheme
        </button>
      </div>

      <div className="flex-1 overflow-hidden bg-white rounded-xl shadow-sm border border-slate-200">
        <DataTable
          columns={columns}
          data={schemes}
          searchable
          searchPlaceholder="Search schemes..."
          loading={loading}
          emptyMessage="No schemes found for this season"
          emptyIcon={Gift}
          actions={actions}
        />
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={selectedScheme ? 'Edit Scheme' : 'Add Scheme'} size="md">
        <form onSubmit={handleSave} className="space-y-4">
          <FormField label="Scheme Name" required error={errors.name}>
            <input
              type="text"
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none transition"
              placeholder="e.g. Diwali Dhamaka"
            />
          </FormField>
          
          <FormField label="Target Amount (₹)" required error={errors.target_amount}>
            <input
              type="number"
              step="0.01"
              value={formData.target_amount}
              onChange={e => setFormData({ ...formData, target_amount: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none transition"
              placeholder="0.00"
            />
          </FormField>

          <FormField label="Benefit Description">
            <textarea
              rows="3"
              value={formData.benefit_description}
              onChange={e => setFormData({ ...formData, benefit_description: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none transition"
              placeholder="e.g. 5 Gram Gold Coin"
            />
          </FormField>
          
          <div className="flex justify-end space-x-3 mt-6">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-primary-700 hover:bg-primary-800 text-white rounded-lg font-medium transition"
            >
              Save Scheme
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={isConfirmOpen}
        onConfirm={handleDelete}
        onCancel={() => setIsConfirmOpen(false)}
        title="Delete Scheme"
        message={`Are you sure you want to delete "${selectedScheme?.name}"?`}
        confirmText="Delete"
        variant="danger"
      />
    </div>
  );
}
