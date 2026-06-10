import React, { useState, useEffect } from 'react';
import { Calendar, CheckCircle, Clock, XCircle, Save, CheckCheck } from 'lucide-react';
import toast from 'react-hot-toast';

export default function AttendancePage() {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [workers, setWorkers] = useState([]);
  const [attendance, setAttendance] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isApproved, setIsApproved] = useState(false);

  useEffect(() => {
    loadData();
  }, [date]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [allWorkers, attendanceRecords] = await Promise.all([
        window.db.invoke('workers:getAll'),
        window.db.invoke('attendance:getByDate', date)
      ]);
      
      setWorkers(allWorkers || []);
      
      // Map existing records
      const attMap = {};
      let approved = false;
      if (attendanceRecords && attendanceRecords.length > 0) {
         approved = attendanceRecords[0].approved; // If one is approved, the day is approved
         attendanceRecords.forEach(rec => {
           attMap[rec.worker_id] = rec.status;
         });
      }
      setAttendance(attMap);
      setIsApproved(approved);
      
    } catch (err) {
      toast.error('Failed to load attendance data');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = (workerId, status) => {
    if (isApproved) return;
    setAttendance(prev => ({ ...prev, [workerId]: status }));
  };

  const handleSave = async () => {
    if (isApproved) return;
    setSaving(true);
    try {
      // Save each marked attendance
      const promises = Object.entries(attendance).map(([workerId, status]) => {
         return window.db.invoke('attendance:mark', {
            worker_id: Number(workerId),
            date,
            status,
            approved: false
         });
      });
      await Promise.all(promises);
      toast.success('Attendance saved successfully');
    } catch (err) {
      toast.error('Failed to save attendance');
    } finally {
      setSaving(false);
    }
  };

  const handleApprove = async () => {
    if (!window.confirm("Approve attendance? This will credit salaries to Daily workers' ledgers. This action cannot be undone easily.")) {
       return;
    }
    
    setSaving(true);
    try {
       // Make sure we save first just in case
       await handleSave();
       
       const res = await window.db.invoke('attendance:approve', date);
       toast.success(`Approved attendance for ${res.count} workers`);
       setIsApproved(true);
    } catch (err) {
       toast.error(err.message || 'Failed to approve attendance');
    } finally {
       setSaving(false);
    }
  };

  return (
    <div className="p-6 h-full flex flex-col items-center">
      <div className="w-full max-w-5xl flex-1 flex flex-col">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center">
            <div className="p-3 bg-teal-100 text-teal-600 rounded-xl mr-4">
              <Calendar className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-800">Attendance Register</h1>
              <p className="text-slate-500">Mark daily attendance and approve to credit daily wages</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 font-medium"
            />
            {isApproved ? (
               <span className="px-4 py-2 bg-emerald-100 text-emerald-800 rounded-lg font-medium flex items-center">
                 <CheckCheck className="w-5 h-5 mr-2" /> Approved
               </span>
            ) : (
               <>
                 <button onClick={handleSave} disabled={saving || isApproved} className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg font-medium transition flex items-center disabled:opacity-50">
                   <Save className="w-4 h-4 mr-2" /> Save Draft
                 </button>
                 <button onClick={handleApprove} disabled={saving || isApproved || Object.keys(attendance).length === 0} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition flex items-center disabled:opacity-50">
                   <CheckCheck className="w-4 h-4 mr-2" /> Approve & Credit
                 </button>
               </>
            )}
          </div>
        </div>

        <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
          {loading ? (
             <div className="flex-1 flex items-center justify-center">Loading...</div>
          ) : workers.length === 0 ? (
             <div className="flex-1 flex items-center justify-center text-slate-500">No workers found. Please add workers first.</div>
          ) : (
             <div className="overflow-y-auto">
               <table className="w-full text-left border-collapse">
                 <thead>
                   <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-sm font-semibold uppercase tracking-wider">
                     <th className="px-6 py-4">Worker Name</th>
                     <th className="px-6 py-4">Salary Type</th>
                     <th className="px-6 py-4">Status</th>
                     <th className="px-6 py-4">Action</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-100">
                   {workers.map(worker => {
                     const status = attendance[worker.id];
                     return (
                       <tr key={worker.id} className="hover:bg-slate-50/50 transition">
                         <td className="px-6 py-4">
                           <div className="font-medium text-slate-800">{worker.name}</div>
                           <div className="text-xs text-slate-500">{worker.phone}</div>
                         </td>
                         <td className="px-6 py-4">
                           <span className="text-sm text-slate-600">{worker.salary_type} ({worker.salary_amount})</span>
                         </td>
                         <td className="px-6 py-4">
                           {status === 'Present' ? <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800"><CheckCircle className="w-3 h-3 mr-1"/> Present</span> :
                            status === 'Absent' ? <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800"><XCircle className="w-3 h-3 mr-1"/> Absent</span> :
                            status === 'Half Day' ? <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800"><Clock className="w-3 h-3 mr-1"/> Half Day</span> :
                            <span className="text-sm text-slate-400 italic">Not Marked</span>}
                         </td>
                         <td className="px-6 py-4">
                           <div className="flex space-x-2">
                             <button disabled={isApproved} onClick={() => handleStatusChange(worker.id, 'Present')} className={`px-3 py-1.5 text-xs font-medium rounded border ${status === 'Present' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'} disabled:opacity-50`}>Present</button>
                             <button disabled={isApproved} onClick={() => handleStatusChange(worker.id, 'Half Day')} className={`px-3 py-1.5 text-xs font-medium rounded border ${status === 'Half Day' ? 'bg-amber-50 border-amber-200 text-amber-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'} disabled:opacity-50`}>Half Day</button>
                             <button disabled={isApproved} onClick={() => handleStatusChange(worker.id, 'Absent')} className={`px-3 py-1.5 text-xs font-medium rounded border ${status === 'Absent' ? 'bg-red-50 border-red-200 text-red-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'} disabled:opacity-50`}>Absent</button>
                           </div>
                         </td>
                       </tr>
                     );
                   })}
                 </tbody>
               </table>
             </div>
          )}
        </div>
      </div>
    </div>
  );
}
