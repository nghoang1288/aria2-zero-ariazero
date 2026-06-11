import { Trash2, X, AlertCircle } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  taskName?: string;
  showCheckbox?: boolean;
  checkboxLabel?: string;
  checkboxSublabel?: string;
  checkboxChecked?: boolean;
  onCheckboxChange?: (checked: boolean) => void;
  warningMessage?: string;
  confirmText?: string;
  loadingText?: string;
  isLoading?: boolean;
}

export default function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  taskName,
  showCheckbox = false,
  checkboxLabel,
  checkboxSublabel,
  checkboxChecked = false,
  onCheckboxChange,
  warningMessage,
  confirmText = 'Confirm',
  loadingText = 'Processing...',
  isLoading = false,
}: ConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/65 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-sidebar-bg border border-border-main rounded-xl max-w-md w-full overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
        <div className="p-5 border-b border-border-main flex items-center justify-between">
          <h3 className="text-md font-semibold text-text-main flex items-center gap-2">
            <Trash2 className="w-5 h-5 text-rose-500" />
            {title}
          </h3>
          <button 
            onClick={onClose}
            disabled={isLoading}
            className="text-text-dim hover:text-text-main p-1 rounded transition-colors cursor-pointer disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-5 space-y-4">
          <div className="text-xs text-text-dim">
            {message}
            {taskName && (
              <div className="mt-2 p-2.5 bg-page-bg/50 border border-border-main/50 rounded-lg text-text-main font-semibold truncate" title={taskName}>
                {taskName}
              </div>
            )}
          </div>
          
          {showCheckbox && (
            <div className="bg-page-bg/40 border border-border-main/30 rounded-lg p-3.5 space-y-2.5">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={checkboxChecked}
                  onChange={(e) => onCheckboxChange?.(e.target.checked)}
                  disabled={isLoading}
                  className="mt-0.5 rounded border-slate-700 text-cyan-500 focus:ring-cyan-500/30 w-4 h-4 cursor-pointer bg-slate-800"
                />
                <div className="text-xs">
                  <span className="font-semibold text-text-main">{checkboxLabel}</span>
                  {checkboxSublabel && (
                    <p className="text-[10px] text-text-dim mt-0.5">
                      {checkboxSublabel}
                    </p>
                  )}
                </div>
              </label>
              
              {checkboxChecked && warningMessage && (
                <div className="text-[10px] text-amber-400 bg-amber-500/5 border border-amber-500/10 rounded p-2 flex items-start gap-1.5 font-medium animate-in slide-in-from-top-1 duration-200">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{warningMessage}</span>
                </div>
              )}
            </div>
          )}
        </div>
        
        <div className="p-5 border-t border-border-main bg-page-bg/25 flex justify-end gap-3">
          <button 
            onClick={onClose}
            disabled={isLoading}
            className="px-3.5 py-2 text-xs font-medium bg-input-bg border border-border-main rounded-lg text-text-dim hover:text-text-main transition-colors cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>
          <button 
            onClick={onConfirm}
            disabled={isLoading}
            className="px-3.5 py-2 text-xs font-medium bg-rose-500 hover:bg-rose-600 text-white rounded-lg transition-colors flex items-center gap-1.5 shadow-md shadow-rose-500/10 cursor-pointer disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                {loadingText}
              </>
            ) : (
              confirmText
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
