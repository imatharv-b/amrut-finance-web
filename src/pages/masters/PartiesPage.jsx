import React, { useState, useEffect, useRef } from 'react';
import { Users, Edit, Trash2, ChevronDown, ChevronRight, FileText, Star, ShieldAlert, Upload } from 'lucide-react';
import toast from 'react-hot-toast';
import DataTable from '../../components/DataTable';
import Modal from '../../components/Modal';
import ConfirmDialog from '../../components/ConfirmDialog';
import FormField from '../../components/FormField';
import { useNavigate } from 'react-router-dom';
import { useCompany } from '../../context/CompanyContext';

const parseCSV = (text) => {
  const lines = [];
  let row = [];
  let inQuotes = false;
  let currentValue = '';

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentValue += '"';
        i++; // skip next quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      row.push(currentValue.trim());
      currentValue = '';
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
      row.push(currentValue.trim());
      if (row.length > 1 || row[0] !== '') {
        lines.push(row);
      }
      row = [];
      currentValue = '';
    } else {
      currentValue += char;
    }
  }
  if (currentValue !== '' || row.length > 0) {
    row.push(currentValue.trim());
    lines.push(row);
  }
  return lines;
};

export default function PartiesPage() {
  const navigate = useNavigate();
  const { userRole } = useCompany();
  const fileInputRef = useRef(null);
  const [parties, setParties] = useState([]);
  const [associates, setAssociates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [selectedParty, setSelectedParty] = useState(null);
  const [expandedRows, setExpandedRows] = useState(new Set());
  const [ledgers, setLedgers] = useState({});
  const [formData, setFormData] = useState({
    name: '', owner_name: '', village: '', taluka: '', district: '',
    mobile: '', gstin: '', opening_balance: '', associate_name: '', rating: 'B'
  });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    loadParties();
  }, []);

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const loadToast = toast.loading('Importing parties, please wait...');
      try {
        const text = evt.target.result;
        const rows = parseCSV(text);
        if (rows.length < 2) {
          toast.error('The CSV file is empty or invalid.', { id: loadToast });
          return;
        }

        const headers = rows[0].map(h => h.toLowerCase().trim().replace(/[\s_]/g, ''));
        // Find indexes of fields
        const nameIdx = headers.findIndex(h => h.includes('name') || h.includes('kendra') || h.includes('party'));
        const ownerIdx = headers.findIndex(h => h.includes('owner') || h.includes('proprietor'));
        const villageIdx = headers.findIndex(h => h.includes('village') || h.includes('city') || h.includes('town'));
        const talukaIdx = headers.findIndex(h => h.includes('taluka') || h.includes('tehsil'));
        const districtIdx = headers.findIndex(h => h.includes('district'));
        const mobileIdx = headers.findIndex(h => h.includes('mobile') || h.includes('phone') || h.includes('contact'));
        const gstinIdx = headers.findIndex(h => h.includes('gst') || h.includes('gstin'));
        const balanceIdx = headers.findIndex(h => h.includes('balance') || h.includes('opening'));
        const associateIdx = headers.findIndex(h => h.includes('associate'));
        const ratingIdx = headers.findIndex(h => h.includes('rating'));

        if (nameIdx === -1) {
          toast.error('Could not find a "Name" column in the CSV. Please ensure your header row has a column named "Name" or "Krishi Kendra".', { id: loadToast });
          return;
        }

        let importCount = 0;
        let skipCount = 0;
        
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          if (row.length === 0 || !row[nameIdx]) {
            skipCount++;
            continue;
          }

          const partyData = {
            name: row[nameIdx],
            owner_name: ownerIdx !== -1 ? row[ownerIdx] : '',
            village: villageIdx !== -1 ? row[villageIdx] : '',
            taluka: talukaIdx !== -1 ? row[talukaIdx] : '',
            district: districtIdx !== -1 ? row[districtIdx] : '',
            mobile: mobileIdx !== -1 ? row[mobileIdx] : '',
            gstin: gstinIdx !== -1 ? row[gstinIdx] : '',
            opening_balance: balanceIdx !== -1 ? (Number(row[balanceIdx]) || 0) : 0,
            associate_name: associateIdx !== -1 ? row[associateIdx] : '',
            rating: ratingIdx !== -1 ? (row[ratingIdx].toUpperCase() || 'B') : 'B'
          };

          // Basic validation for rating
          if (!['A+', 'A', 'B', 'C', 'D'].includes(partyData.rating)) {
            partyData.rating = 'B';
          }

          await window.db.invoke('parties:add', partyData);
          importCount++;
        }

        toast.success(`Successfully imported ${importCount} parties!${skipCount > 0 ? ` (Skipped ${skipCount} empty rows)` : ''}`, { id: loadToast });
        loadParties();
      } catch (err) {
        toast.error('Failed to parse or import CSV: ' + err.message, { id: loadToast });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const loadParties = async () => {
    setLoading(true);
    try {
      const data = await window.db.invoke('parties:getAll');
      setParties(data || []);
      const assocData = await window.db.invoke('associates:getAll');
      setAssociates(assocData || []);
    } catch (err) {
      toast.error('Failed to load parties');
    } finally {
      setLoading(false);
    }
  };

  const loadLedger = async (partyId) => {
    try {
      const data = await window.db.invoke('parties:getLedger', partyId);
      setLedgers(prev => ({ ...prev, [partyId]: data.entries || [] }));
    } catch (err) {
      toast.error('Failed to load mini ledger');
    }
  };

  const handleRowClick = (row) => {
    const newExpanded = new Set(expandedRows);
    if (expandedRows.has(row.id)) {
      newExpanded.delete(row.id);
    } else {
      newExpanded.add(row.id);
      if (!ledgers[row.id]) {
        loadLedger(row.id);
      }
    }
    setExpandedRows(newExpanded);
  };

  const openModal = (party = null) => {
    setSelectedParty(party);
    if (party) {
      setFormData({
        name: party.name || '',
        owner_name: party.owner_name || '',
        village: party.village || '',
        taluka: party.taluka || '',
        district: party.district || '',
        mobile: party.mobile || '',
        gstin: party.gstin || '',
        opening_balance: party.opening_balance || 0,
        associate_name: party.associate_name || '',
        rating: party.rating || 'B'
      });
    } else {
      setFormData({
        name: '', owner_name: '', village: '', taluka: '', district: '',
        mobile: '', gstin: '', opening_balance: '', associate_name: '', rating: 'B'
      });
    }
    setErrors({});
    setIsModalOpen(true);
  };

  const confirmDelete = (party) => {
    setSelectedParty(party);
    setIsConfirmOpen(true);
  };

  const handleDelete = async () => {
    try {
      await window.db.invoke('parties:delete', selectedParty.id);
      toast.success('Party deleted successfully');
      loadParties();
    } catch (err) {
      toast.error('Failed to delete party');
    } finally {
      setIsConfirmOpen(false);
      setSelectedParty(null);
    }
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.name.trim()) newErrors.name = 'Party name is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    try {
      const dataToSave = { ...formData, opening_balance: Number(formData.opening_balance) || 0 };
      if (selectedParty) {
        await window.db.invoke('parties:update', { id: selectedParty.id, ...dataToSave });
        toast.success('Party updated successfully');
      } else {
        await window.db.invoke('parties:add', dataToSave);
        toast.success('Party added successfully');
      }
      setIsModalOpen(false);
      loadParties();
    } catch (err) {
      toast.error('Failed to save party');
    }
  };

  const columns = [
    {
      key: 'expand', label: '', width: '40px',
      render: (_, row) => (
        expandedRows.has(row.id) ? <ChevronDown className="w-4 h-4 text-slate-500" /> : <ChevronRight className="w-4 h-4 text-slate-500" />
      )
    },
    { 
      key: 'name', label: 'Name', sortable: true,
      render: (val, row) => (
        <div className="flex items-center space-x-2">
          <span>{val}</span>
          {row.party_type === 'Worker' && (
            <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-[10px] font-bold rounded-full border border-blue-200">Worker</span>
          )}
        </div>
      )
    },
    { key: 'owner_name', label: 'Owner Name', sortable: true },
    { key: 'village', label: 'Village', sortable: true },
    { key: 'district', label: 'District', sortable: true },
    { key: 'associate_name', label: 'Associate', sortable: true, render: (val) => val || '-' },
    { key: 'mobile', label: 'Mobile' },
    {
      key: 'rating', label: 'Rating', sortable: true,
      render: (val) => {
        const ratingConfig = {
          'A+': { bg: 'bg-emerald-100', text: 'text-emerald-800', border: 'border-emerald-300', label: 'A+ Excellent' },
          'A': { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-300', label: 'A Good' },
          'B': { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-300', label: 'B Average' },
          'C': { bg: 'bg-amber-100', text: 'text-amber-800', border: 'border-amber-300', label: 'C Below Avg' },
          'D': { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-300', label: 'D Defaulter' },
        };
        const config = ratingConfig[val] || ratingConfig['B'];
        return (
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold border ${config.bg} ${config.text} ${config.border}`}>
            {val === 'D' && <ShieldAlert className="w-3 h-3 mr-1" />}
            {val === 'A+' && <Star className="w-3 h-3 mr-1" />}
            {config.label}
          </span>
        );
      }
    },
    { 
      key: 'balance', label: 'Balance (₹)', sortable: true,
      render: (val) => {
        const numVal = Number(val || 0);
        return (
          <span className={numVal > 0 ? 'text-red-600 font-medium' : 'text-green-600 font-medium'}>
            {numVal > 0 ? `₹${numVal.toFixed(2)}` : numVal === 0 ? '₹0.00' : `₹${Math.abs(numVal).toFixed(2)} (Adv)`}
          </span>
        );
      }
    }
  ];

  const actions = userRole !== 'data_entry' ? [
    { label: 'Edit', icon: Edit, onClick: openModal },
    { label: 'Delete', icon: Trash2, onClick: confirmDelete, variant: 'danger' }
  ] : [];

  const totalOutstanding = parties.reduce((acc, p) => acc + (Number(p.balance || 0) > 0 ? Number(p.balance || 0) : 0), 0);

  return (
    <div className="p-6 h-full flex flex-col">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Parties</h1>
          <p className="text-slate-500">Total Parties: {parties.length} | Total Outstanding: <span className="text-red-600 font-semibold">₹{totalOutstanding.toFixed(2)}</span></p>
        </div>
        <div className="flex gap-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".csv"
            className="hidden"
          />
          {userRole !== 'data_entry' && (
            <>
              <button
                onClick={handleImportClick}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 rounded-lg font-medium transition flex items-center shadow-sm"
              >
                <Upload className="w-4 h-4 mr-2" />
                Import CSV
              </button>
              <button
                onClick={() => openModal()}
                className="px-4 py-2 bg-primary-700 hover:bg-primary-800 text-white rounded-lg font-medium transition flex items-center shadow-sm"
              >
                <Users className="w-4 h-4 mr-2" />
                Add Party
              </button>
            </>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-hidden bg-white rounded-xl shadow-sm border border-slate-200">
        <DataTable
          columns={columns}
          data={parties}
          searchable
          searchPlaceholder="Search parties by name, village, mobile..."
          loading={loading}
          emptyMessage="No parties found"
          emptyIcon={Users}
          actions={actions}
          onRowClick={handleRowClick}
          renderExpandedRow={(row) => (
            <div className="p-4 bg-slate-50 border-t border-slate-200 ml-10">
              <div className="flex justify-between items-center mb-4">
                <h4 className="font-semibold text-slate-700">Recent Ledger Entries</h4>
                <button
                  onClick={(e) => { e.stopPropagation(); navigate(`/payments/ledger?party=${row.id}`); }}
                  className="text-sm text-primary-600 hover:text-primary-800 flex items-center"
                >
                  <FileText className="w-4 h-4 mr-1" /> View Full Ledger
                </button>
              </div>
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-slate-500 uppercase bg-slate-100">
                  <tr>
                    <th className="px-4 py-2 rounded-l-md">Date</th>
                    <th className="px-4 py-2">Ref</th>
                    <th className="px-4 py-2">Debit (₹)</th>
                    <th className="px-4 py-2">Credit (₹)</th>
                    <th className="px-4 py-2 rounded-r-md">Balance (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {ledgers[row.id] ? (
                    ledgers[row.id].slice(-5).map((entry, idx) => (
                      <tr key={idx} className="border-b border-slate-100 last:border-0">
                        <td className="px-4 py-2">{entry.date}</td>
                        <td className="px-4 py-2">{entry.ref}</td>
                        <td className="px-4 py-2">{entry.debit > 0 ? entry.debit.toFixed(2) : '-'}</td>
                        <td className="px-4 py-2">{entry.credit > 0 ? entry.credit.toFixed(2) : '-'}</td>
                        <td className="px-4 py-2 font-medium">{entry.balance.toFixed(2)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr><td colSpan="5" className="px-4 py-2 text-center text-slate-500">Loading ledger...</td></tr>
                  )}
                  {ledgers[row.id] && ledgers[row.id].length === 0 && (
                    <tr><td colSpan="5" className="px-4 py-2 text-center text-slate-500">No transactions found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        />
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={selectedParty ? 'Edit Party' : 'Add Party'} size="lg">
        <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField label="Party Name" required error={errors.name} className="col-span-2">
            <input
              type="text"
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none transition"
              placeholder="e.g. Kisan Krishi Kendra"
            />
          </FormField>
          <FormField label="Owner Name">
            <input
              type="text"
              value={formData.owner_name}
              onChange={e => setFormData({ ...formData, owner_name: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none transition"
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
          <FormField label="Village">
            <input
              type="text"
              value={formData.village}
              onChange={e => setFormData({ ...formData, village: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none transition"
            />
          </FormField>
          <FormField label="Taluka">
            <input
              type="text"
              value={formData.taluka}
              onChange={e => setFormData({ ...formData, taluka: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none transition"
            />
          </FormField>
          <FormField label="District">
            <input
              type="text"
              value={formData.district}
              onChange={e => setFormData({ ...formData, district: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none transition"
            />
          </FormField>
          <FormField label="Associate Name">
            <select
              value={formData.associate_name}
              onChange={e => setFormData({ ...formData, associate_name: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none transition bg-white"
            >
              <option value="">-- Select Associate --</option>
              {associates.filter(a => a.is_active).map(a => (
                <option key={a.id} value={a.name}>{a.name}</option>
              ))}
            </select>
          </FormField>
          <FormField label="GSTIN">
            <input
              type="text"
              value={formData.gstin}
              onChange={e => setFormData({ ...formData, gstin: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none transition"
            />
          </FormField>
          <FormField label="Opening Balance (₹)" className="col-span-2">
            <input
              type="number"
              step="0.01"
              value={formData.opening_balance}
              onChange={e => setFormData({ ...formData, opening_balance: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none transition"
            />
            <p className="text-xs text-slate-500 mt-1">Positive amount means party owes you money.</p>
          </FormField>

          <FormField label="Party Rating" className="col-span-2">
            <div className="flex gap-2 mt-1">
              {[
                { value: 'A+', label: 'A+', sublabel: 'Excellent', color: 'emerald' },
                { value: 'A', label: 'A', sublabel: 'Good', color: 'green' },
                { value: 'B', label: 'B', sublabel: 'Average', color: 'blue' },
                { value: 'C', label: 'C', sublabel: 'Below Avg', color: 'amber' },
                { value: 'D', label: 'D', sublabel: 'Defaulter', color: 'red' },
              ].map(r => {
                const isSelected = formData.rating === r.value;
                const colorMap = {
                  emerald: isSelected ? 'bg-emerald-600 text-white border-emerald-700 shadow-lg shadow-emerald-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100',
                  green: isSelected ? 'bg-green-600 text-white border-green-700 shadow-lg shadow-green-200' : 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100',
                  blue: isSelected ? 'bg-blue-600 text-white border-blue-700 shadow-lg shadow-blue-200' : 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100',
                  amber: isSelected ? 'bg-amber-500 text-white border-amber-600 shadow-lg shadow-amber-200' : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100',
                  red: isSelected ? 'bg-red-600 text-white border-red-700 shadow-lg shadow-red-200' : 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100',
                };
                return (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => setFormData({ ...formData, rating: r.value })}
                    className={`flex-1 py-2.5 px-3 rounded-lg border-2 font-bold text-center transition-all duration-200 ${colorMap[r.color]} ${isSelected ? 'scale-105 ring-2 ring-offset-1 ring-' + r.color + '-400' : ''}`}
                  >
                    <div className="text-lg">{r.label}</div>
                    <div className={`text-[10px] font-medium ${isSelected ? 'opacity-90' : 'opacity-70'}`}>{r.sublabel}</div>
                  </button>
                );
              })}
            </div>
          </FormField>
          
          <div className="col-span-2 flex justify-end space-x-3 mt-4">
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
              Save Party
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={isConfirmOpen}
        onConfirm={handleDelete}
        onCancel={() => setIsConfirmOpen(false)}
        title="Delete Party"
        message={`Are you sure you want to delete ${selectedParty?.name}? This action cannot be undone.`}
        confirmText="Delete"
        variant="danger"
      />
    </div>
  );
}
