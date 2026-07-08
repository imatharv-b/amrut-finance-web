import React, { useState, useEffect, useContext } from 'react';
import { CreditCard, Trash2, Edit, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import DataTable from '../../components/DataTable';
import Modal from '../../components/Modal';
import FormField from '../../components/FormField';
import SearchableSelect from '../../components/SearchableSelect';
import ConfirmDialog from '../../components/ConfirmDialog';
import { formatDate } from '../../lib/dateUtils';
import { SeasonContext } from '../../context/SeasonContext';
import { useCompany } from '../../context/CompanyContext';

export default function RecordPaymentPage() {
  const { activeSeason, allSeasons } = useContext(SeasonContext);
  const { userRole } = useCompany();
  const [payments, setPayments] = useState([]);
  const [parties, setParties] = useState([]);
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  
  // Change Season state
  const [isSeasonModalOpen, setIsSeasonModalOpen] = useState(false);
  const [seasonPayment, setSeasonPayment] = useState(null);
  const [targetSeasonId, setTargetSeasonId] = useState('');
  
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    party_id: '',
    amount: '',
    mode: 'Cash',
    payment_type: 'Payment from Party',
    remarks: '',
    coupon_no: ''
  });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    loadInitialData();
  }, [fromDate, toDate]);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      const [paymentsData, partiesData, couponsData] = await Promise.all([
        window.db.invoke('payments:getAll', { fromDate: fromDate || undefined, toDate: toDate || undefined }),
        window.db.invoke('parties:getAll'),
        window.db.invoke('coupons:getAll')
      ]);
      setPayments(paymentsData || []);
      setParties(partiesData.map(p => ({ value: p.id, label: p.name, sublabel: `Bal: ₹${p.balance.toFixed(2)}` })));
      setCoupons(couponsData || []);
    } catch (err) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const loadPayments = async () => {
    try {
      const data = await window.db.invoke('payments:getAll', { fromDate: fromDate || undefined, toDate: toDate || undefined });
      setPayments(data || []);
      // Also silently reload parties to update balances in the dropdown
      const partiesData = await window.db.invoke('parties:getAll');
      setParties(partiesData.map(p => ({ value: p.id, label: p.name, sublabel: `Bal: ₹${p.balance.toFixed(2)}` })));
    } catch (err) {
      toast.error('Failed to refresh payments');
    }
  };

  const openModal = (payment = null) => {
    setSelectedPayment(payment);
    if (payment) {
      setFormData({
        date: payment.date || new Date().toISOString().split('T')[0],
        party_id: payment.party_id || '',
        amount: payment.amount || '',
        mode: payment.mode || 'Cash',
        payment_type: payment.payment_type || 'Payment from Party',
        remarks: payment.remarks || '',
        coupon_no: payment.coupon_no || ''
      });
    } else {
      setFormData({
        date: new Date().toISOString().split('T')[0],
        party_id: '',
        amount: '',
        mode: 'Cash',
        payment_type: 'Payment from Party',
        remarks: '',
        coupon_no: ''
      });
    }
    setErrors({});
    setIsModalOpen(true);
  };

  const confirmDelete = (payment) => {
    setSelectedPayment(payment);
    setIsConfirmOpen(true);
  };

  const handleDelete = async () => {
    try {
      await window.db.invoke('payments:delete', selectedPayment.id);
      toast.success('Receipt deleted successfully');
      loadPayments();
    } catch (err) {
      toast.error('Failed to delete receipt');
    } finally {
      setIsConfirmOpen(false);
      setSelectedPayment(null);
    }
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.date) newErrors.date = 'Date is required';
    if (!formData.party_id) newErrors.party_id = 'Party is required';
    if (!formData.amount || formData.amount <= 0) newErrors.amount = 'Valid amount is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    try {
      const dataToSave = { ...formData, amount: Number(formData.amount) };
      if (selectedPayment) {
        await window.db.invoke('payments:update', { id: selectedPayment.id, ...dataToSave });
        toast.success('Receipt updated successfully');
      } else {
        await window.db.invoke('payments:add', dataToSave);
        toast.success('Receipt recorded successfully');
      }
      setIsModalOpen(false);
      loadPayments();
    } catch (err) {
      toast.error('Failed to save receipt');
    }
  };

  const columns = [
    { 
      key: 'date', label: 'Date', sortable: true,
      render: (val) => formatDate(val)
    },
    { key: 'party_name', label: 'Party', sortable: true, render: (val) => <span className="font-medium text-slate-800">{val}</span> },
    { key: 'amount', label: 'Amount (₹)', sortable: true, render: (val) => <span className="font-bold text-green-600">₹{Number(val || 0).toFixed(2)}</span> },
    { key: 'payment_type', label: 'Type', sortable: true, render: (val) => {
      const typeConfig = {
        'Payment from Party': { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
        'Cash Discount': { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
        'Coupon Gift Amount': { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
        'Others': { bg: 'bg-slate-50', text: 'text-slate-700', border: 'border-slate-200' },
      };
      const config = typeConfig[val] || typeConfig['Others'];
      return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${config.bg} ${config.text} ${config.border}`}>{val || 'Payment from Party'}</span>;
    }},
    { key: 'mode', label: 'Mode', render: (val) => <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-800">{val}</span> },
    { key: 'coupon_no', label: 'Coupon', render: (val) => <span className="text-sm font-medium text-slate-600">{val || '-'}</span> },
    { key: 'remarks', label: 'Remarks', render: (val) => <span className="text-sm text-slate-500">{val || '-'}</span> }
  ];

  const actions = [
    { label: 'Edit', icon: Edit, onClick: openModal },
    ...(userRole !== 'data_entry' ? [{ label: 'Move Season', icon: RefreshCw, onClick: (payment) => {
      setSeasonPayment(payment);
      setTargetSeasonId('');
      setIsSeasonModalOpen(true);
    }}] : []),
    { label: 'Delete', icon: Trash2, onClick: confirmDelete, variant: 'danger' }
  ];

  const handleChangeSeason = async () => {
    if (!targetSeasonId) {
      toast.error('Please select a target season');
      return;
    }
    try {
      await window.db.invoke('payments:changeSeason', seasonPayment.id, targetSeasonId);
      const targetSeason = allSeasons.find(s => s.id === targetSeasonId);
      toast.success(`Receipt of ₹${Number(seasonPayment.amount || 0).toFixed(2)} moved to ${targetSeason?.name || 'selected season'}`);
      setIsSeasonModalOpen(false);
      setSeasonPayment(null);
      loadPayments();
    } catch (err) {
      toast.error(err.message || 'Failed to move receipt');
    }
  };

  return (
    <div className="p-6 h-full flex flex-col">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Receipts</h1>
          <p className="text-slate-500">Record receipts from parties</p>
        </div>
        <div className="flex items-center gap-4">
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
          <button
            onClick={() => openModal()}
            className="px-4 py-2 bg-primary-700 hover:bg-primary-800 text-white rounded-lg font-medium transition flex items-center h-[38px] mt-[20px]"
          >
            <CreditCard className="w-4 h-4 mr-2" />
            Record Receipt
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden bg-white rounded-xl shadow-sm border border-slate-200">
        <DataTable
          columns={columns}
          data={payments}
          searchable
          searchPlaceholder="Search by party, remarks..."
          loading={loading}
          emptyMessage="No payments found"
          emptyIcon={CreditCard}
          actions={actions}
        />
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={selectedPayment ? 'Edit Receipt' : 'Record Receipt'} size="md">
        <form onSubmit={handleSave} className="space-y-4">
          <FormField label="Date" required error={errors.date}>
            <input
              type="date"
              value={formData.date}
              onChange={e => setFormData({ ...formData, date: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none transition"
            />
          </FormField>
          
          <FormField label="Party" required error={errors.party_id}>
            <SearchableSelect
              options={parties}
              value={formData.party_id}
              onChange={v => setFormData({ ...formData, party_id: v, coupon_no: '' })}
              placeholder="Select Party..."
            />
          </FormField>

          <FormField label="Receipt Type" required>
            <select
              value={formData.payment_type}
              onChange={e => setFormData({ ...formData, payment_type: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none transition bg-white font-medium"
            >
              <option value="Receipt from Party">Receipt from Party</option>
              <option value="Cash Discount">Cash Discount</option>
              <option value="Coupon Gift Amount">Coupon Gift Amount</option>
              <option value="Others">Others</option>
            </select>
          </FormField>

          {formData.party_id && (
            <FormField label="Coupon (Optional)">
              <select
                value={formData.coupon_no}
                onChange={e => setFormData({ ...formData, coupon_no: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none transition bg-white"
              >
                <option value="">No Coupon</option>
                {coupons.filter(c => c.party_id === formData.party_id).map(c => (
                  <option key={c.id} value={c.coupon_no}>{c.coupon_no} - {c.scheme_name}</option>
                ))}
              </select>
            </FormField>
          )}

          <FormField label="Amount Received (₹)" required error={errors.amount}>
            <input
              type="number"
              step="0.01"
              min="0"
              value={formData.amount}
              onChange={e => setFormData({ ...formData, amount: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none transition font-bold text-lg text-green-700"
              placeholder="0.00"
            />
          </FormField>

          <FormField label="Payment Mode">
            <div className="flex space-x-6 mt-2">
              {['Cash', 'Bank', 'UPI'].map(mode => (
                <label key={mode} className="flex items-center cursor-pointer">
                  <input
                    type="radio"
                    name="mode"
                    value={mode}
                    checked={formData.mode === mode}
                    onChange={e => setFormData({ ...formData, mode: e.target.value })}
                    className="w-4 h-4 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="ml-2 text-slate-700 font-medium">{mode}</span>
                </label>
              ))}
            </div>
          </FormField>

          <FormField label="Remarks">
            <input
              type="text"
              value={formData.remarks}
              onChange={e => setFormData({ ...formData, remarks: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none transition"
              placeholder="e.g. By cheque, NEFT Ref..."
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
              Save Receipt
            </button>
          </div>
        </form>
      </Modal>

      {/* Move to Season Modal */}
      <Modal isOpen={isSeasonModalOpen} onClose={() => setIsSeasonModalOpen(false)} title="Move Receipt to Different Season">
        {seasonPayment && (
          <div className="space-y-5">
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <p className="text-sm text-blue-800 font-medium">
                Moving receipt from <span className="font-bold">{seasonPayment.party_name}</span> — <span className="font-bold text-green-700">₹{Number(seasonPayment.amount || 0).toFixed(2)}</span>
              </p>
              <p className="text-xs text-blue-600 mt-1">Date: {formatDate(seasonPayment.date)} | Mode: {seasonPayment.mode}</p>
            </div>

            <div>
              <p className="text-sm font-semibold text-slate-700 mb-3">Select target season:</p>
              <div className="space-y-2 max-h-52 overflow-y-auto">
                {allSeasons.map(season => (
                  <button
                    key={season.id}
                    type="button"
                    onClick={() => setTargetSeasonId(season.id)}
                    className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-all duration-200 flex items-center justify-between ${
                      targetSeasonId === season.id
                        ? 'bg-primary-50 border-primary-500 text-primary-800 shadow-md'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300'
                    }`}
                  >
                    <div>
                      <span className="font-semibold">{season.name}</span>
                      {season.is_active && (
                        <span className="ml-2 px-2 py-0.5 bg-green-100 text-green-700 text-[10px] font-bold rounded-full">ACTIVE</span>
                      )}
                    </div>
                    {targetSeasonId === season.id && (
                      <span className="text-primary-600 font-bold text-sm">✓ Selected</span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-4 border-t border-slate-200">
              <button
                onClick={() => setIsSeasonModalOpen(false)}
                className="px-4 py-2 text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleChangeSeason}
                disabled={!targetSeasonId}
                className="px-5 py-2 bg-primary-700 hover:bg-primary-800 text-white rounded-lg font-medium transition flex items-center shadow-sm disabled:opacity-50"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Move Receipt
              </button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        isOpen={isConfirmOpen}
        onConfirm={handleDelete}
        onCancel={() => setIsConfirmOpen(false)}
        title="Delete Payment"
        message={`Are you sure you want to delete this payment of ₹${selectedPayment?.amount}? This will restore the balance to the party's ledger.`}
        confirmText="Delete"
        variant="danger"
      />
    </div>
  );
}
