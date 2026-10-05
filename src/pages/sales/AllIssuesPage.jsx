import React, { useState, useEffect, useContext } from 'react';
import { PlusCircle, Trash2, Eye } from 'lucide-react';
import toast from 'react-hot-toast';
import DataTable from '../../components/DataTable';
import ConfirmDialog from '../../components/ConfirmDialog';
import { useNavigate, Link } from 'react-router-dom';
import { SeasonContext } from '../../context/SeasonContext';
import { formatDate } from '../../lib/dateUtils';
import Modal from '../../components/Modal';

export default function AllIssuesPage() {
  const navigate = useNavigate();
  const { activeSeason } = useContext(SeasonContext);
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [selectedIssue, setSelectedIssue] = useState(null);
  const [issueDetails, setIssueDetails] = useState(null);
  const [isViewOpen, setIsViewOpen] = useState(false);

  useEffect(() => {
    if (activeSeason) loadIssues();
  }, [activeSeason]);

  const loadIssues = async () => {
    setLoading(true);
    try {
      const data = await window.db.invoke('issues:getAll', { season_id: activeSeason.id });
      setIssues(data);
    } catch (e) {
      toast.error('Failed to load issues');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    try {
      await window.db.invoke('issues:delete', selectedIssue.id);
      toast.success('Issue deleted successfully');
      setIsConfirmOpen(false);
      loadIssues();
    } catch (e) {
      toast.error('Failed to delete issue');
    }
  };

  const handleView = async (issue) => {
    try {
      const details = await window.db.invoke('issues:getById', issue.id);
      setIssueDetails(details);
      setIsViewOpen(true);
    } catch (e) {
      toast.error('Failed to load issue details');
    }
  };

  const columns = [
    { key: 'issue_no', label: 'Issue No', sortable: true },
    { key: 'date', label: 'Date', sortable: true, render: (val) => formatDate(val) },
    { key: 'total_qty', label: 'Total Quantity', sortable: true },
    { key: 'remarks', label: 'Remarks', sortable: true },
    {
      key: 'actions',
      label: 'Actions',
      render: (_, row) => (
        <div className="flex justify-end gap-2">
          <button onClick={() => handleView(row)} className="p-1.5 text-slate-400 hover:text-primary-600 rounded-lg hover:bg-primary-50">
            <Eye className="w-4 h-4" />
          </button>
          <button onClick={() => { setSelectedIssue(row); setIsConfirmOpen(true); }} className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )
    }
  ];

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">All Stock Issues</h1>
          <p className="text-slate-500 text-sm">Manage consignment stock issues</p>
        </div>
        <div className="flex gap-3">
          <Link to="/sales/uncle-stock" className="px-4 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg font-medium transition">
            View Stock Register
          </Link>
          <Link to="/sales/issues/new" className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium transition flex items-center gap-2">
            <PlusCircle className="w-5 h-5" />
            New Issue
          </Link>
        </div>
      </div>

      <DataTable data={issues} columns={columns} loading={loading} />

      <ConfirmDialog
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={handleDelete}
        title="Delete Issue"
        message="Are you sure you want to delete this issue? This action cannot be undone."
        confirmText="Delete"
        type="danger"
      />

      <Modal isOpen={isViewOpen} onClose={() => setIsViewOpen(false)} title={`Issue Details - ${issueDetails?.issue?.issue_no}`} size="lg">
        {issueDetails && (
          <div>
            <div className="mb-4">
              <p className="text-sm text-slate-500">Date: <span className="font-medium text-slate-800">{formatDate(issueDetails.issue.date)}</span></p>
              {issueDetails.issue.remarks && <p className="text-sm text-slate-500 mt-1">Remarks: <span className="font-medium text-slate-800">{issueDetails.issue.remarks}</span></p>}
            </div>
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-50 text-slate-600 font-medium">
                <tr>
                  <th className="px-4 py-3 rounded-tl-lg">Product</th>
                  <th className="px-4 py-3 text-right">Quantity</th>
                  <th className="px-4 py-3 rounded-tr-lg">Unit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {issueDetails.items.map((item, i) => (
                  <tr key={i}>
                    <td className="px-4 py-3 font-medium text-slate-800">{item.product_name}</td>
                    <td className="px-4 py-3 text-right">{item.qty}</td>
                    <td className="px-4 py-3 text-slate-500">{item.unit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>
    </div>
  );
}
