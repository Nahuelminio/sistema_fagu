import { InputHTMLAttributes, forwardRef } from 'react'

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

const Input = forwardRef<HTMLInputElement, Props>(({ label, error, className = '', ...props }, ref) => (
  <div className="flex flex-col gap-1">
    {label && <label className="text-sm font-medium text-gray-700">{label}</label>}
    <input
      ref={ref}
      className={`rounded-xl border border-gray-300 px-3 py-2.5 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 ${error ? 'border-red-400' : ''} ${className}`}
      {...props}
    />
    {error && <span className="text-xs text-red-500">{error}</span>}
  </div>
))

Input.displayName = 'Input'
export default Input
