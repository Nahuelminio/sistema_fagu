import { createContext, useCallback, useContext, useState, ReactNode } from 'react'

interface ConfirmOptions {
  title?: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'default' | 'danger'
}

interface ConfirmContextValue {
  confirm: (opts: ConfirmOptions | string) => Promise<boolean>
}

const ConfirmContext = createContext<ConfirmContextValue>({ confirm: async () => false })

interface PendingConfirm extends ConfirmOptions {
  resolve: (value: boolean) => void
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<PendingConfirm | null>(null)

  const confirm = useCallback((opts: ConfirmOptions | string): Promise<boolean> => {
    const normalized: ConfirmOptions = typeof opts === 'string' ? { message: opts } : opts
    return new Promise((resolve) => {
      setPending({ ...normalized, resolve })
    })
  }, [])

  function close(value: boolean) {
    if (pending) {
      pending.resolve(value)
      setPending(null)
    }
  }

  const variant = pending?.variant ?? 'default'
  const confirmBtn = variant === 'danger'
    ? 'bg-red-500 hover:bg-red-400 text-white'
    : 'bg-brand-500 hover:bg-brand-400 text-white'

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}

      {pending && (
        <div
          onClick={() => close(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur animate-fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl"
          >
            {pending.title && (
              <h3 className="text-base font-semibold text-zinc-100 mb-2">{pending.title}</h3>
            )}
            <p className="text-sm text-zinc-300 whitespace-pre-line leading-relaxed">{pending.message}</p>

            <div className="mt-5 flex gap-2 justify-end">
              <button
                onClick={() => close(false)}
                className="rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-700 transition"
              >
                {pending.cancelLabel ?? 'Cancelar'}
              </button>
              <button
                onClick={() => close(true)}
                autoFocus
                className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${confirmBtn}`}
              >
                {pending.confirmLabel ?? 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  )
}

export function useConfirm() {
  return useContext(ConfirmContext).confirm
}
