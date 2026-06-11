import React, { useState, useEffect } from 'react';
import { Settings, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import FormField from '../../components/FormField';

export default function SettingsPage() {
  const [settings, setSettings] = useState({
    firm_name: '',
    address: '',
    gstin: '',
    mobile: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const data = await window.db.invoke('settings:get');
      setSettings(data);
    } catch (err) {
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await window.db.invoke('settings:update', settings);
      toast.success('Settings updated successfully');
    } catch (err) {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-6">Loading settings...</div>;
  }

  return (
    <div className="p-6 h-full flex flex-col items-center">
      <div className="w-full max-w-2xl">
        <div className="flex items-center mb-6">
          <div className="p-3 bg-primary-100 text-primary-700 rounded-xl mr-4">
            <Settings className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Firm Settings</h1>
            <p className="text-slate-500">Manage business details used in invoices and reports</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
          <form onSubmit={handleSave} className="space-y-6">
            <FormField label="Firm Name" required>
              <input
                type="text"
                value={settings.firm_name || ''}
                onChange={e => setSettings({ ...settings, firm_name: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none transition"
              />
            </FormField>

            <FormField label="Address">
              <textarea
                rows="3"
                value={settings.address || ''}
                onChange={e => setSettings({ ...settings, address: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none transition"
              />
            </FormField>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField label="GSTIN">
                <input
                  type="text"
                  value={settings.gstin || ''}
                  onChange={e => setSettings({ ...settings, gstin: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none transition"
                />
              </FormField>

              <FormField label="Mobile Number">
                <input
                  type="text"
                  value={settings.mobile || ''}
                  onChange={e => setSettings({ ...settings, mobile: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none transition"
                />
              </FormField>
            </div>

            <div className="pt-4 border-t border-slate-200 flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2.5 bg-primary-700 hover:bg-primary-800 text-white rounded-lg font-medium transition flex items-center shadow-sm disabled:opacity-50"
              >
                <Save className="w-5 h-5 mr-2" />
                {saving ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </form>
        </div>

        <div className="mt-8 bg-red-50 rounded-2xl border border-red-200 p-8">
          <h2 className="text-lg font-bold text-red-800 mb-2">Temporary Setup Action</h2>
          <p className="text-red-600 mb-4 text-sm">
            Click the button below to create the entry-level user "Dinesh C." (dinesh@bioamrut.com). 
            <br/><strong>Note:</strong> You will be automatically logged in as Dinesh after creation. You must log out and log back in as admin.
          </p>
          <button
            onClick={async () => {
              const { supabase } = await import('../../lib/supabase');
              toast.loading('Setting up user...', { id: 'setupUser' });
              try {
                let userId;
                const { data: authData, error: authError } = await supabase.auth.signUp({ email: 'dinesh@bioamrut.com', password: 'Password123!' });
                
                if (authError) {
                  if (authError.message.includes('already registered')) {
                    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email: 'dinesh@bioamrut.com', password: 'Password123!' });
                    if (signInError) throw signInError;
                    userId = signInData.user.id;
                  } else {
                    throw authError;
                  }
                } else {
                  userId = authData.user.id;
                }

                if (userId) {
                  const { data: companies } = await supabase.from('companies').select('id');
                  if (companies) {
                    for (const company of companies) {
                      await supabase.from('company_users').upsert({
                        company_id: company.id,
                        user_id: userId,
                        role: 'data_entry'
                      }, { onConflict: 'company_id, user_id' });
                    }
                  }
                  toast.success('Dinesh user created successfully! You are now logged in as Dinesh.', { id: 'setupUser' });
                }
              } catch (err) {
                console.error(err);
                toast.error('Failed to setup user: ' + err.message, { id: 'setupUser' });
              }
            }}
            className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition shadow-sm"
          >
            Create Dinesh User
          </button>
        </div>
      </div>
    </div>
  );
}
