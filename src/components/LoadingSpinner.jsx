import React from 'react';

export default function LoadingSpinner({ size = 'md', className = '', fullPage = false }) {
  const sizeClass = {
    sm: 'w-4 h-4 border-2',
    md: 'w-8 h-8 border-3',
    lg: 'w-12 h-12 border-4'
  }[size];

  const spinner = (
    <div className={`rounded-full border-primary-200 border-t-primary-600 animate-spin ${sizeClass} ${className}`}></div>
  );

  if (fullPage) {
    return (
      <div className="flex flex-col items-center justify-center h-full w-full bg-slate-50/50">
        {spinner}
        <p className="mt-4 text-slate-500 font-medium">Loading...</p>
      </div>
    );
  }

  return spinner;
}
