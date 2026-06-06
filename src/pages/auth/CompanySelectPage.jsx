import React from 'react';
import { useCompany } from '../context/CompanyContext';
import { Building2, LogOut } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function CompanySelectPage() {
  const { companies, selectCompany } = useCompany();

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <div className="absolute top-4 right-4">
        <button
          onClick={handleLogout}
          className="flex items-center space-x-2 text-slate-500 hover:text-red-600 transition-colors bg-white px-4 py-2 rounded-lg shadow-sm border border-slate-200"
        >
          <LogOut className="w-4 h-4" />
          <span className="font-medium text-sm">Sign Out</span>
        </button>
      </div>

      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-primary-600 rounded-2xl flex items-center justify-center mx-auto shadow-lg mb-4">
          <Building2 className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900">Select Company</h1>
        <p className="text-slate-500 mt-2">Choose a firm to continue</p>
      </div>

      <div className="grid gap-4 w-full max-w-md">
        {companies.length === 0 ? (
          <div className="bg-white p-6 rounded-xl border border-red-100 shadow-sm text-center">
            <p className="text-red-600 font-medium">No companies assigned.</p>
            <p className="text-slate-500 text-sm mt-1">Please contact your administrator to get access.</p>
          </div>
        ) : (
          companies.map((company) => (
            <button
              key={company.id}
              onClick={() => selectCompany(company)}
              className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:border-primary-500 hover:shadow-md transition-all group flex items-center justify-between text-left"
            >
              <div>
                <h3 className="font-bold text-slate-900 group-hover:text-primary-700 transition-colors text-lg">
                  {company.name}
                </h3>
                {company.gstin && (
                  <p className="text-sm text-slate-500 mt-1">GSTIN: {company.gstin}</p>
                )}
              </div>
              <div className="w-8 h-8 rounded-full bg-slate-50 group-hover:bg-primary-50 flex items-center justify-center transition-colors">
                <div className="w-2 h-2 rounded-full bg-slate-300 group-hover:bg-primary-500 transition-colors" />
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
