import React from 'react';

const colorMap = {
  green: {
    bg: 'bg-primary-50',
    iconBg: 'bg-primary-100',
    iconColor: 'text-primary-600',
  },
  amber: {
    bg: 'bg-accent-50',
    iconBg: 'bg-accent-100',
    iconColor: 'text-accent-600',
  },
  red: {
    bg: 'bg-red-50',
    iconBg: 'bg-red-100',
    iconColor: 'text-red-600',
  },
  blue: {
    bg: 'bg-blue-50',
    iconBg: 'bg-blue-100',
    iconColor: 'text-blue-600',
  },
  purple: {
    bg: 'bg-purple-50',
    iconBg: 'bg-purple-100',
    iconColor: 'text-purple-600',
  }
};

export default function StatCard({ title, value, icon: Icon, color = 'green', subtitle, onClick }) {
  const styles = colorMap[color] || colorMap.green;

  return (
    <div 
      onClick={onClick}
      className={`p-6 rounded-2xl glass-card relative overflow-hidden group ${onClick ? 'cursor-pointer' : ''}`}
    >
      {/* Decorative gradient blob */}
      <div className={`absolute -right-6 -top-6 w-24 h-24 rounded-full opacity-30 blur-2xl transition-all duration-500 group-hover:scale-150 ${styles.iconBg.replace('bg-', 'bg-gradient-to-br from-white to-')}`}></div>
      
      <div className="flex items-center relative z-10">
        <div className={`p-3 rounded-xl ${styles.bg} border border-white/60 ${styles.iconColor} mr-4 shadow-sm`}>
          {Icon && <Icon className="w-6 h-6" />}
        </div>
        <div>
          <h3 className="text-sm font-bold text-slate-500 mb-1">{title}</h3>
          <p className="text-2xl font-black text-slate-800 tracking-tight">{value}</p>
          {subtitle && <p className="text-xs text-slate-500 mt-1">{subtitle}</p>}
        </div>
      </div>
    </div>
  );
}
