import React, { useState, useEffect } from 'react';
import { BookOpen, Briefcase } from 'lucide-react';
import toast from 'react-hot-toast';

export default function WorkerLedgerPage() {
  const [workers, setWorkers] = useState([]);
  const [selectedWorkerId, setSelectedWorkerId] = useState('');
  const [ledgerEntries, setLedgerEntries] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadWorkers();
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
    <div className="p-6 h-full flex flex-col">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Worker Ledger</h1>
          <p className="text-slate-500">View salary credits, advances, and outstanding balances</p>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-6 flex items-end gap-4">
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

      <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
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
              <div className="text-right">
                <p className="text-sm text-slate-500 mb-1">Outstanding Balance</p>
                <div className={`text-2xl font-bold ${runningBalance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {formatCurrency(Math.abs(runningBalance))} {runningBalance >= 0 ? 'Cr' : 'Dr'}
                </div>
                <p className="text-xs text-slate-500 mt-1">(Positive balance means company owes worker)</p>
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
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr className="hover:bg-slate-50 transition">
                    <td className="px-6 py-4 text-slate-500 italic" colSpan={4}>Opening Balance</td>
                    <td className="px-6 py-4 text-right font-medium text-slate-600">
                      {formatCurrency(selectedWorker.opening_balance)} {selectedWorker.opening_balance >= 0 ? 'Cr' : 'Dr'}
                    </td>
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
                    </tr>
                  ))}
                  
                  {enrichedEntries.length === 0 && (
                     <tr>
                       <td colSpan={5} className="px-6 py-8 text-center text-slate-500">No ledger entries found for this worker.</td>
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
    </div>
  );
}
