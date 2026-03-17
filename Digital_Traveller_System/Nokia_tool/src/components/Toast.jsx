import { useEffect } from 'react';
import { CheckCircle, AlertCircle, Info, X, AlertTriangle } from 'lucide-react';

export const Toast = ({ message, type = 'info', onClose, duration = 3000 }) => {
  
  // Auto-close timer
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  // Icons based on type
  const icons = {
    success: <CheckCircle className="w-6 h-6 text-green-600" />,
    error: <AlertCircle className="w-6 h-6 text-red-600" />,
    warning: <AlertTriangle className="w-6 h-6 text-yellow-600" />,
    info: <Info className="w-6 h-6 text-blue-600" />
  };

  // Side Border Colors
  const borderColors = {
    success: 'border-l-green-600',
    error: 'border-l-red-600',
    warning: 'border-l-yellow-600',
    info: 'border-l-blue-600'
  };

  // Titles based on type
  const titles = {
    success: 'Success',
    error: 'Error',
    warning: 'Warning',
    info: 'Notification'
  };

  return (
    <div className={`fixed top-24 right-6 z-[100] flex items-start gap-4 px-6 py-4 rounded-lg shadow-[0_8px_30px_rgba(0,0,0,0.15)] bg-white border border-slate-200 border-l-[6px] ${borderColors[type] || borderColors.info} animate-in slide-in-from-right-10 duration-300 min-w-[320px] max-w-md`}>
      
      {/* Icon */}
      <div className="flex-shrink-0 mt-0.5">
        {icons[type] || icons.info}
      </div>

      {/* Content */}
      <div className="flex-1">
        <h4 className="text-sm font-bold text-slate-900 leading-none mb-1">
          {titles[type] || 'Notification'}
        </h4>
        <p className="text-sm font-medium text-slate-600 leading-snug">
          {message}
        </p>
      </div>

      {/* Close Button */}
      <button 
        onClick={onClose} 
        className="text-slate-400 hover:text-slate-900 transition-colors p-1 rounded-full hover:bg-slate-100 -mr-2 -mt-2"
      >
        <X size={18} />
      </button>
    </div>
  );
};