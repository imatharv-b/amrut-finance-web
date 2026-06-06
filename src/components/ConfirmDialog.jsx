import React from 'react';
import Modal from './Modal';
import { AlertTriangle } from 'lucide-react';

export default function ConfirmDialog({ isOpen, onConfirm, onCancel, title, message, confirmText, variant = 'danger' }) {
  const isDanger = variant === 'danger';
  const IconBg = isDanger ? 'bg-red-100' : 'bg-amber-100';
  const IconColor = isDanger ? 'text-red-600' : 'text-amber-600';
  const ButtonClass = isDanger 
    ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500' 
    : 'bg-amber-600 hover:bg-amber-700 focus:ring-amber-500';

  return (
    <Modal isOpen={isOpen} onClose={onCancel} title={title} size="sm">
      <div className="flex items-start mb-6 mt-2">
        <div className={`flex-shrink-0 p-2 rounded-full ${IconBg} ${IconColor} mr-4`}>
          <AlertTriangle className="w-6 h-6" />
        </div>
        <div>
          <p className="text-slate-600 text-sm">{message}</p>
        </div>
      </div>
      <div className="flex justify-end space-x-3 mt-6">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          className={`px-4 py-2 text-sm font-medium text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 ${ButtonClass}`}
        >
          {confirmText || 'Confirm'}
        </button>
      </div>
    </Modal>
  );
}
