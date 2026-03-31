'use client'

import React, { useState, useEffect, createContext, useContext, useCallback } from 'react'
import { X, AlertCircle, CheckCircle, Info, Loader2 } from 'lucide-react'

type ToastType = 'success' | 'error' | 'info' | 'loading'

interface Toast {
  id: string
  message: string
  type: ToastType
  duration?: number
  taskId?: string
}

interface ToastContextType {
  toast: (message: string, type?: ToastType, options?: { duration?: number, taskId?: string }) => void
  success: (message: string, options?: { duration?: number }) => void
  error: (message: string, options?: { duration?: number, taskId?: string }) => void
  loading: (message: string) => string
  dismiss: (id: string) => void
}

const ToastContext = createContext<ToastContextType | undefined>(undefined)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const toast = useCallback((message: string, type: ToastType = 'info', options: { duration?: number, taskId?: string } = {}) => {
    const id = Math.random().toString(36).substring(2, 9)
    const duration = options.duration ?? (type === 'loading' ? Infinity : 5000)
    
    setToasts((prev) => [...prev, { id, message, type, ...options }])

    if (duration !== Infinity) {
      setTimeout(() => dismiss(id), duration)
    }
    
    return id
  }, [dismiss])

  const success = (message: string, options = {}) => toast(message, 'success', options)
  const error = (message: string, options = {}) => toast(message, 'error', options)
  const loading = (message: string) => toast(message, 'loading')

  return (
    <ToastContext.Provider value={{ toast, success, error, loading, dismiss }}>
      {children}
      <div className="fixed bottom-6 right-6 z-[200] flex flex-col gap-3 pointer-events-none">
        {toasts.map((t) => (
          <div 
            key={t.id} 
            className={`pointer-events-auto min-w-[320px] max-w-md p-4 rounded-2xl shadow-2xl border-2 flex items-start gap-4 animate-in slide-in-from-right duration-300 ${
              t.type === 'success' ? 'bg-emerald-950 border-emerald-500/50 text-emerald-200' :
              t.type === 'error' ? 'bg-red-950 border-red-500/50 text-red-200' :
              t.type === 'loading' ? 'bg-slate-900 border-indigo-500/50 text-indigo-200' :
              'bg-slate-900 border-slate-700 text-slate-200'
            }`}
          >
            <div className="shrink-0 mt-0.5">
              {t.type === 'success' && <CheckCircle className="w-5 h-5 text-emerald-400" />}
              {t.type === 'error' && <AlertCircle className="w-5 h-5 text-red-400" />}
              {t.type === 'loading' && <Loader2 className="w-5 h-5 text-indigo-400 animate-spin" />}
              {t.type === 'info' && <Info className="w-5 h-5 text-slate-400" />}
            </div>
            
            <div className="flex-1 flex flex-col gap-1">
              <p className="text-sm font-black leading-tight">{t.message}</p>
              {t.taskId && (
                <p className="text-[10px] font-black uppercase tracking-widest opacity-50">Task ID: {t.taskId}</p>
              )}
            </div>

            <button 
              onClick={() => dismiss(t.id)}
              className="shrink-0 p-1 hover:bg-white/10 rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}
