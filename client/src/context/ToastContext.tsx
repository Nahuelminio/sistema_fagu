import { createContext, useCallback, useContext, useState } from 'react'

type ToastType = 'success' | 'error' | 'info'

interface Toast {
  id: number
  message: string
  type: ToastType
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType) => void
}

const ToastContext = createContext<ToastContextValue>({ showToast: () => {} })

let nextId = 0

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const showToast = useCallback((message: string, type: ToastType = 'success') => {
    const id = ++nextId
    setToasts((prev) => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 3500)
  }, [])

  const dismiss = (id: number) => setToasts((prev) => prev.filter((t) => t.id !== id))

  const typeStyles: Record<ToastType, string> = {
    success: 'border-green-700/60 bg-green-950 text-green-300',
    error:   'border-red-700/60   bg-red-950   text-red-300',
    info:    'border-zinc-700     bg-zinc-900   text-zinc-200',
  }

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}

      {/* Toast container — top-center, above everything */}
      <div className="fixed top-4 left-1/2 z-50 flex -translate-x-1/2 flex-col items-center gap-2 pointer-events-none w-full max-w-sm px-4">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            onClick={() => dismiss(toast.id)}
            className={`pointer-events-auto w-full rounded-xl border px-4 py-3 text-sm font-medium shadow-xl
              animate-slide-in cursor-pointer select-none ${typeStyles[toast.type]}`}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  return useContext(ToastContext)
}
