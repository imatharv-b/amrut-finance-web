import React, { useState, useEffect } from 'react';
import { BookOpen, Briefcase, Maximize, Minimize, Edit, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import Modal from '../../components/Modal';
import FormField from '../../components/FormField';

export default function WorkerLedgerPage() {
  const [workers, setWorkers] = useState([]);
  const [selectedWorkerId, setSelectedWorkerId] = useState('');
  const [ledgerEntries, setLedgerEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editData, setEditData] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadWorkers();
    // Silently clean up any orphaned ledger entries in the background
    window.db.invoke('worker_ledger:cleanup_orphans').then(count => {
      // If orphans were removed and a worker is selected, reload the ledger to reflect the fix
      if (count > 0 && selectedWorkerId) {
        loadLedger();
      }
    }).catch(console.error);
  }, []);

  useEffect(() => {
    if (selectedWorkerId) {
      loadLedger();
    } else {
      setLedgerEntries([]);
    }
  }, [selectedWorkerId]);

  const loadWorkers = async () => {
    try {
      const data = await window.db.invoke('workers:getAll');
      setWorkers(data || []);
    } catch (err) {
      toast.error('Failed to load workers');
    }
  };

  const loadLedger = async () => {
    setLoading(true);
    try {
      const data = await window.db.invoke('workerLedger:getByWorker', Number(selectedWorkerId));
      setLedgerEntries(data || []);
    } catch (err) {
      toast.error('Failed to load ledger');
      setLedgerEntries([]);
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = (entry) => {
    setEditData({ ...entry });
    setIsEditModalOpen(true);
  };

  const handleDeleteClick = async (id) => {
    if (window.confirm('Are you sure you want to delete this ledger entry?')) {
      try {
        await window.db.invoke('workerLedger:delete', id);
        toast.success('Entry deleted');
        loadLedger();
      } catch (err) {
        toast.error('Failed to delete entry');
      }
    }
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await window.db.invoke('workerLedger:update', editData.id, {
        amount: Number(editData.amount),
        description: editData.description,
        date: editData.date
      });
      toast.success('Entry updated');
      setIsEditModalOpen(false);
      loadLedger();
    } catch (err) {
      toast.error('Failed to update entry');
    } finally {
      setIsSaving(false);
    }
  };

  const formatCurrency = (val) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(val || 0);
  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const selectedWorker = workers.find(w => w.id === Number(selectedWorkerId));

  // Compute running balances
  // We need to sort entries chronological to calculate running balance correctly
  const sortedEntries = [...ledgerEntries].sort((a, b) => new Date(a.date) - new Date(b.date));
  let runningBalance = selectedWorker ? selectedWorker.opening_balance || 0 : 0;
  
  const enrichedEntries = sortedEntries.map(entry => {
     if (entry.type === 'Credit') {
        runningBalance += Number(entry.amount);
     } else {
        runningBalance -= Number(entry.amount);
     }
     return { ...entry, runningBalance };
  });

  return (
    <div className={isFullscreen ? "fixed inset-0 z-50 bg-slate-50 flex flex-col p-2 sm:p-4 overflow-hidden" : "p-6 h-full flex flex-col"}>
      <div className={`flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 ${isFullscreen ? 'hidden' : ''}`}>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Worker Ledger</h1>
          <p className="text-slate-500">View salary credits, advances, and outstanding balances</p>
        </div>
      </div>

      <div className={`bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-6 flex items-end gap-4 ${isFullscreen ? 'hidden' : ''}`}>
        <div className="flex-1 max-w-md">
          <label className="block text-sm font-medium text-slate-700 mb-1">Select Worker</label>
          <select
            value={selectedWorkerId}
            onChange={(e) => setSelectedWorkerId(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none text-sm bg-white"
          >
            <option value="">-- Choose a Worker --</option>
            {workers.map(w => (
              <option key={w.id} value={w.id}>{w.name} ({w.salary_type})</option>
            ))}
          </select>
        </div>
      </div>

      <div className={`flex-1 bg-white shadow-sm border border-slate-200 overflow-hidden flex flex-col ${isFullscreen ? 'rounded-lg' : 'rounded-xl'}`}>
        {!selectedWorkerId ? (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-slate-500">
            <Briefcase className="w-12 h-12 mb-4 text-slate-300" />
            <p className="text-lg">Please select a worker to view their ledger</p>
          </div>
        ) : loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin"></div>
          </div>
        ) : (
          <>
            <div className="p-6 border-b border-slate-200 bg-slate-50 flex justify-between items-start">
              <div>
                <h2 className="text-xl font-bold text-slate-800">{selectedWorker.name}</h2>
                <p className="text-slate-600">Phone: {selectedWorker.phone || '-'}</p>
                <p className="text-slate-500 text-sm mt-1">{selectedWorker.salary_type} Basis ({formatCurrency(selectedWorker.salary_amount)})</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-sm text-slate-500 mb-1">Outstanding Balance</p>
                <div className={`text-2xl font-bold ${runningBalance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {formatCurrency(Math.abs(runningBalance))} {runningBalance >= 0 ? 'Cr' : 'Dr'}
                </div>
                <p className="text-xs text-slate-500 mt-1">(Positive balance means company owes worker)</p>
                </div>
                <button
                  onClick={() => setIsFullscreen(!isFullscreen)}
                  className="p-2 bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900 rounded-lg transition-colors shadow-sm ml-2 hidden md:flex"
                  title={isFullscreen ? "Exit Full Screen" : "Full Screen"}
                >
                  {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
                </button>
                <button
                  onClick={() => setIsFullscreen(!isFullscreen)}
                  className="p-2 bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900 rounded-lg transition-colors shadow-sm ml-2 md:hidden"
                  title={isFullscreen ? "Exit Full Screen" : "Full Screen"}
                >
                  {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 bg-white shadow-sm z-10">
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-sm font-semibold uppercase tracking-wider">
                    <th className="px-6 py-4">Date</th>
                    <th className="px-6 py-4">Description</th>
                    <th className="px-6 py-4 text-right">Debit (₹)</th>
                    <th className="px-6 py-4 text-right">Credit (₹)</th>
                    <th className="px-6 py-4 text-right">Balance (₹)</th>
                    <th className="px-6 py-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr className="hover:bg-slate-50 transition">
                    <td className="px-6 py-4 text-slate-500 italic" colSpan={4}>Opening Balance</td>
                    <td className="px-6 py-4 text-right font-medium text-slate-600">
                      {formatCurrency(selectedWorker.opening_balance)} {selectedWorker.opening_balance >= 0 ? 'Cr' : 'Dr'}
                    </td>
                    <td className="px-6 py-4"></td>
                  </tr>
                  
                  {enrichedEntries.map(entry => (
                    <tr key={entry.id} className="hover:bg-slate-50/50 transition">
                      <td className="px-6 py-4 text-sm font-medium text-slate-700 whitespace-nowrap">
                        {formatDate(entry.date)}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        {entry.description}
                      </td>
                      <td className="px-6 py-4 text-sm text-right text-red-600 font-medium">
                        {entry.type === 'Debit' ? formatCurrency(entry.amount) : '-'}
                      </td>
                      <td className="px-6 py-4 text-sm text-right text-emerald-600 font-medium">
                        {entry.type === 'Credit' ? formatCurrency(entry.amount) : '-'}
                      </td>
                      <td className={`px-6 py-4 text-sm text-right font-semibold ${entry.runningBalance >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                        {formatCurrency(Math.abs(entry.runningBalance))} {entry.runningBalance >= 0 ? 'Cr' : 'Dr'}
                      </td>
                      <td className="px-6 py-4 text-sm text-center">
                        <div className="flex justify-center gap-2">
                          <button onClick={() => handleEditClick(entry)} className="p-1 text-slate-400 hover:text-primary-600">
                            <Edit size={16} />
                          </button>
                          <button onClick={() => handleDeleteClick(entry.id)} className="p-1 text-slate-400 hover:text-red-600">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  
                  {enrichedEntries.length === 0 && (
                     <tr>
                       <td colSpan={6} className="px-6 py-8 text-center text-slate-500">No ledger entries found for this worker.</td>
                     </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Summary Footer */}
            {enrichedEntries.length > 0 && (
              <div className="bg-slate-100 p-3 sm:p-4 border-t border-slate-200 flex flex-col sm:flex-row justify-between sm:justify-end items-center gap-2 sm:gap-6 shrink-0 z-20 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                <span className="text-slate-800 uppercase tracking-wider text-xs font-bold text-center w-full sm:w-auto">Total for Period:</span>
                <div className="flex justify-between sm:justify-end w-full sm:w-auto gap-4 sm:gap-6 font-bold text-sm px-2 sm:px-0">
                  <span className="text-red-700 flex flex-col sm:items-end w-1/2 sm:w-auto text-left sm:text-right">
                    <span className="text-[10px] text-slate-500 font-normal uppercase">Debit</span>
                    ₹{enrichedEntries.reduce((sum, e) => sum + (e.type === 'Debit' ? e.amount : 0), 0).toFixed(2)}
                  </span>
                  <span className="text-emerald-700 flex flex-col sm:items-end w-1/2 sm:w-auto text-right">
                    <span className="text-[10px] text-slate-500 font-normal uppercase">Credit</span>
                    ₹{enrichedEntries.reduce((sum, e) => sum + (e.type === 'Credit' ? e.amount : 0), 0).toFixed(2)}
                  </span>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Edit Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Ledger Entry"
      >
        {editData && (
          <form onSubmit={handleSaveEdit} className="space-y-4">
            <FormField label="Date" required>
              <input
                type="date"
                required
                value={editData.date}
                onChange={(e) => setEditData(prev => ({ ...prev, date: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
              />
            </FormField>
            
            <FormField label="Amount" required>
              <input
                type="number"
                step="0.01"
                required
                value={editData.amount}
                onChange={(e) => setEditData(prev => ({ ...prev, amount: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
              />
            </FormField>
            
            <FormField label="Description" required>
              <textarea
                required
                rows={3}
                value={editData.description || ''}
                onChange={(e) => setEditData(prev => ({ ...prev, description: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
              />
            </FormField>

            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg font-medium hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="flex-1 px-4 py-2 bg-primary-700 text-white rounded-lg font-medium hover:bg-primary-800 transition disabled:opacity-50"
              >
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
