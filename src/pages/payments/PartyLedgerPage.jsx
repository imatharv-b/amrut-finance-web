import React, { useState, useEffect } from 'react';
import { BookOpen, Printer } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import SearchableSelect from '../../components/SearchableSelect';
import { generateLedgerHTML } from '../../components/print/LedgerPrint';
import { printHTML } from '../../lib/printUtils';
import { formatDate } from '../../lib/dateUtils';

export default function PartyLedgerPage() {
  const [searchParams] = useSearchParams();
  const initialPartyId = searchParams.get('party');

  const [parties, setParties] = useState([]);
  const [selectedPartyId, setSelectedPartyId] = useState(initialPartyId ? Number(initialPartyId) : '');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [ledgerData, setLedgerData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [firmSettings, setFirmSettings] = useState({});

  useEffect(() => {
    loadParties();
    loadSettings();
  }, []);

  useEffect(() => {
    if (selectedPartyId) {
      loadLedger();
    } else {
      setLedgerData(null);
    }
  }, [selectedPartyId, fromDate, toDate]);

  const loadSettings = async () => {
    try {
      const s = await window.db.invoke('settings:get');
      setFirmSettings(s);
    } catch (e) {
      console.error('Failed to load settings', e);
    }
  };

  const loadParties = async () => {
    try {
      const data = await window.db.invoke('parties:getAll');
      setParties(data.map(p => ({ value: p.id, label: p.name, sublabel: p.village })));
    } catch (err) {
      toast.error('Failed to load parties');
    }
  };

  const loadLedger = async () => {
    setLoading(true);
    try {
      const data = await window.db.invoke('parties:getLedger', { 
        partyId: selectedPartyId, 
        fromDate: fromDate || null, 
        toDate: toDate || null 
      });
      setLedgerData(data);
    } catch (err) {
      toast.error('Failed to load ledger');
      setLedgerData(null);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = async () => {
    if (!ledgerData) return;
    try {
      const html = generateLedgerHTML(ledgerData, firmSettings);
      await printHTML(html);
    } catch (err) {
      toast.error(err.message || 'Failed to print ledger');
    }
  };

  return (
    <div className="p-6 h-full flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Party Ledger</h1>
          <p className="text-slate-500">View statement of account for a specific party</p>
        </div>
        {ledgerData && (
          <button
            onClick={handlePrint}
            className="px-4 py-2 bg-primary-700 hover:bg-primary-800 text-white rounded-lg font-medium transition flex items-center"
          >
            <Printer className="w-4 h-4 mr-2" />
            Print Ledger
          </button>
        )}
      </div>

      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-6 flex flex-wrap items-end gap-4">
        <div className="flex-1 min-w-[200px] max-w-md">
          <label className="block text-sm font-medium text-slate-700 mb-1">Select Party</label>
          <SearchableSelect
            options={parties}
            value={selectedPartyId}
            onChange={setSelectedPartyId}
            placeholder="Search and select party..."
          />
        </div>
        <div className="w-40">
          <label className="block text-sm font-medium text-slate-700 mb-1">From Date</label>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none text-sm"
          />
        </div>
        <div className="w-40">
          <label className="block text-sm font-medium text-slate-700 mb-1">To Date</label>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none text-sm"
          />
        </div>
      </div>

      <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
        {!selectedPartyId ? (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-slate-500">
            <BookOpen className="w-12 h-12 mb-4 text-slate-300" />
            <p className="text-lg">Please select a party to view their ledger</p>
          </div>
        ) : loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin"></div>
          </div>
        ) : ledgerData ? (
          <>
            {/* Ledger Header */}
            <div className="p-6 border-b border-slate-200 bg-slate-50 flex justify-between items-start">
              <div>
                <h2 className="text-xl font-bold text-slate-800">{ledgerData.party.name}</h2>
                <p className="text-slate-600">{[ledgerData.party.village, ledgerData.party.taluka, ledgerData.party.district].filter(Boolean).join(', ')}</p>
                <p className="text-slate-500 text-sm mt-1">Mobile: {ledgerData.party.mobile || '-'}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-slate-500 mb-1">Current Balance</p>
                {(() => {
                  const currentBalance = ledgerData.entries.length > 0 
                    ? ledgerData.entries[ledgerData.entries.length - 1].balance 
                    : Number(ledgerData.openingBalanceForPeriod || 0);
                  return (
                    <p className={`text-2xl font-bold ${currentBalance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {currentBalance > 0 ? `₹${currentBalance.toFixed(2)} Dr` : `₹${Math.abs(currentBalance).toFixed(2)} Cr`}
                    </p>
                  );
                })()}
              </div>
            </div>

            {/* Ledger Table */}
            <div className="flex-1 overflow-auto p-0">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-slate-100 text-slate-600 font-medium sticky top-0 z-10">
                  <tr>
                    <th className="px-6 py-3 border-b border-slate-200">Date</th>
                    <th className="px-6 py-3 border-b border-slate-200">Type</th>
                    <th className="px-6 py-3 border-b border-slate-200">Vch No.</th>
                    <th className="px-6 py-3 border-b border-slate-200">Particulars</th>
                    <th className="px-6 py-3 border-b border-slate-200 text-right">Debit (₹)</th>
                    <th className="px-6 py-3 border-b border-slate-200 text-right">Credit (₹)</th>
                    <th className="px-6 py-3 border-b border-slate-200 text-right">Balance (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {/* Opening Balance Row */}
                  <tr className="bg-slate-50 font-medium">
                    <td className="px-6 py-3 text-slate-500">-</td>
                    <td className="px-6 py-3 text-slate-500">-</td>
                    <td className="px-6 py-3 text-slate-500">-</td>
                    <td className="px-6 py-3 text-slate-800">Opening Balance</td>
                    <td className="px-6 py-3 text-right"></td>
                    <td className="px-6 py-3 text-right"></td>
                    <td className="px-6 py-3 text-right text-slate-800">
                      {Number(ledgerData.openingBalanceForPeriod || 0) > 0 
                        ? `${Number(ledgerData.openingBalanceForPeriod || 0).toFixed(2)} Dr` 
                        : Number(ledgerData.openingBalanceForPeriod || 0) < 0 
                          ? `${Math.abs(Number(ledgerData.openingBalanceForPeriod || 0)).toFixed(2)} Cr` 
                          : '0.00'}
                    </td>
                  </tr>
                  {ledgerData.entries.map((entry, index) => (
                    <tr key={index} className="hover:bg-slate-50 transition align-top">
                      <td className="px-6 py-3 whitespace-nowrap">{formatDate(entry.date)}</td>
                      <td className="px-6 py-3 text-slate-500 whitespace-nowrap">
                        {entry.type === 'sale' ? 'Sale' : entry.type === 'payment' ? 'Rcpt' : entry.type === 'expense' ? 'Jrnl' : 'Return'}
                      </td>
                      <td className="px-6 py-3 text-slate-500 whitespace-nowrap">{entry.vch_no || entry.ref}</td>
                      <td className="px-6 py-3 text-slate-700 min-w-[300px] whitespace-normal">
                        <div className="font-semibold text-slate-800">{entry.particulars}</div>
                        {entry.narration && <div className="text-xs italic text-slate-500 mt-0.5">{entry.narration}</div>}
                        {entry.items && entry.items.length > 0 && (
                           <div className="mt-2 ml-4 pl-3 border-l-2 border-slate-200/60 space-y-1 bg-slate-50/50 rounded-r-md py-1.5 pr-2">
                             {entry.items.map((item, i) => (
                                <div key={i} className="flex text-[11px] text-slate-600 items-center justify-between">
                                   <div className="w-1/3 italic truncate pr-2 font-medium" title={item.name}>{item.name}</div>
                                   <div className="w-1/6 text-right whitespace-nowrap">{Number(item.qty).toFixed(2)} <span className="text-[10px] text-slate-400">{item.unit}</span></div>
                                   <div className="w-1/6 text-center whitespace-nowrap"><span className="text-[10px] text-slate-400">@</span> {Number(item.rate).toFixed(2)}</div>
                                   <div className="w-1/6 text-right whitespace-nowrap"><span className="text-[10px] text-slate-400">=</span> {Number(item.amount).toFixed(2)}</div>
                                </div>
                             ))}
                           </div>
                        )}
                      </td>
                      <td className="px-6 py-3 text-right text-red-600 font-medium whitespace-nowrap">
                        {entry.debit > 0 ? entry.debit.toFixed(2) : ''}
                      </td>
                      <td className="px-6 py-3 text-right text-green-600 font-medium whitespace-nowrap">
                        {entry.credit > 0 ? entry.credit.toFixed(2) : ''}
                      </td>
                      <td className="px-6 py-3 text-right font-bold whitespace-nowrap">
                        {!isNaN(entry.balance) && entry.balance > 0 
                          ? `${entry.balance.toFixed(2)} Dr` 
                          : !isNaN(entry.balance) && entry.balance < 0 
                            ? `${Math.abs(entry.balance).toFixed(2)} Cr` 
                            : '0.00'}
                      </td>
                    </tr>
                  ))}
                  {ledgerData.entries.length === 0 && (
                    <tr>
                      <td colSpan="7" className="px-6 py-8 text-center text-slate-500">
                        No transactions found for this party.
                      </td>
                    </tr>
                  )}
                  {ledgerData.entries.length > 0 && (() => {
                    const totalDebit = ledgerData.entries.reduce((sum, e) => sum + (e.debit || 0), 0);
                    const totalCredit = ledgerData.entries.reduce((sum, e) => sum + (e.credit || 0), 0);
                    return (
                      <tr className="bg-slate-100 font-bold border-t-2 border-slate-300">
                        <td colSpan="4" className="px-6 py-4 text-right text-slate-800 uppercase tracking-wider text-xs">Total for Period:</td>
                        <td className="px-6 py-4 text-right text-red-700">{totalDebit.toFixed(2)}</td>
                        <td className="px-6 py-4 text-right text-green-700">{totalCredit.toFixed(2)}</td>
                        <td className="px-6 py-4"></td>
                      </tr>
                    );
                  })()}
                </tbody>
              </table>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
