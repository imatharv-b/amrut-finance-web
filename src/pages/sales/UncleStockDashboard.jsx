import React, { useState, useEffect, useContext } from 'react';
import { Package, PlusCircle, ShoppingCart, List, Tag, Eye } from 'lucide-react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import DataTable from '../../components/DataTable';
import Modal from '../../components/Modal';
import { SeasonContext } from '../../context/SeasonContext';
import { formatDate } from '../../lib/dateUtils';

export default function UncleStockDashboard() {
  const navigate = useNavigate();
  const { activeSeason } = useContext(SeasonContext);
  
  const [activeTab, setActiveTab] = useState('stock'); // stock | issues | sales
  
  const [stock, setStock] = useState([]);
  const [issues, setIssues] = useState([]);
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);

  // Issues Modal state
  const [issueDetails, setIssueDetails] = useState(null);
  const [isViewIssueOpen, setIsViewIssueOpen] = useState(false);
  
  useEffect(() => {
    if (activeSeason) loadData();
  }, [activeSeason, activeTab]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'stock') {
        const data = await window.db.invoke('issues:getStockSummary', activeSeason.id);
        setStock(data || []);
      } else if (activeTab === 'issues') {
        const data = await window.db.invoke('issues:getAll', { season_id: activeSeason.id });
        setIssues(data || []);
      } else if (activeTab === 'sales') {
        const data = await window.db.invoke('sales:getAll', { season_id: activeSeason.id, is_issue_sale: true });
        setSales(data || []);
      }
    } catch (e) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleViewIssue = async (issue) => {
    try {
      const details = await window.db.invoke('issues:getById', issue.id);
      setIssueDetails(details);
      setIsViewIssueOpen(true);
    } catch (e) {
      toast.error('Failed to load issue details');
    }
  };

  const stockColumns = [
    { key: 'product_name', label: 'Product Name', sortable: true },
    { key: 'total_issued', label: 'Total Issued', sortable: true },
    { key: 'total_billed', label: 'Total Sold', sortable: true },
    { 
      key: 'pending_qty', 
      label: 'Available in Stock', 
      sortable: true,
      render: (val) => (
        <span className={`font-bold ${val > 0 ? 'text-emerald-600' : val < 0 ? 'text-red-600' : 'text-slate-600'}`}>
          {val}
        </span>
      )
    }
  ];

  const issueColumns = [
    { key: 'issue_no', label: 'Issue No', sortable: true },
    { key: 'date', label: 'Date', sortable: true, render: (val) => formatDate(val) },
    { key: 'total_qty', label: 'Total Quantity', sortable: true },
    { key: 'remarks', label: 'Remarks', sortable: true },
    {
      key: 'actions',
      label: 'Actions',
      render: (_, row) => (
        <div className="flex justify-end gap-2">
          <button onClick={() => handleViewIssue(row)} className="p-1.5 text-slate-400 hover:text-primary-600 rounded-lg hover:bg-primary-50">
            <Eye className="w-4 h-4" />
          </button>
        </div>
      )
    }
  ];

  const salesColumns = [
    { key: 'invoice_no', label: 'Invoice No', sortable: true },
    { key: 'date', label: 'Date', sortable: true, render: (val) => formatDate(val) },
    { key: 'party_name', label: 'Buyer', sortable: true },
    { key: 'total_amount', label: 'Amount (₹)', sortable: true, render: (val) => `₹${Number(val || 0).toFixed(2)}` },
    { key: 'amount_paid', label: 'Paid (₹)', render: (val) => `₹${Number(val || 0).toFixed(2)}` },
    {
      key: 'actions',
      label: 'View',
      render: (_, row) => (
        <button onClick={() => navigate(`/sales/edit/${row.id}`)} className="p-1.5 text-slate-400 hover:text-primary-600 rounded-lg hover:bg-primary-50">
          <Eye className="w-4 h-4" />
        </button>
      )
    }
  ];

  const renderActiveTable = () => {
    if (activeTab === 'stock') return <DataTable data={stock} columns={stockColumns} loading={loading} emptyMessage="No stock available" searchable />;
    if (activeTab === 'issues') return <DataTable data={issues} columns={issueColumns} loading={loading} emptyMessage="No issues recorded" searchable />;
    if (activeTab === 'sales') return <DataTable data={sales} columns={salesColumns} loading={loading} emptyMessage="No sales recorded" searchable />;
  };

  return (
    <div className="p-4 md:p-6 h-full flex flex-col bg-slate-50 overflow-hidden">
      
      {/* Header & Actions */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Package className="w-7 h-7 text-indigo-600" />
            Uncle Bulk Command Center
          </h1>
          <p className="text-slate-500 text-sm mt-1">Manage issues, track available stock, and record sales in one single place.</p>
        </div>
        
        <div className="flex gap-3 w-full md:w-auto">
          <button 
            onClick={() => navigate('/sales/issues/new')}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-white border-2 border-indigo-200 text-indigo-700 rounded-xl hover:bg-indigo-50 font-bold transition shadow-sm"
          >
            <PlusCircle className="w-5 h-5" />
            Issue Stock
          </button>
          <button 
            onClick={() => navigate('/sales/issues/new-sale')}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 font-bold transition shadow-sm"
          >
            <ShoppingCart className="w-5 h-5" />
            Sell / Bill Stock
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 p-1 bg-slate-200/60 rounded-xl mb-6 w-full max-w-2xl shrink-0">
        <button
          onClick={() => setActiveTab('stock')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg font-semibold transition-all duration-200 ${activeTab === 'stock' ? 'bg-white text-indigo-700 shadow' : 'text-slate-600 hover:text-slate-800 hover:bg-slate-200/50'}`}
        >
          <List className="w-4 h-4 hidden sm:block" />
          Stock Balances
        </button>
        <button
          onClick={() => setActiveTab('issues')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg font-semibold transition-all duration-200 ${activeTab === 'issues' ? 'bg-white text-indigo-700 shadow' : 'text-slate-600 hover:text-slate-800 hover:bg-slate-200/50'}`}
        >
          <Package className="w-4 h-4 hidden sm:block" />
          Issue History
        </button>
        <button
          onClick={() => setActiveTab('sales')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg font-semibold transition-all duration-200 ${activeTab === 'sales' ? 'bg-white text-indigo-700 shadow' : 'text-slate-600 hover:text-slate-800 hover:bg-slate-200/50'}`}
        >
          <Tag className="w-4 h-4 hidden sm:block" />
          Billing History
        </button>
      </div>

      {/* Table Container */}
      <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col min-h-0">
        {renderActiveTable()}
      </div>

      {/* Issue Details Modal */}
      <Modal isOpen={isViewIssueOpen} onClose={() => setIsViewIssueOpen(false)} title={`Issue Details - ${issueDetails?.issue?.issue_no}`} size="lg">
        {issueDetails && (
          <div>
            <div className="mb-4 bg-slate-50 p-4 rounded-lg border border-slate-200">
              <p className="text-sm text-slate-500">Date: <span className="font-medium text-slate-800">{formatDate(issueDetails.issue.date)}</span></p>
              {issueDetails.issue.remarks && <p className="text-sm text-slate-500 mt-1">Remarks: <span className="font-medium text-slate-800">{issueDetails.issue.remarks}</span></p>}
            </div>
            <table className="w-full text-left text-sm whitespace-nowrap border border-slate-200 rounded-lg overflow-hidden">
              <thead className="bg-slate-100 text-slate-600 font-medium">
                <tr>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3 text-right">Quantity</th>
                  <th className="px-4 py-3">Unit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {issueDetails.items.map((item, i) => (
                  <tr key={i} className="hover:bg-slate-50 transition">
                    <td className="px-4 py-3 font-medium text-slate-800">{item.product_name}</td>
                    <td className="px-4 py-3 text-right font-semibold">{item.qty}</td>
                    <td className="px-4 py-3 text-slate-500">{item.unit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            <div className="flex justify-end pt-4 mt-4 border-t border-slate-200">
               <button onClick={() => setIsViewIssueOpen(false)} className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg font-medium transition">
                  Close
               </button>
            </div>
          </div>
        )}
      </Modal>

    </div>
  );
}
