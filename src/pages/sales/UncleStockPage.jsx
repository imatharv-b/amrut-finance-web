import React, { useState, useEffect, useContext } from 'react';
import { Package } from 'lucide-react';
import toast from 'react-hot-toast';
import DataTable from '../../components/DataTable';
import { SeasonContext } from '../../context/SeasonContext';

export default function UncleStockPage() {
  const { activeSeason } = useContext(SeasonContext);
  const [stock, setStock] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (activeSeason) loadStock();
  }, [activeSeason]);

  const loadStock = async () => {
    setLoading(true);
    try {
      const data = await window.db.invoke('issues:getStockSummary', activeSeason.id);
      setStock(data);
    } catch (e) {
      toast.error('Failed to load stock summary');
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    { key: 'product_name', label: 'Product Name', sortable: true },
    { key: 'total_issued', label: 'Total Issued', sortable: true },
    { key: 'total_billed', label: 'Total Billed (Sold)', sortable: true },
    { 
      key: 'pending_qty', 
      label: 'Available / Pending', 
      sortable: true,
      render: (val) => (
        <span className={`font-semibold ${val > 0 ? 'text-emerald-600' : val < 0 ? 'text-red-600' : 'text-slate-600'}`}>
          {val}
        </span>
      )
    }
  ];

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Package className="w-6 h-6 text-primary-600" />
            Stock Register (Uncle)
          </h1>
          <p className="text-slate-500 text-sm">Track issued consignment stock against billed sales</p>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm mb-6 flex gap-4">
        <div className="bg-indigo-50 p-4 rounded-lg flex-1">
          <p className="text-indigo-800 font-medium text-sm">Total Items Issued</p>
          <p className="text-2xl font-bold text-indigo-900 mt-1">{stock.reduce((sum, item) => sum + Number(item.total_issued), 0)}</p>
        </div>
        <div className="bg-emerald-50 p-4 rounded-lg flex-1">
          <p className="text-emerald-800 font-medium text-sm">Total Items Billed</p>
          <p className="text-2xl font-bold text-emerald-900 mt-1">{stock.reduce((sum, item) => sum + Number(item.total_billed), 0)}</p>
        </div>
        <div className="bg-amber-50 p-4 rounded-lg flex-1">
          <p className="text-amber-800 font-medium text-sm">Total Pending</p>
          <p className="text-2xl font-bold text-amber-900 mt-1">{stock.reduce((sum, item) => sum + Number(item.pending_qty), 0)}</p>
        </div>
      </div>

      <DataTable data={stock} columns={columns} loading={loading} />
    </div>
  );
}
