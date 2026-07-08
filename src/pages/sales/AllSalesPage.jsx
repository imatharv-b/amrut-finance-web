import React, { useState, useEffect, useContext } from 'react';
import { FileText, Edit, Trash2, Eye, Printer, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import DataTable from '../../components/DataTable';
import Modal from '../../components/Modal';
import ConfirmDialog from '../../components/ConfirmDialog';
import { useNavigate } from 'react-router-dom';
import { SeasonContext } from '../../context/SeasonContext';
import { useCompany } from '../../context/CompanyContext';
import { generateInvoiceHTML } from '../../components/print/InvoicePrint';
import { printHTML } from '../../lib/printUtils';
import { formatDate } from '../../lib/dateUtils';

export default function AllSalesPage() {
  const navigate = useNavigate();
  const { activeSeason } = useContext(SeasonContext);
  const { userRole } = useCompany();
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [selectedSale, setSelectedSale] = useState(null);
  const [saleDetails, setSaleDetails] = useState(null);
  const [firmSettings, setFirmSettings] = useState({});
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  
  // Export to Busy state
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [exportType, setExportType] = useState('both');
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (activeSeason) {
      loadSales();
      loadSettings();
    }
  }, [activeSeason, fromDate, toDate]);

  const loadSettings = async () => {
    try {
      const s = await window.db.invoke('settings:get');
      setFirmSettings(s);
    } catch (e) {
      console.error('Failed to load settings', e);
    }
  };

  const loadSales = async () => {
    setLoading(true);
    try {
      const data = await window.db.invoke('sales:getAll', { 
        season_id: activeSeason.id,
        fromDate: fromDate || undefined,
        toDate: toDate || undefined
      });
      setSales(data || []);
    } catch (err) {
      toast.error('Failed to load sales');
    } finally {
      setLoading(false);
    }
  };

  const openView = async (sale) => {
    try {
      const details = await window.db.invoke('sales:getById', sale.id);
      setSaleDetails(details);
      setSelectedSale(sale);
      setIsViewOpen(true);
    } catch (err) {
      toast.error('Failed to load sale details');
    }
  };

  const confirmDelete = (sale) => {
    setSelectedSale(sale);
    setIsConfirmOpen(true);
  };

  const handleDelete = async () => {
    try {
      await window.db.invoke('sales:delete', selectedSale.id);
      toast.success('Sale deleted successfully');
      loadSales();
    } catch (err) {
      toast.error('Failed to delete sale');
    } finally {
      setIsConfirmOpen(false);
      setSelectedSale(null);
    }
  };

  const handlePrint = async (sale) => {
    try {
      let details = saleDetails;
      if (!details || details.sale.id !== sale.id) {
        details = await window.db.invoke('sales:getById', sale.id);
      }
      const html = generateInvoiceHTML(details.sale, details.items, firmSettings);
      await printHTML(html);
    } catch (err) {
      toast.error(err.message || 'Failed to generate print view');
    }
  };

  // ── Export to Busy ──────────────────────────────────────────────────
  const handleExportBusy = async () => {
    setExporting(true);
    const loadToast = toast.loading('Preparing Excel export for Busy...');
    try {
      // Filter sales by selected type
      const filteredSales = sales.filter(s => {
        if (exportType === 'kaccha') return s.sale_type === 'kaccha';
        if (exportType === 'pakka') return s.sale_type === 'pakka';
        return true; // 'both'
      });

      if (filteredSales.length === 0) {
        toast.error('No bills found for the selected type.', { id: loadToast });
        setExporting(false);
        return;
      }

      // Fetch item-level details for each sale
      const rows = [];
      for (const sale of filteredSales) {
        const details = await window.db.invoke('sales:getById', sale.id);
        const isPakka = sale.sale_type === 'pakka';
        const items = details.items || [];
        
        // Calculate tax amounts for the whole invoice
        const grossTotal = Number(sale.total_amount || 0) + Number(sale.discount || 0);
        const cgstPct = isPakka ? Number(sale.cgst_percent || 0) : 0;
        const sgstPct = isPakka ? Number(sale.sgst_percent || 0) : 0;
        const taxableBasis = isPakka ? grossTotal / (1 + (cgstPct + sgstPct) / 100) : grossTotal;
        
        if (items.length === 0) {
          // Sale with no items — export as single row
          rows.push({
            'Vch Date': sale.date,
            'Vch No': sale.invoice_no,
            'Vch Type': isPakka ? 'Tax Invoice' : 'Pro Forma',
            'Party Name': sale.party_name || '',
            'Item Name': '',
            'Quantity': '',
            'Unit': '',
            'Rate': '',
            'Amount': Number(taxableBasis).toFixed(2),
            'Discount': Number(sale.discount || 0).toFixed(2),
            'CGST %': cgstPct,
            'CGST Amount': isPakka ? (taxableBasis * cgstPct / 100).toFixed(2) : '0.00',
            'SGST %': sgstPct,
            'SGST Amount': isPakka ? (taxableBasis * sgstPct / 100).toFixed(2) : '0.00',
            'Total Amount': Number(sale.total_amount || 0).toFixed(2),
            'Amount Paid': Number(sale.amount_paid || 0).toFixed(2),
            'Associate': sale.associate_name || '',
          });
        } else {
          items.forEach((item, idx) => {
            rows.push({
              'Vch Date': idx === 0 ? sale.date : '',
              'Vch No': idx === 0 ? sale.invoice_no : '',
              'Vch Type': idx === 0 ? (isPakka ? 'Tax Invoice' : 'Pro Forma') : '',
              'Party Name': idx === 0 ? (sale.party_name || '') : '',
              'Item Name': item.product_name || '',
              'Quantity': Number(item.qty || 0),
              'Unit': item.unit || '',
              'Rate': Number(item.rate || 0).toFixed(2),
              'Amount': Number(item.amount || 0).toFixed(2),
              'Discount': idx === 0 ? Number(sale.discount || 0).toFixed(2) : '',
              'CGST %': idx === 0 ? cgstPct : '',
              'CGST Amount': idx === 0 ? (isPakka ? (taxableBasis * cgstPct / 100).toFixed(2) : '0.00') : '',
              'SGST %': idx === 0 ? sgstPct : '',
              'SGST Amount': idx === 0 ? (isPakka ? (taxableBasis * sgstPct / 100).toFixed(2) : '0.00') : '',
              'Total Amount': idx === 0 ? Number(sale.total_amount || 0).toFixed(2) : '',
              'Amount Paid': idx === 0 ? Number(sale.amount_paid || 0).toFixed(2) : '',
              'Associate': idx === 0 ? (sale.associate_name || '') : '',
            });
          });
        }
      }

      // Generate Excel workbook
      const ws = XLSX.utils.json_to_sheet(rows);
      
      // Auto-size columns
      const colWidths = Object.keys(rows[0] || {}).map(key => ({
        wch: Math.max(key.length, ...rows.map(r => String(r[key] || '').length)) + 2
      }));
      ws['!cols'] = colWidths;

      const wb = XLSX.utils.book_new();
      const sheetName = exportType === 'kaccha' ? 'Kaccha Bills' : exportType === 'pakka' ? 'Pakka Bills' : 'All Bills';
      XLSX.utils.book_append_sheet(wb, ws, sheetName);

      // Generate filename
      const dateRange = fromDate && toDate ? `_${fromDate}_to_${toDate}` : '';
      const typeLabel = exportType === 'both' ? 'All' : exportType === 'kaccha' ? 'Kaccha' : 'Pakka';
      const fileName = `Busy_Export_${typeLabel}_Bills${dateRange}.xlsx`;

      XLSX.writeFile(wb, fileName);
      toast.success(`Exported ${filteredSales.length} ${typeLabel} bills successfully!`, { id: loadToast });
      setIsExportOpen(false);
    } catch (err) {
      toast.error('Export failed: ' + (err.message || 'Unknown error'), { id: loadToast });
    } finally {
      setExporting(false);
    }
  };

  const columns = [
    { key: 'invoice_no', label: 'Invoice No', sortable: true },
    { 
      key: 'date', label: 'Date', sortable: true,
      render: (val) => formatDate(val)
    },
    { key: 'party_name', label: 'Party', sortable: true },
    { key: 'associate_name', label: 'Associate', sortable: true },
    { 
      key: 'sale_type', label: 'Type', sortable: true,
      render: (val) => (
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium uppercase ${val === 'pakka' ? 'bg-purple-100 text-purple-800' : 'bg-slate-100 text-slate-800'}`}>
          {val}
        </span>
      )
    },
    { key: 'total_amount', label: 'Total (₹)', sortable: true, render: (val) => `₹${Number(val || 0).toFixed(2)}` },
    { key: 'amount_paid', label: 'Paid (₹)', render: (val) => `₹${Number(val || 0).toFixed(2)}` },
    { 
      key: 'balance', label: 'Balance (₹)', sortable: true,
      render: (val, row) => {
        const computedBalance = val != null ? Number(val) : (Number(row.total_amount || 0) - Number(row.amount_paid || 0));
        return (
          <span className={computedBalance > 0 ? 'text-red-600 font-medium' : 'text-green-600 font-medium'}>
            ₹{computedBalance.toFixed(2)}
          </span>
        );
      }
    }
  ];

  const actions = [
    { label: 'View', icon: Eye, onClick: openView },
    { label: 'Print', icon: Printer, onClick: handlePrint }
  ];

  if (userRole !== 'data_entry') {
    actions.splice(1, 0, { label: 'Edit', icon: Edit, onClick: (sale) => navigate(`/sales/edit/${sale.id}`) });
    actions.push({ label: 'Delete', icon: Trash2, onClick: confirmDelete, variant: 'danger' });
  }

  const totalSales = sales.reduce((acc, s) => acc + Number(s.total_amount || 0), 0);
  const totalBalance = sales.reduce((acc, s) => acc + (s.balance != null ? Number(s.balance) : (Number(s.total_amount || 0) - Number(s.amount_paid || 0))), 0);

  return (
    <div className="p-6 h-full flex flex-col">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">All Sales</h1>
          <p className="text-slate-500">
            {activeSeason?.name} | Total Sales: <span className="text-slate-800 font-semibold">₹{totalSales.toFixed(2)}</span> | Balance Due: <span className="text-red-600 font-semibold">₹{totalBalance.toFixed(2)}</span>
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
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
          {userRole === 'admin' && (
            <div className="flex flex-col">
              <span className="text-xs text-transparent font-medium mb-1">.</span>
              <button
                onClick={() => setIsExportOpen(true)}
                disabled={sales.length === 0}
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition flex items-center shadow-sm text-sm disabled:opacity-50"
              >
                <Download className="w-4 h-4 mr-2" />
                Export to Busy
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-hidden bg-white rounded-xl shadow-sm border border-slate-200">
        <DataTable
          columns={columns}
          data={sales}
          searchable
          searchPlaceholder="Search by invoice, party, associate..."
          loading={loading}
          emptyMessage="No sales found for this season"
          emptyIcon={FileText}
          actions={actions}
        />
      </div>

      <Modal isOpen={isViewOpen} onClose={() => setIsViewOpen(false)} title={`Sale Details: ${selectedSale?.invoice_no}`} size="lg">
        {saleDetails && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-lg border border-slate-200">
              <div>
                <p className="text-sm text-slate-500">Party</p>
                <p className="font-medium text-slate-800">{saleDetails.sale.party_name}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Date</p>
                <p className="font-medium text-slate-800">{formatDate(saleDetails.sale.date)}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Associate</p>
                <p className="font-medium text-slate-800">{saleDetails.sale.associate_name || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Type</p>
                <p className="font-medium text-slate-800 uppercase">{saleDetails.sale.sale_type}</p>
              </div>
            </div>

            <table className="w-full text-sm text-left border border-slate-200 rounded-lg overflow-hidden">
              <thead className="bg-slate-100 text-slate-600">
                <tr>
                  <th className="px-4 py-2">Product</th>
                  <th className="px-4 py-2">Batch</th>
                  <th className="px-4 py-2">Qty</th>
                  <th className="px-4 py-2">Rate</th>
                  <th className="px-4 py-2">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {saleDetails.items.map((item, idx) => (
                  <tr key={idx}>
                    <td className="px-4 py-2">{item.product_name}</td>
                    <td className="px-4 py-2">{item.batch_no || '-'}</td>
                    <td className="px-4 py-2">{item.qty} {item.unit}</td>
                    <td className="px-4 py-2">₹{item.rate.toFixed(2)}</td>
                    <td className="px-4 py-2">₹{item.amount.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="flex justify-end">
              <div className="w-64 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-slate-500">Subtotal:</span><span>₹{(saleDetails.sale.total_amount + saleDetails.sale.discount - (saleDetails.sale.sale_type==='pakka'?((saleDetails.sale.total_amount+saleDetails.sale.discount)*(saleDetails.sale.cgst_percent+saleDetails.sale.sgst_percent)/(100+saleDetails.sale.cgst_percent+saleDetails.sale.sgst_percent)):0)).toFixed(2)}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Discount:</span><span>₹{saleDetails.sale.discount.toFixed(2)}</span></div>
                {saleDetails.sale.sale_type === 'pakka' && (
                  <>
                    <div className="flex justify-between"><span className="text-slate-500">CGST ({saleDetails.sale.cgst_percent}%):</span><span>₹{((saleDetails.sale.total_amount+saleDetails.sale.discount) * saleDetails.sale.cgst_percent / (100+saleDetails.sale.cgst_percent+saleDetails.sale.sgst_percent)).toFixed(2)}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">SGST ({saleDetails.sale.sgst_percent}%):</span><span>₹{((saleDetails.sale.total_amount+saleDetails.sale.discount) * saleDetails.sale.sgst_percent / (100+saleDetails.sale.cgst_percent+saleDetails.sale.sgst_percent)).toFixed(2)}</span></div>
                  </>
                )}
                <div className="flex justify-between font-bold text-base pt-2 border-t"><span className="text-slate-800">Grand Total:</span><span className="text-primary-700">₹{saleDetails.sale.total_amount.toFixed(2)}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Paid:</span><span>₹{saleDetails.sale.amount_paid.toFixed(2)}</span></div>
                <div className="flex justify-between font-semibold pt-2 border-t"><span className="text-slate-700">Balance:</span><span className={saleDetails.sale.total_amount - saleDetails.sale.amount_paid > 0 ? 'text-red-600' : 'text-green-600'}>₹{(saleDetails.sale.total_amount - saleDetails.sale.amount_paid).toFixed(2)}</span></div>
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-4 border-t border-slate-200">
              <button
                onClick={() => setIsViewOpen(false)}
                className="px-4 py-2 text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition"
              >
                Close
              </button>
              <button
                onClick={() => handlePrint(saleDetails.sale)}
                className="px-4 py-2 bg-primary-700 hover:bg-primary-800 text-white rounded-lg font-medium transition flex items-center"
              >
                <Printer className="w-4 h-4 mr-2" /> Print Invoice
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Export to Busy Modal */}
      <Modal isOpen={isExportOpen} onClose={() => setIsExportOpen(false)} title="Export Bills to Busy Software">
        <div className="space-y-6">
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
            <p className="text-sm text-emerald-800 font-medium">This will generate an Excel (.xlsx) file that you can directly import into Busy Accounting Software.</p>
            <p className="text-xs text-emerald-600 mt-1">Busy Path: Administration → Data Export Import → Import Vouchers from Excel</p>
          </div>

          <div>
            <p className="text-sm font-semibold text-slate-700 mb-3">Which bills do you want to export?</p>
            <div className="grid grid-cols-3 gap-3">
              {[
                { value: 'kaccha', label: 'Kaccha Bills', sublabel: 'Pro Forma / Without GST', color: 'slate', count: sales.filter(s => s.sale_type === 'kaccha').length },
                { value: 'pakka', label: 'Pakka Bills', sublabel: 'Tax Invoice / With GST', color: 'purple', count: sales.filter(s => s.sale_type === 'pakka').length },
                { value: 'both', label: 'Both', sublabel: 'All Bills Combined', color: 'emerald', count: sales.length },
              ].map(opt => {
                const isSelected = exportType === opt.value;
                const colorMap = {
                  slate: isSelected ? 'bg-slate-700 text-white border-slate-800 shadow-lg' : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100',
                  purple: isSelected ? 'bg-purple-600 text-white border-purple-700 shadow-lg' : 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100',
                  emerald: isSelected ? 'bg-emerald-600 text-white border-emerald-700 shadow-lg' : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100',
                };
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setExportType(opt.value)}
                    className={`py-3 px-3 rounded-xl border-2 font-bold text-center transition-all duration-200 ${colorMap[opt.color]}`}
                  >
                    <div className="text-base">{opt.label}</div>
                    <div className={`text-[10px] font-medium mt-0.5 ${isSelected ? 'opacity-90' : 'opacity-70'}`}>{opt.sublabel}</div>
                    <div className={`text-xs font-bold mt-1 ${isSelected ? 'opacity-80' : 'opacity-50'}`}>{opt.count} bills</div>
                  </button>
                );
              })}
            </div>
          </div>

          {fromDate && toDate && (
            <p className="text-sm text-slate-500">Date Range: <span className="font-medium text-slate-700">{formatDate(fromDate)} — {formatDate(toDate)}</span></p>
          )}

          <div className="flex justify-end space-x-3 pt-4 border-t border-slate-200">
            <button
              onClick={() => setIsExportOpen(false)}
              className="px-4 py-2 text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleExportBusy}
              disabled={exporting}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition flex items-center shadow-sm disabled:opacity-50"
            >
              {exporting ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></div>
              ) : (
                <Download className="w-4 h-4 mr-2" />
              )}
              Export Excel
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={isConfirmOpen}
        onConfirm={handleDelete}
        onCancel={() => setIsConfirmOpen(false)}
        title="Delete Sale"
        message={`Are you sure you want to delete invoice ${selectedSale?.invoice_no}? This action cannot be undone.`}
        confirmText="Delete"
        variant="danger"
      />
    </div>
  );
}
