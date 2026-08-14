import React, { useState, useEffect } from 'react';
import { BookOpen, Printer, Share2, Maximize, Minimize, Edit, Ticket } from 'lucide-react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import SearchableSelect from '../../components/SearchableSelect';
import { generateLedgerHTML } from '../../components/print/LedgerPrint';
import { printHTML, exportAsJPG } from '../../lib/printUtils';
import { formatDate } from '../../lib/dateUtils';
import Modal from '../../components/Modal';
import FormField from '../../components/FormField';

export default function PartyLedgerPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const initialPartyId = searchParams.get('party');

  const [parties, setParties] = useState([]);
  const [selectedPartyId, setSelectedPartyId] = useState(initialPartyId ? Number(initialPartyId) : '');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [ledgerData, setLedgerData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [firmSettings, setFirmSettings] = useState({});
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editData, setEditData] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

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

  const getLedgerFileName = (ext) => {
    const d = new Date();
    const dateStr = `${d.getDate().toString().padStart(2, '0')}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getFullYear()}`;
    return `${ledgerData.party.name}_${dateStr}${ext}`;
  };

  const handlePrint = async () => {
    if (!ledgerData) return;
    try {
      const html = generateLedgerHTML(ledgerData, firmSettings);
      await printHTML(html, getLedgerFileName(''));
    } catch (err) {
      toast.error(err.message || 'Failed to print ledger');
    }
  };

  const handleWhatsApp = async () => {
    if (!ledgerData) return;
    try {
      const html = generateLedgerHTML(ledgerData, firmSettings);
      const filename = getLedgerFileName('.jpg');
      
      const currentBalance = ledgerData.entries.length > 0 
        ? ledgerData.entries[ledgerData.entries.length - 1].balance 
        : Number(ledgerData.openingBalanceForPeriod || 0);
        
      const balanceStr = currentBalance > 0 
        ? `₹${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(currentBalance)} Dr` 
        : `₹${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(Math.abs(currentBalance))} Cr`;
        
      const text = `Hello ${ledgerData.party.name},\n\nPlease find your ledger attached.\n\nCurrent Balance: ${balanceStr}`;

      toast.loading('Generating image for WhatsApp...', { id: 'wa-ledger' });
      const imgData = await exportAsJPG(html, filename);
      
      try {
        const res = await fetch(imgData);
        const blob = await res.blob();
        const file = new File([blob], filename, { type: 'image/jpeg' });
        
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: 'Ledger',
            text: text
          });
          toast.success('Shared successfully!', { id: 'wa-ledger' });
          return;
        }
      } catch (e) {
        console.log('Share API not supported or failed', e);
      }
      
      toast.success('Image downloaded! Redirecting to WhatsApp...', { id: 'wa-ledger' });
      const mobile = ledgerData.party.mobile || '';
      setTimeout(() => {
        window.open(`https://wa.me/${mobile ? '91'+mobile : ''}?text=${encodeURIComponent(text)}`, '_blank');
      }, 500);
      
    } catch (err) {
      toast.error(err.message || 'Failed to generate image', { id: 'wa-ledger' });
    }
  };

  const handleEditClick = (entry) => {
    if (!entry.id) {
       toast.error("Cannot edit this entry");
       return;
    }
    
    if (entry.entry_type === 'sale') {
      navigate(`/sales/edit/${entry.id}`);
    } else if (entry.entry_type === 'sale_return') {
      toast.error("Sale Returns must be edited from the Returns page");
    } else {
      // payment, expense, worker_ledger
      setEditData({ ...entry });
      setIsEditModalOpen(true);
    }
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      let amount = Number(editData.debit) || Number(editData.credit);
      let updates = {
         date: editData.entry_date,
         amount: amount
      };
      
      if (editData.entry_type === 'payment') {
         updates.remarks = editData.narration;
         await window.db.invoke('payments:update', { id: editData.id, ...updates });
      } else if (editData.entry_type === 'expense') {
         updates.description = editData.narration;
         await window.db.invoke('expenses:update', { id: editData.id, ...updates });
      } else if (editData.entry_type === 'worker_ledger') {
         updates.description = editData.narration || editData.particulars;
         await window.db.invoke('workerLedger:update', editData.id, updates);
      }
      
      toast.success('Entry updated');
      setIsEditModalOpen(false);
      loadLedger();
    } catch (err) {
      toast.error('Failed to update entry');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className={isFullscreen ? "fixed inset-0 z-50 bg-slate-50 flex flex-col overflow-hidden" : "h-full flex flex-col overflow-hidden"}>
      <div className={`bg-white border-b border-slate-200 px-3 py-2 sm:px-4 sm:py-2.5 flex flex-wrap gap-2 sm:gap-3 items-center shrink-0 z-20 ${isFullscreen ? 'hidden' : ''}`}>
        <div className="w-[250px] sm:w-[300px]">
          <SearchableSelect
            options={parties}
            value={selectedPartyId}
            onChange={setSelectedPartyId}
            placeholder="Search and select party..."
          />
        </div>
        
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none w-[130px]"
            placeholder="From"
          />
          <span className="text-slate-400 text-sm">to</span>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none w-[130px]"
            placeholder="To"
          />
        </div>

        {ledgerData && (
          <div className="flex gap-2 ml-auto">
            <button
              onClick={handleWhatsApp}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition flex items-center shadow-sm"
              title="Share via WhatsApp"
            >
              <Share2 className="w-4 h-4 sm:mr-1.5" />
              <span className="hidden sm:inline">WhatsApp (JPG)</span>
            </button>
            <button
              onClick={handlePrint}
              className="px-3 py-1.5 bg-primary-700 hover:bg-primary-800 text-white rounded-lg text-sm font-medium transition flex items-center shadow-sm"
            >
              <Printer className="w-4 h-4 sm:mr-1.5" />
              <span className="hidden sm:inline">Print</span>
            </button>
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="px-2 py-1.5 bg-white border border-slate-300 text-slate-600 hover:bg-slate-50 hover:text-slate-900 rounded-lg transition-colors shadow-sm ml-2"
              title={isFullscreen ? "Exit Full Screen" : "Full Screen"}
            >
              {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
            </button>
          </div>
        )}
      </div>

      <div className={`flex-1 bg-white overflow-hidden flex flex-col ${isFullscreen ? '' : 'border-t-0'}`}>
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
          <div className="flex-1 overflow-auto flex flex-col bg-white">
            {/* Ledger Header */}
            <div className="p-4 md:p-5 border-b border-slate-200 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 shrink-0 bg-white">
              <div className="shrink-0 w-full xl:w-1/4">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <h2 className="text-lg sm:text-xl font-bold text-slate-800">{ledgerData.party.name}</h2>
                  {ledgerData.coupons && ledgerData.coupons.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {ledgerData.coupons.map((c, i) => (
                        <div key={i} className="inline-flex items-center gap-1 bg-purple-100 border border-purple-200 rounded px-1.5 py-0.5 shadow-sm">
                          <Ticket className="w-3 h-3 text-purple-600" />
                          <span className="text-[10px] sm:text-xs font-bold text-purple-800">#{c.coupon_no}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <p className="text-sm text-slate-600">{[ledgerData.party.village, ledgerData.party.taluka, ledgerData.party.district].filter(Boolean).join(', ')}</p>
                <p className="text-slate-500 text-xs mt-0.5">Mobile: {ledgerData.party.mobile || '-'}</p>
              </div>

              {/* Coupon Analytics Summary Table (Middle) */}
              {ledgerData.couponAnalyticsSummary && (
                <div className="flex-1 w-full xl:w-auto overflow-x-auto pb-2 xl:pb-0">
                  <table className="w-full text-center min-w-[600px]">
                    <thead>
                      <tr>
                        <th className="text-[10px] sm:text-xs uppercase font-bold text-slate-500 pb-2 px-2 whitespace-nowrap">MATERIAL SALE (₹)</th>
                        <th className="text-[10px] sm:text-xs uppercase font-bold text-slate-500 pb-2 px-2 whitespace-nowrap">OPENING BAL (₹)</th>
                        <th className="text-[10px] sm:text-xs uppercase font-bold text-green-600 pb-2 px-2 whitespace-nowrap">PAYMENT JAMA (₹)</th>
                        <th className="text-[10px] sm:text-xs uppercase font-bold text-red-500 pb-2 px-2 whitespace-nowrap">MATERIAL BAKI (₹)</th>
                        <th className="text-[10px] sm:text-xs uppercase font-bold text-blue-500 pb-2 px-2 whitespace-nowrap">PAYMENT PENDING (₹)</th>
                        <th className="text-[10px] sm:text-xs uppercase font-bold text-amber-600 pb-2 px-2 whitespace-nowrap">TOTAL BALANCE (₹)</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="text-base sm:text-lg font-bold">
                        <td className="text-slate-800 px-2 whitespace-nowrap">₹{new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(ledgerData.couponAnalyticsSummary.materialSale)}</td>
                        <td className="text-slate-500 px-2 whitespace-nowrap">₹{new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(ledgerData.couponAnalyticsSummary.openingBal)}</td>
                        <td className="text-green-700 px-2 whitespace-nowrap">₹{new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(ledgerData.couponAnalyticsSummary.paymentJama)}</td>
                        <td className="text-red-600 px-2 whitespace-nowrap">₹{new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(ledgerData.couponAnalyticsSummary.materialBaki)}</td>
                        <td className="text-blue-600 px-2 whitespace-nowrap">₹{new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(ledgerData.couponAnalyticsSummary.paymentPending)}</td>
                        <td className="text-amber-700 px-2 whitespace-nowrap">₹{new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(ledgerData.couponAnalyticsSummary.totalBalance)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}

              <div className="shrink-0 w-full xl:w-auto flex items-center justify-start xl:justify-end">
                <div className="text-left xl:text-right bg-slate-50 p-3 rounded-lg border border-slate-200 w-full xl:w-auto">
                  <p className="text-xs sm:text-sm text-slate-500 mb-1">Current Balance</p>
                {(() => {
                  const currentBalance = ledgerData.entries.length > 0 
                    ? ledgerData.entries[ledgerData.entries.length - 1].balance 
                    : Number(ledgerData.openingBalanceForPeriod || 0);
                  return (
                    <p className={`text-lg sm:text-2xl font-bold ${currentBalance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {currentBalance > 0 ? `₹${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(currentBalance)} Dr` : `₹${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(Math.abs(currentBalance))} Cr`}
                    </p>
                  );
                })()}
                </div>
              </div>
            </div>

            {/* Ledger Cards (Mobile) */}
            <div className="md:hidden p-3 space-y-3 bg-slate-50/50 shrink-0">
              {/* Opening Balance Card */}
              <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex justify-between items-center">
                <div>
                  <p className="text-sm font-semibold text-slate-800">Opening Balance</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-500 mb-0.5">Balance</p>
                  <span className="font-bold text-slate-800">
                    {Number(ledgerData.openingBalanceForPeriod || 0) > 0 
                      ? `${Number(ledgerData.openingBalanceForPeriod || 0).toFixed(2)} Dr` 
                      : Number(ledgerData.openingBalanceForPeriod || 0) < 0 
                        ? `${Math.abs(Number(ledgerData.openingBalanceForPeriod || 0)).toFixed(2)} Cr` 
                        : '0.00'}
                  </span>
                </div>
              </div>

              {/* Transactions */}
              {ledgerData.entries.map((entry, index) => (
                <div key={index} className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-2 relative">
                  <div className="flex justify-between items-start border-b border-slate-100 pb-2 mb-1">
                    <div>
                      <p className="text-xs text-slate-500 mb-0.5">{formatDate(entry.date)} • {entry.type === 'sale' ? 'Sale' : entry.type === 'payment' ? 'Rcpt' : entry.type === 'expense' ? 'Jrnl' : 'Return'}</p>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <h4 className="font-semibold text-slate-800 leading-tight">{entry.particulars}</h4>
                        {entry.coupon_no && (
                          <span className="inline-flex items-center gap-0.5 bg-purple-100 border border-purple-200 rounded px-1.5 py-0.5">
                            <Ticket className="w-2.5 h-2.5 text-purple-600" />
                            <span className="text-[9px] font-bold text-purple-800">#{entry.coupon_no}</span>
                          </span>
                        )}
                      </div>
                      {entry.vch_no && <span className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-500 mt-1.5 inline-block">Ref: {entry.vch_no}</span>}
                    </div>
                    <div className="text-right pl-2 shrink-0">
                      <p className="text-xs text-slate-500 mb-0.5">Amount</p>
                      {entry.debit > 0 ? (
                        <span className="font-bold text-red-600">₹{entry.debit.toFixed(2)} Dr</span>
                      ) : entry.credit > 0 ? (
                        <span className="font-bold text-green-600">₹{entry.credit.toFixed(2)} Cr</span>
                      ) : null}
                      <button onClick={() => handleEditClick(entry)} className="ml-2 p-1 text-slate-400 hover:text-primary-600 inline-block align-middle">
                         <Edit size={12} />
                      </button>
                    </div>
                  </div>
                  
                  {entry.narration && <p className="text-xs italic text-slate-500">{entry.narration}</p>}
                  
                  {entry.items && entry.items.length > 0 && (
                    <div className="bg-slate-50 p-2 rounded-lg space-y-1 border border-slate-100">
                      {entry.items.map((item, i) => (
                        <div key={i} className="flex text-[11px] text-slate-600 justify-between items-center">
                          <span className="font-medium truncate w-1/2" title={item.name}>{item.name}</span>
                          <span className="text-slate-400">{Number(item.qty).toFixed(1)} {item.unit}</span>
                          <span className="font-medium text-slate-700">₹{Number(item.amount).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex justify-between items-center mt-1 pt-2 border-t border-slate-50 border-dashed">
                    <span className="text-[10px] uppercase text-slate-400 font-bold tracking-wider">Balance</span>
                    <span className="font-bold text-sm text-slate-800">
                      {!isNaN(entry.balance) && entry.balance > 0 
                        ? `${entry.balance.toFixed(2)} Dr` 
                        : !isNaN(entry.balance) && entry.balance < 0 
                          ? `${Math.abs(entry.balance).toFixed(2)} Cr` 
                          : '0.00'}
                    </span>
                  </div>
                </div>
              ))}
              
              {ledgerData.entries.length === 0 && (
                <div className="p-8 text-center text-slate-500 bg-white rounded-xl border border-slate-200 shadow-sm">
                  No transactions found for this party.
                </div>
              )}
            </div>

            {/* Ledger Table (Desktop) */}
            <div className="hidden md:block shrink-0 bg-white">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-slate-100 text-slate-600 font-medium sticky top-0 z-10 shadow-sm">
                  <tr>
                    <th className="px-6 py-3 border-b border-slate-200">Date</th>
                    <th className="px-6 py-3 border-b border-slate-200">Type</th>
                    <th className="px-6 py-3 border-b border-slate-200">Vch No.</th>
                    <th className="px-6 py-3 border-b border-slate-200">Particulars</th>
                    <th className="px-6 py-3 border-b border-slate-200 text-right">Debit (₹)</th>
                    <th className="px-6 py-3 border-b border-slate-200 text-right">Credit (₹)</th>
                    <th className="px-6 py-3 border-b border-slate-200 text-right">Balance (₹)</th>
                    <th className="px-6 py-3 border-b border-slate-200 w-10"></th>
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
                    <td className="px-6 py-3 border-b border-slate-200"></td>
                  </tr>
                  {ledgerData.entries.map((entry, index) => (
                    <tr key={index} className="hover:bg-slate-50 transition align-top">
                      <td className="px-6 py-3 whitespace-nowrap">{formatDate(entry.date)}</td>
                      <td className="px-6 py-3 text-slate-500 whitespace-nowrap">
                        {entry.type === 'sale' ? 'Sale' : entry.type === 'payment' ? 'Rcpt' : entry.type === 'expense' ? 'Jrnl' : 'Return'}
                      </td>
                      <td className="px-6 py-3 text-slate-500 whitespace-nowrap">{entry.vch_no || entry.ref}</td>
                      <td className="px-6 py-3 text-slate-700 min-w-[300px] whitespace-normal">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-slate-800">{entry.particulars}</span>
                          {entry.coupon_no && (
                            <span className="inline-flex items-center gap-1 bg-purple-100 border border-purple-200 rounded px-1.5 py-0.5 shadow-sm">
                              <Ticket className="w-3 h-3 text-purple-600" />
                              <span className="text-[10px] font-bold text-purple-800">#{entry.coupon_no}</span>
                            </span>
                          )}
                        </div>
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
                      <td className="px-6 py-3 whitespace-nowrap text-right">
                         {entry.id && (
                           <button onClick={() => handleEditClick(entry)} className="p-1 text-slate-400 hover:text-primary-600 inline-block align-middle" title="Edit">
                              <Edit size={16} />
                           </button>
                         )}
                      </td>
                    </tr>
                  ))}
                  {ledgerData.entries.length === 0 && (
                    <tr>
                      <td colSpan="8" className="px-6 py-8 text-center text-slate-500">
                        No transactions found for this party.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            
            {/* Summary Footer */}
            {ledgerData.entries.length > 0 && (
              <div className="bg-slate-100 p-3 sm:p-4 border-t border-slate-200 flex flex-col sm:flex-row justify-between sm:justify-end items-center gap-2 sm:gap-6 shrink-0 z-20 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                <span className="text-slate-800 uppercase tracking-wider text-xs font-bold text-center w-full sm:w-auto">Total for Period:</span>
                <div className="flex justify-between sm:justify-end w-full sm:w-auto gap-4 sm:gap-6 font-bold text-sm px-2 sm:px-0">
                  <span className="text-red-700 flex flex-col sm:items-end w-1/2 sm:w-auto text-left sm:text-right">
                    <span className="text-[10px] text-slate-500 font-normal uppercase">Debit</span>
                    ₹{ledgerData.entries.reduce((sum, e) => sum + (e.debit || 0), 0).toFixed(2)}
                  </span>
                  <span className="text-green-700 flex flex-col sm:items-end w-1/2 sm:w-auto text-right">
                    <span className="text-[10px] text-slate-500 font-normal uppercase">Credit</span>
                    ₹{ledgerData.entries.reduce((sum, e) => sum + (e.credit || 0), 0).toFixed(2)}
                  </span>
                </div>
              </div>
            )}
          </div>
        ) : null}
      </div>

      {/* Edit Modal for Generic Entries */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Entry"
      >
        {editData && (
          <form onSubmit={handleSaveEdit} className="space-y-4">
            <FormField label="Date" required>
              <input
                type="date"
                required
                value={editData.entry_date || ''}
                onChange={(e) => setEditData(prev => ({ ...prev, entry_date: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
              />
            </FormField>
            
            <FormField label="Amount" required>
              <input
                type="number"
                step="0.01"
                required
                value={editData.debit > 0 ? editData.debit : editData.credit}
                onChange={(e) => {
                   let amount = Number(e.target.value);
                   setEditData(prev => ({
                     ...prev, 
                     debit: prev.debit > 0 ? amount : 0,
                     credit: prev.credit > 0 ? amount : 0
                   }))
                }}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
              />
            </FormField>
            
            <FormField label="Narration / Remarks" required>
              <textarea
                required
                rows={3}
                value={editData.narration || editData.particulars || ''}
                onChange={(e) => setEditData(prev => ({ ...prev, narration: e.target.value }))}
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
