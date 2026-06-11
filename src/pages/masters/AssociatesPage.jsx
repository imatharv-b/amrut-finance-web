import React, { useState, useEffect } from 'react';
import { UserCheck, Edit, ShieldCheck, ShieldOff, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import DataTable from '../../components/DataTable';
import Modal from '../../components/Modal';
import FormField from '../../components/FormField';
import ConfirmDialog from '../../components/ConfirmDialog';

export default function AssociatesPage() {
  const [associates, setAssociates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [selectedAssociate, setSelectedAssociate] = useState(null);
  const [formData, setFormData] = useState({ name: '', mobile: '', zone: '' });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    loadAssociates();
  }, []);

  const loadAssociates = async () => {
    setLoading(true);
    try {
      const data = await window.db.invoke('associates:getAll');
      setAssociates(data || []);
    } catch (err) {
      toast.error('Failed to load sale associates');
    } finally {
      setLoading(false);
    }
  };

  const openModal = (associate = null) => {
    setSelectedAssociate(associate);
    if (associate) {
      setFormData({
        name: associate.name || '',
        mobile: associate.mobile || '',
        zone: associate.zone || ''
      });
    } else {
      setFormData({ name: '', mobile: '', zone: '' });
    }
    setErrors({});
    setIsModalOpen(true);
  };

  const handleToggle = async (id) => {
    try {
      await window.db.invoke('associates:toggle', id);
      toast.success('Status updated');
      loadAssociates();
    } catch (err) {
      toast.error('Failed to update status');
    }
  };

  const confirmDelete = (associate) => {
    setSelectedAssociate(associate);
    setIsConfirmOpen(true);
  };

  const handleDelete = async () => {
    try {
      await window.db.invoke('associates:delete', selectedAssociate.id);
      toast.success('Associate deleted successfully');
      loadAssociates();
    } catch (err) {
      toast.error('Failed to delete associate');
    } finally {
      setIsConfirmOpen(false);
      setSelectedAssociate(null);
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
      if (selectedAssociate) {
        await window.db.invoke('associates:update', { id: selectedAssociate.id, ...formData });
        toast.success('Associate updated successfully');
      } else {
        await window.db.invoke('associates:add', formData);
        toast.success('Associate added successfully');
      }
      setIsModalOpen(false);
      loadAssociates();
    } catch (err) {
      toast.error('Failed to save associate');
    }
  };

  const columns = [
    { key: 'name', label: 'Name', sortable: true },
    { key: 'mobile', label: 'Mobile' },
    { key: 'zone', label: 'Zone', sortable: true },
    { 
      key: 'is_active', label: 'Status', sortable: true,
      render: (val) => (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${val ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          {val ? 'Active' : 'Inactive'}
        </span>
      )
    }
  ];

  const actions = [
    { label: 'Edit', icon: Edit, onClick: openModal },
    { 
      label: 'Toggle Status', 
      icon: ShieldCheck, 
      onClick: (row) => handleToggle(row.id) 
    },
    { label: 'Delete', icon: Trash2, onClick: confirmDelete, variant: 'danger' }
  ];

  const activeCount = associates.filter(a => a.is_active).length;

  return (
    <div className="p-6 h-full flex flex-col">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Sale Associates</h1>
          <p className="text-slate-500">Total: {associates.length} | Active: <span className="text-green-600 font-medium">{activeCount}</span></p>
        </div>
        <button
          onClick={() => openModal()}
          className="px-4 py-2 bg-primary-700 hover:bg-primary-800 text-white rounded-lg font-medium transition flex items-center"
        >
          <UserCheck className="w-4 h-4 mr-2" />
          Add Associate
        </button>
      </div>

      <div className="flex-1 overflow-hidden bg-white rounded-xl shadow-sm border border-slate-200">
        <DataTable
          columns={columns}
          data={associates}
          searchable
          searchPlaceholder="Search associates by name, zone..."
          loading={loading}
          emptyMessage="No associates found"
          emptyIcon={UserCheck}
          actions={actions}
        />
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={selectedAssociate ? 'Edit Associate' : 'Add Associate'} size="md">
        <form onSubmit={handleSave} className="space-y-4">
          <FormField label="Name" required error={errors.name}>
            <input
              type="text"
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none transition"
              placeholder="e.g. Ramesh Kumar"
            />
          </FormField>
          <FormField label="Mobile">
            <input
              type="text"
              value={formData.mobile}
              onChange={e => setFormData({ ...formData, mobile: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none transition"
            />
          </FormField>
          <FormField label="Zone">
            <input
              type="text"
              value={formData.zone}
              onChange={e => setFormData({ ...formData, zone: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none transition"
              placeholder="e.g. Nagpur East"
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
              Save Associate
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={isConfirmOpen}
        onCancel={() => setIsConfirmOpen(false)}
        onConfirm={handleDelete}
        title="Delete Associate"
        message={`Are you sure you want to delete ${selectedAssociate?.name}? This action cannot be undone.`}
        confirmText="Delete"
      />
    </div>
  );
}
