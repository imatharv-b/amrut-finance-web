import React, { useState, useEffect } from 'react';
import { Calendar, CheckCircle, Clock, XCircle, Save, CheckCheck, BarChart2, ChevronLeft, ChevronRight, Check, X, Users, Hourglass } from 'lucide-react';
import toast from 'react-hot-toast';

export default function AttendancePage() {
  const [tab, setTab] = useState('daily'); // 'daily' | 'monthly'

  // Daily View State
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [workers, setWorkers] = useState([]);
  const [attendance, setAttendance] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isApproved, setIsApproved] = useState(false);

  // Monthly View State
  const [currentMonth, setCurrentMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [monthlyData, setMonthlyData] = useState([]); // List of worker attendance for month

  useEffect(() => {
    if (tab === 'daily') {
      loadDailyData();
    } else {
      loadMonthlyData();
    }
  }, [tab, date, currentMonth]);

  const loadDailyData = async () => {
    setLoading(true);
    try {
      const [allWorkers, attendanceRecords] = await Promise.all([
        window.db.invoke('workers:getAll'),
        window.db.invoke('attendance:getByDate', date)
      ]);
      
      setWorkers(allWorkers || []);
      
      const attMap = {};
      let approved = false;
      if (attendanceRecords && attendanceRecords.length > 0) {
         approved = attendanceRecords[0].approved;
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

  const loadMonthlyData = async () => {
    setLoading(true);
    try {
      const year = currentMonth.getFullYear();
      const month = currentMonth.getMonth() + 1; // 1-12
      
      const [allWorkers, monthRecords] = await Promise.all([
        window.db.invoke('workers:getAll'),
        window.db.invoke('attendance:getByMonth', year, month)
      ]);
      
      // Organize data: workerId -> { '2026-06-01': 'Present', ... }
      const workerMap = {};
      allWorkers.forEach(w => {
        workerMap[w.id] = { worker: w, records: {} };
      });
      
      if (monthRecords) {
        monthRecords.forEach(rec => {
          if (workerMap[rec.worker_id]) {
            workerMap[rec.worker_id].records[rec.date] = rec.status;
          }
        });
      }
      
      setMonthlyData(Object.values(workerMap));
    } catch (err) {
      toast.error('Failed to load monthly data');
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
    if (!window.confirm("Approve attendance? This will credit salaries to workers' ledgers. This action cannot be undone easily.")) {
       return;
    }
    setSaving(true);
    try {
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

  const changeDate = (days) => {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    setDate(d.toISOString().split('T')[0]);
  };

  const shiftMonth = (months) => {
    const d = new Date(currentMonth);
    d.setMonth(d.getMonth() + months);
    setCurrentMonth(d);
  };

  const getDaysInMonth = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days = [];
    for (let i = 1; i <= daysInMonth; i++) {
      const d = new Date(year, month, i);
      const isSunday = d.getDay() === 0;
      days.push({
        dateNum: i,
        dateStr: `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`,
        isSunday,
        dayName: d.toLocaleDateString('en-US', { weekday: 'narrow' }) // M, T, W, etc.
      });
    }
    return days;
  };

  // --- Render Daily View ---
  const renderDailyView = () => {
    const total = workers.length;
    const present = Object.values(attendance).filter(v => v === 'Present').length;
    const halfDay = Object.values(attendance).filter(v => v === 'Half Day').length;
    const absent = Object.values(attendance).filter(v => v === 'Absent').length;
    const pending = total - (present + halfDay + absent);

    return (
      <div className="w-full flex flex-col">
        {/* Date Navigator */}
        <div className="flex flex-col items-center mb-8">
          <div className="flex items-center space-x-4 bg-white p-2 rounded-xl border border-slate-200 shadow-sm">
            <button onClick={() => changeDate(-1)} className="p-2 hover:bg-slate-100 rounded-lg transition"><ChevronLeft className="w-5 h-5 text-slate-600" /></button>
            <div className="flex items-center px-4 font-semibold text-slate-800 text-lg">
              <input 
                type="date" 
                value={date} 
                onChange={(e) => setDate(e.target.value)}
                className="bg-transparent outline-none cursor-pointer"
              />
            </div>
            <button onClick={() => changeDate(1)} className="p-2 hover:bg-slate-100 rounded-lg transition"><ChevronRight className="w-5 h-5 text-slate-600" /></button>
          </div>
          <span className="text-sm text-slate-400 mt-2 font-medium">Today / आज</span>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col">
            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mb-3">
              <Users className="w-5 h-5 text-slate-600" />
            </div>
            <span className="text-3xl font-bold text-slate-800">{total}</span>
            <span className="text-sm font-medium text-slate-500 mt-1">Total</span>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col">
            <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center mb-3">
              <CheckCircle className="w-5 h-5 text-emerald-600" />
            </div>
            <span className="text-3xl font-bold text-slate-800">{present}</span>
            <span className="text-sm font-medium text-slate-500 mt-1">Present</span>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col">
            <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center mb-3">
              <Hourglass className="w-5 h-5 text-amber-600" />
            </div>
            <span className="text-3xl font-bold text-slate-800">{pending}</span>
            <span className="text-sm font-medium text-slate-500 mt-1">Pending</span>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col">
            <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center mb-3">
              <XCircle className="w-5 h-5 text-red-600" />
            </div>
            <span className="text-3xl font-bold text-slate-800">{absent}</span>
            <span className="text-sm font-medium text-slate-500 mt-1">Absent</span>
          </div>
        </div>

        {/* Action Bar */}
        <div className="flex flex-col sm:flex-row justify-end mb-4 gap-3">
          {isApproved ? (
            <span className="px-6 py-2.5 bg-emerald-100 text-emerald-800 rounded-xl font-bold flex items-center justify-center shadow-sm">
              <CheckCheck className="w-5 h-5 mr-2" /> Approved
            </span>
          ) : (
            <>
              <button onClick={handleSave} disabled={saving} className="w-full sm:w-auto px-5 py-2.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl font-semibold transition shadow-sm disabled:opacity-50 text-center">
                Save Draft
              </button>
              <button onClick={handleApprove} disabled={saving || Object.keys(attendance).length === 0} className="w-full sm:w-auto px-5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-semibold transition shadow-sm disabled:opacity-50 flex items-center justify-center">
                <CheckCheck className="w-4 h-4 mr-2" /> Approve & Credit
              </button>
            </>
          )}
        </div>

        {/* Worker List */}
        <div className="space-y-3 pb-20">
          {workers.map(worker => {
            const status = attendance[worker.id];
            
            // Dynamic styling based on status
            let cardClasses = "flex flex-col md:flex-row items-start md:items-center justify-between p-4 rounded-2xl border shadow-sm transition gap-4 ";
            if (status === 'Present') cardClasses += "bg-emerald-50/30 border-emerald-200";
            else if (status === 'Absent') cardClasses += "bg-red-50/30 border-red-200";
            else if (status === 'Half Day') cardClasses += "bg-amber-50/30 border-amber-200";
            else cardClasses += "bg-orange-50/30 border-orange-200"; // default pending style matching mockup

            return (
              <div key={worker.id} className={cardClasses}>
                <div className="flex items-center space-x-4">
                  {/* Avatar */}
                  <div className={`w-12 h-12 flex items-center justify-center rounded-full font-bold text-lg shadow-sm ${
                    status === 'Present' ? 'bg-emerald-500 text-white' : 
                    status === 'Absent' ? 'bg-red-500 text-white' : 
                    status === 'Half Day' ? 'bg-amber-500 text-white' : 
                    'bg-emerald-600 text-white' // default like mockup
                  }`}>
                    {worker.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 text-lg">{worker.name}</h3>
                    {/* Check-in removed as per request, just showing status text if marked */}
                    <p className="text-sm font-medium text-slate-500">
                      {status === 'Present' ? 'Present' : 
                       status === 'Half Day' ? 'Half Day' : 
                       status === 'Absent' ? 'Absent' : 'Pending'}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 w-full md:w-auto">
                  <button 
                    onClick={() => handleStatusChange(worker.id, 'Present')}
                    disabled={isApproved}
                    className={`flex-1 md:flex-none justify-center px-4 py-2 rounded-xl font-bold flex items-center transition ${
                      status === 'Present' 
                        ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20' 
                        : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                    }`}
                  >
                    <Check className="w-4 h-4 mr-1.5" /> Present
                  </button>
                  <button 
                    onClick={() => handleStatusChange(worker.id, 'Half Day')}
                    disabled={isApproved}
                    className={`flex-1 md:flex-none justify-center px-4 py-2 rounded-xl font-bold flex items-center transition ${
                      status === 'Half Day' 
                        ? 'bg-amber-500 text-white shadow-md shadow-amber-500/20' 
                        : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                    }`}
                  >
                    <Clock className="w-4 h-4 mr-1.5" /> Half Day
                  </button>
                  <button 
                    onClick={() => handleStatusChange(worker.id, 'Absent')}
                    disabled={isApproved}
                    className={`flex-1 md:flex-none justify-center px-4 py-2 rounded-xl font-bold flex items-center transition ${
                      status === 'Absent' 
                        ? 'bg-red-500 text-white shadow-md shadow-red-500/20' 
                        : 'bg-red-100 text-red-700 hover:bg-red-200'
                    }`}
                  >
                    <X className="w-4 h-4 mr-1.5" /> Absent
                  </button>
                </div>
              </div>
            );
          })}
          {workers.length === 0 && !loading && (
             <div className="text-center py-10 text-slate-500 font-medium">No workers found. Please add workers first.</div>
          )}
        </div>
      </div>
    );
  };

  // --- Render Monthly View ---
  const renderMonthlyView = () => {
    const daysInMonth = getDaysInMonth();
    
    return (
      <div className="w-full flex flex-col">
        {/* Month Navigator */}
        <div className="flex items-center justify-center space-x-4 mb-8">
          <button onClick={() => shiftMonth(-1)} className="p-2.5 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition shadow-sm"><ChevronLeft className="w-5 h-5 text-slate-600" /></button>
          <span className="font-bold text-lg md:text-xl text-slate-800 text-center min-w-[120px]">
            {currentMonth.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
          </span>
          <button onClick={() => shiftMonth(1)} className="p-2.5 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition shadow-sm"><ChevronRight className="w-5 h-5 text-slate-600" /></button>
        </div>

        {/* Worker Calendars */}
        <div className="space-y-6 pb-20">
          {monthlyData.map(data => {
            const { worker, records } = data;
            
            // Calculate stats
            let presentCount = 0;
            let halfDayCount = 0;
            let absentCount = 0;
            
            Object.values(records).forEach(status => {
              if (status === 'Present') presentCount++;
              if (status === 'Half Day') halfDayCount++;
              if (status === 'Absent') absentCount++;
            });
            
            const totalWorkDays = daysInMonth.filter(d => !d.isSunday && new Date(d.dateStr) <= new Date()).length; // working days up to today
            const attendedDays = presentCount + (halfDayCount * 0.5);
            let percent = totalWorkDays > 0 ? Math.round((attendedDays / totalWorkDays) * 100) : 0;
            if (percent > 100) percent = 100;

            return (
              <div key={worker.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col">
                <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-6 gap-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-full bg-emerald-600 flex items-center justify-center text-white font-bold text-lg shadow-sm flex-shrink-0">
                      {worker.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-800 text-lg leading-tight">{worker.name}</h3>
                      <p className="text-sm text-slate-400 font-medium">{currentMonth.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</p>
                    </div>
                  </div>
                  
                  {/* Pills */}
                  <div className="flex flex-wrap gap-2">
                    <span className="px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg text-sm font-bold border border-emerald-100 flex items-center">
                      <span className="text-emerald-500 mr-1.5">{presentCount}</span> Present
                    </span>
                    {halfDayCount > 0 && (
                      <span className="px-3 py-1.5 bg-amber-50 text-amber-700 rounded-lg text-sm font-bold border border-amber-100 flex items-center">
                        <span className="text-amber-500 mr-1.5">{halfDayCount}</span> Half Day
                      </span>
                    )}
                    <span className="px-3 py-1.5 bg-red-50 text-red-700 rounded-lg text-sm font-bold border border-red-100 flex items-center">
                      <span className="text-red-500 mr-1.5">{absentCount}</span> Absent
                    </span>
                    <span className="px-4 py-1.5 bg-emerald-100 text-emerald-800 rounded-lg text-sm font-bold shadow-sm">
                      {percent}%
                    </span>
                  </div>
                </div>

                {/* Calendar Grid */}
                <div className="flex space-x-1.5 overflow-x-auto pb-2 scrollbar-hide">
                  {daysInMonth.map(d => {
                    const status = records[d.dateStr];
                    let bgClass = 'bg-slate-100 text-slate-400'; // Default / No Data
                    
                    if (d.isSunday) {
                      bgClass = 'bg-rose-50 text-rose-300';
                    } else if (status === 'Present') {
                      bgClass = 'bg-emerald-500 text-white shadow-sm';
                    } else if (status === 'Half Day') {
                      bgClass = 'bg-amber-400 text-white shadow-sm';
                    } else if (status === 'Absent') {
                      bgClass = 'bg-red-500 text-white shadow-sm';
                    } else if (new Date(d.dateStr) < new Date() && !status) {
                       // Past day, no data
                       bgClass = 'bg-slate-200 text-slate-500';
                    } else if (new Date(d.dateStr).toDateString() === new Date().toDateString() && !status) {
                       // Today, pending
                       bgClass = 'bg-amber-300 text-amber-900';
                    }
                    
                    return (
                      <div key={d.dateNum} className="flex flex-col items-center min-w-[32px]">
                        <span className="text-[10px] font-bold text-slate-400 mb-1">{d.dayName}</span>
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm transition-transform hover:scale-110 ${bgClass}`}>
                          {status === 'Present' ? <Check className="w-4 h-4"/> : 
                           status === 'Half Day' ? '½' : 
                           status === 'Absent' ? <X className="w-4 h-4"/> : 
                           d.isSunday ? 'S' : 
                           new Date(d.dateStr).toDateString() === new Date().toDateString() && !status ? '?' :
                           '-'}
                        </div>
                        <span className="text-[10px] font-semibold text-slate-400 mt-1">{d.dateNum}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
          {monthlyData.length === 0 && !loading && (
             <div className="text-center py-10 text-slate-500 font-medium">No workers found.</div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="p-6 h-full flex flex-col bg-slate-50/50">
      <div className="w-full max-w-5xl mx-auto flex-1 flex flex-col">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-800">Attendance / हाजिरी</h1>
          <p className="text-slate-500 font-medium mt-1">Approve or reject salesman attendance</p>
        </div>

        {/* Custom Tabs */}
        <div className="flex space-x-2 bg-slate-200/60 p-1.5 rounded-xl w-full md:w-fit mb-8 shadow-inner overflow-x-auto">
          <button 
            onClick={() => setTab('daily')}
            className={`flex-1 md:flex-none justify-center px-4 md:px-5 py-2.5 rounded-lg font-bold flex items-center transition whitespace-nowrap ${
              tab === 'daily' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Calendar className="w-5 h-5 mr-2 text-blue-500" /> Daily View
          </button>
          <button 
            onClick={() => setTab('monthly')}
            className={`flex-1 md:flex-none justify-center px-4 md:px-5 py-2.5 rounded-lg font-bold flex items-center transition whitespace-nowrap ${
              tab === 'monthly' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <BarChart2 className="w-5 h-5 mr-2 text-emerald-500" /> Monthly Analysis
          </button>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin"></div>
          </div>
        ) : tab === 'daily' ? (
          renderDailyView()
        ) : (
          renderMonthlyView()
        )}
      </div>
    </div>
  );
}
