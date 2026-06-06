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

export default function StatCard({ title, value, icon: Icon, color = 'green', subtitle }) {
  const styles = colorMap[color] || colorMap.green;

  return (
    <div className={`p-6 rounded-2xl ${styles.bg} border border-white/50 shadow-sm hover:shadow-md transition duration-200 glass-card`}>
      <div className="flex items-center">
        <div className={`p-3 rounded-xl ${styles.iconBg} ${styles.iconColor} mr-4`}>
          {Icon && <Icon className="w-6 h-6" />}
        </div>
        <div>
          <h3 className="text-sm font-medium text-slate-500 mb-1">{title}</h3>
          <p className="text-2xl font-bold text-slate-800">{value}</p>
          {subtitle && <p className="text-xs text-slate-500 mt-1">{subtitle}</p>}
        </div>
      </div>
    </div>
  );
}
