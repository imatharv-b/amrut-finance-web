import React, { useState, useEffect, useContext } from 'react';
import { Calendar, Plus, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { SeasonContext } from '../../context/SeasonContext';
import FormField from '../../components/FormField';
import DataTable from '../../components/DataTable';

export default function SeasonsPage() {
  const { allSeasons, activeSeason, refreshSeason } = useContext(SeasonContext);
  const [showAdd, setShowAdd] = useState(false);
  const [formData, setFormData] = useState({
    type: 'kharif',
    year: new Date().getFullYear()
  });

  const columns = [
    { key: 'name', label: 'Season Name' },
    { key: 'type', label: 'Type', render: (val) => val === 'kharif' ? 'Kharif' : 'Rabi' },
    { key: 'start_date', label: 'Start Date' },
    { key: 'end_date', label: 'End Date' },
    { 
      key: 'status', 
      label: 'Status', 
      render: (_, season) => (
        (season.is_active === 1 || season.is_active === true)
          ? <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">Active</span>
          : <span className="px-2 py-1 bg-slate-100 text-slate-600 text-xs font-medium rounded-full">Inactive</span>
      )
    },
    {
      key: 'actions',
      label: '',
      render: (_, season) => (
        (!season.is_active || season.is_active === 0 || season.is_active === false) && (
          <button 
            onClick={() => handleSetActive(season.id)}
            className="flex items-center text-sm text-primary-600 hover:text-primary-800 font-medium"
          >
            <Check className="w-4 h-4 mr-1" />
            Set Active
          </button>
        )
      )
    }
  ];

  const handleAdd = async (e) => {
    e.preventDefault();
    try {
      const newSeason = await window.db.invoke('seasons:add', {
        type: formData.type,
        year: Number(formData.year)
      });
      toast.success('Season added successfully');
      // Auto-activate if no active season exists
      if (!activeSeason) {
        await window.db.invoke('seasons:setActive', newSeason.id);
        toast.success('Season auto-activated');
      }
      setShowAdd(false);
      refreshSeason();
    } catch (err) {
      toast.error(err.message || 'Failed to add season');
    }
  };

  const handleSetActive = async (id) => {
    try {
      await window.db.invoke('seasons:setActive', id);
      toast.success('Active season changed');
      refreshSeason();
    } catch (err) {
      toast.error('Failed to set active season');
    }
  };

  return (
    <div className="p-6 h-full flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Financial Seasons</h1>
          <p className="text-slate-500">Manage Kharif and Rabi seasons</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="px-4 py-2 bg-primary-700 hover:bg-primary-800 text-white rounded-lg font-medium transition flex items-center shadow-sm"
        >
          <Plus className="w-5 h-5 mr-1" />
          Add Season
        </button>
      </div>

      {showAdd && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
          <h2 className="text-lg font-bold text-slate-800 mb-4">Add New Season</h2>
          <form onSubmit={handleAdd} className="flex gap-4 items-end">
            <div className="w-48">
              <FormField label="Season Type" required>
                <select 
                  value={formData.type}
                  onChange={e => setFormData({...formData, type: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:border-primary-500"
                >
                  <option value="kharif">Kharif (Apr - Nov)</option>
                  <option value="rabi">Rabi (Dec - Mar)</option>
                </select>
              </FormField>
            </div>
            
            <div className="w-48">
              <FormField label="Start Year" required>
                <input 
                  type="number"
                  value={formData.year}
                  onChange={e => setFormData({...formData, year: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:border-primary-500"
                  min="2020" max="2100"
                />
              </FormField>
            </div>

            <div className="flex gap-2">
              <button 
                type="submit"
                className="px-4 py-2 bg-primary-700 text-white rounded-lg font-medium hover:bg-primary-800"
              >
                Save
              </button>
              <button 
                type="button"
                onClick={() => setShowAdd(false)}
                className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg font-medium hover:bg-slate-200"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="flex-1 overflow-hidden bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col">
        <DataTable 
          data={allSeasons}
          columns={columns}
          keyField="id"
        />
      </div>
    </div>
  );
}
