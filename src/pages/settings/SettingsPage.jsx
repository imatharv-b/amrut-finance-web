import React, { useState, useEffect } from 'react';
import { Settings, Save, Users as UsersIcon, Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import FormField from '../../components/FormField';
import { useCompany } from '../../context/CompanyContext';

export default function SettingsPage() {
  const { companies } = useCompany();
  const [settings, setSettings] = useState({
    firm_name: '',
    address: '',
    gstin: '',
    mobile: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [newUser, setNewUser] = useState({
    email: '',
    password: '',
    role: 'salesman',
    company_id: ''
  });

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

  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (!newUser.email || !newUser.password || !newUser.company_id) {
      toast.error('Please fill in all user fields');
      return;
    }
    
    toast.loading('Creating user...', { id: 'createUser' });
    try {
      const { supabase } = await import('../../lib/supabase');
      let userId;
      
      const { data: authData, error: authError } = await supabase.auth.signUp({ 
        email: newUser.email, 
        password: newUser.password 
      });
      
      if (authError) {
        if (authError.message.includes('already registered')) {
          const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ 
            email: newUser.email, 
            password: newUser.password 
          });
          if (signInError) throw signInError;
          userId = signInData.user.id;
        } else {
          throw authError;
        }
      } else {
        userId = authData.user.id;
      }

      if (userId) {
        await supabase.from('company_users').upsert({
          company_id: Number(newUser.company_id),
          user_id: userId,
          role: newUser.role
        }, { onConflict: 'company_id, user_id' });
        
        toast.success(`User created! You are now logged in as ${newUser.email}. Please log out and log back in as admin.`, { id: 'createUser' });
        setNewUser({ email: '', password: '', role: 'salesman', company_id: '' });
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to create user: ' + err.message, { id: 'createUser' });
    }
  };

  if (loading) {
    return <div className="p-6">Loading settings...</div>;
  }

  return (
    <div className="p-6 h-full flex flex-col items-center overflow-y-auto">
      <div className="w-full max-w-2xl space-y-8">
        <div>
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

              <div className="flex justify-end pt-4">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center px-6 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium transition disabled:opacity-50"
                >
                  <Save className="w-5 h-5 mr-2" />
                  {saving ? 'Saving...' : 'Save Settings'}
                </button>
              </div>
            </form>
          </div>
        </div>

        <div>
          <div className="flex items-center mb-6">
            <div className="p-3 bg-indigo-100 text-indigo-700 rounded-xl mr-4">
              <UsersIcon className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-800">User Management</h1>
              <p className="text-slate-500">Create accounts for Data Entry or Salesmen</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl mb-6">
              <p className="text-amber-800 text-sm font-medium">
                <strong>Important:</strong> Creating a user will automatically log you in as them. You will need to log out and log back in as Admin afterwards.
              </p>
            </div>
            
            <form onSubmit={handleCreateUser} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField label="Email Address" required>
                  <input
                    type="email"
                    value={newUser.email}
                    onChange={e => setNewUser({ ...newUser, email: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition"
                    placeholder="salesman@example.com"
                  />
                </FormField>
                
                <FormField label="Password" required>
                  <input
                    type="text"
                    value={newUser.password}
                    onChange={e => setNewUser({ ...newUser, password: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition"
                    placeholder="Min 6 characters"
                  />
                </FormField>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField label="Assign Company" required>
                  <select
                    value={newUser.company_id}
                    onChange={e => setNewUser({ ...newUser, company_id: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition bg-white"
                  >
                    <option value="">Select a company...</option>
                    {companies.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </FormField>

                <FormField label="User Role" required>
                  <select
                    value={newUser.role}
                    onChange={e => setNewUser({ ...newUser, role: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition bg-white"
                  >
                    <option value="data_entry">Data Entry</option>
                    <option value="salesman">Salesman (View Only)</option>
                    <option value="admin">Admin</option>
                  </select>
                </FormField>
              </div>

              <div className="flex justify-end pt-4">
                <button
                  type="submit"
                  className="flex items-center px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition shadow-sm"
                >
                  <Plus className="w-5 h-5 mr-2" />
                  Create User
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
