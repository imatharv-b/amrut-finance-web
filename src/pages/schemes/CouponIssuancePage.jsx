import React, { useState, useEffect, useContext } from 'react';
import { Tag, Trash2, Edit } from 'lucide-react';
import toast from 'react-hot-toast';
import DataTable from '../../components/DataTable';
import Modal from '../../components/Modal';
import FormField from '../../components/FormField';
import SearchableSelect from '../../components/SearchableSelect';
import ConfirmDialog from '../../components/ConfirmDialog';
import { SeasonContext } from '../../context/SeasonContext';

export default function CouponIssuancePage() {
  const { activeSeason } = useContext(SeasonContext);
  const [coupons, setCoupons] = useState([]);
  const [schemes, setSchemes] = useState([]);
  const [parties, setParties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [selectedCoupon, setSelectedCoupon] = useState(null);
  const [formData, setFormData] = useState({ scheme_id: '', party_id: '', coupon_no: '', date_issued: new Date().toISOString().split('T')[0] });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (activeSeason) {
      loadInitialData();
    }
  }, [activeSeason]);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      const [couponsData, schemesData, partiesData] = await Promise.all([
        window.db.invoke('coupons:getAll', activeSeason.id),
        window.db.invoke('schemes:getAll', activeSeason.id),
        window.db.invoke('parties:getAll')
      ]);
      setCoupons(couponsData || []);
      setSchemes(schemesData || []);
      setParties(partiesData.map(p => ({ value: p.id, label: p.name, sublabel: p.village })));
    } catch (err) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const loadCoupons = async () => {
    try {
      const data = await window.db.invoke('coupons:getAll', activeSeason.id);
      setCoupons(data || []);
    } catch (err) {
      toast.error('Failed to refresh coupons');
    }
  };

  const openModal = (coupon = null) => {
    setSelectedCoupon(coupon);
    if (coupon) {
      setFormData({
        scheme_id: coupon.scheme_id || '',
        party_id: coupon.party_id || '',
        coupon_no: coupon.coupon_no || '',
        date_issued: coupon.date_issued || new Date().toISOString().split('T')[0]
      });
    } else {
      setFormData({ scheme_id: '', party_id: '', coupon_no: '', date_issued: new Date().toISOString().split('T')[0] });
    }
    setErrors({});
    setIsModalOpen(true);
  };

  const confirmDelete = (coupon) => {
    setSelectedCoupon(coupon);
    setIsConfirmOpen(true);
  };

  const handleDelete = async () => {
    try {
      await window.db.invoke('coupons:delete', selectedCoupon.id);
      toast.success('Coupon deleted successfully');
      loadCoupons();
    } catch (err) {
      toast.error('Failed to delete coupon');
    } finally {
      setIsConfirmOpen(false);
      setSelectedCoupon(null);
    }
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.scheme_id) newErrors.scheme_id = 'Scheme is required';
    if (!formData.party_id) newErrors.party_id = 'Party is required';
    if (!formData.coupon_no.trim()) newErrors.coupon_no = 'Coupon number is required';
    if (!formData.date_issued) newErrors.date_issued = 'Issue date is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    try {
      if (selectedCoupon) {
        await window.db.invoke('coupons:update', { id: selectedCoupon.id, ...formData });
        toast.success('Coupon updated successfully');
      } else {
        await window.db.invoke('coupons:add', formData);
        toast.success('Coupon issued successfully');
      }
      setIsModalOpen(false);
      loadCoupons();
    } catch (err) {
      toast.error('Failed to save coupon');
    }
  };

  const columns = [
    { key: 'date_issued', label: 'Date Issued', sortable: true },
    { key: 'coupon_no', label: 'Coupon No', sortable: true, render: (val) => <span className="font-bold text-slate-800 tracking-wider bg-slate-100 px-2 py-1 rounded">{val}</span> },
    { key: 'party_name', label: 'Party', sortable: true, render: (val) => <span className="font-medium text-slate-700">{val}</span> },
    { key: 'scheme_name', label: 'Scheme', sortable: true }
  ];

  const actions = [
    { label: 'Edit', icon: Edit, onClick: openModal },
    { label: 'Delete', icon: Trash2, onClick: confirmDelete, variant: 'danger' }
  ];

  return (
    <div className="p-4 sm:p-6 h-full flex flex-col">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Coupon Issuance</h1>
          <p className="text-slate-500">Track scheme coupons for {activeSeason?.name}</p>
        </div>
        <button
          onClick={() => openModal()}
          className="px-4 py-2.5 bg-primary-700 hover:bg-primary-800 text-white rounded-lg font-medium transition flex items-center justify-center md:w-auto w-full shadow-sm"
        >
          <Tag className="w-5 h-5 mr-2" />
          Issue Coupon
        </button>
      </div>

      <div className="flex-1 overflow-hidden bg-white rounded-xl shadow-sm border border-slate-200">
        <DataTable
          columns={columns}
          data={coupons}
          searchable
          searchPlaceholder="Search by coupon number, party..."
          loading={loading}
          emptyMessage="No coupons issued for this season"
          emptyIcon={Tag}
          actions={actions}
          renderMobileCard={(row) => (
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col gap-3">
              <div className="flex justify-between items-start border-b border-slate-100 pb-3">
                <div>
                  <p className="text-xs text-slate-500 mb-1">{row.date_issued}</p>
                  <span className="font-bold text-slate-800 tracking-wider bg-slate-100 px-2 py-1 rounded text-lg">
                    {row.coupon_no}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={(e) => { e.stopPropagation(); openModal(row); }} className="p-2 text-slate-400 hover:text-primary-600 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors">
                    <Edit size={16} />
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); confirmDelete(row); }} className="p-2 text-slate-400 hover:text-red-600 bg-slate-50 hover:bg-red-50 rounded-lg transition-colors">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-0.5">Party</p>
                <p className="font-medium text-slate-700">{row.party_name}</p>
              </div>
              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                <p className="text-xs text-slate-500 mb-0.5">Scheme</p>
                <p className="font-semibold text-primary-700">{row.scheme_name}</p>
              </div>
            </div>
          )}
        />
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={selectedCoupon ? 'Edit Coupon' : 'Issue Coupon'} size="md">
        <form onSubmit={handleSave} className="space-y-4">
          <FormField label="Date Issued" required error={errors.date_issued}>
            <input
              type="date"
              value={formData.date_issued}
              onChange={e => setFormData({ ...formData, date_issued: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none transition"
            />
          </FormField>
          
          <FormField label="Scheme" required error={errors.scheme_id}>
            <select
              value={formData.scheme_id}
              onChange={e => setFormData({ ...formData, scheme_id: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none transition bg-white"
            >
              <option value="">Select Scheme...</option>
              {schemes.map(s => (
                <option key={s.id} value={s.id}>{s.name} (Target: ₹{s.target_amount})</option>
              ))}
            </select>
          </FormField>

          <FormField label="Party" required error={errors.party_id}>
            <SearchableSelect
              options={parties}
              value={formData.party_id}
              onChange={v => setFormData({ ...formData, party_id: v })}
              placeholder="Select Party..."
            />
          </FormField>

          <FormField label="Coupon Number" required error={errors.coupon_no}>
            <input
              type="text"
              value={formData.coupon_no}
              onChange={e => setFormData({ ...formData, coupon_no: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none transition uppercase font-bold tracking-wider"
              placeholder="e.g. AB-1024"
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
              Save Coupon
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={isConfirmOpen}
        onConfirm={handleDelete}
        onCancel={() => setIsConfirmOpen(false)}
        title="Delete Coupon"
        message={`Are you sure you want to delete coupon ${selectedCoupon?.coupon_no}?`}
        confirmText="Delete"
        variant="danger"
      />
    </div>
  );
}
