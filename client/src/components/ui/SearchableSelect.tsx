import { useEffect, useRef, useState } from 'react'

export interface SearchOption {
  value: string
  label: string
  /** Texto secundario (ej: stock, precio, unidad). Aparece a la derecha en gris. */
  meta?: string
  /** Texto para hacer matching adicional (ej: nombre alternativo, código) */
  searchText?: string
  /** Si true, no se puede seleccionar (gris). */
  disabled?: boolean
}

interface Props {
  options:        SearchOption[]
  value:          string
  onChange:       (value: string) => void
  placeholder?:   string
  emptyText?:     string
  disabled?:      boolean
  /** Texto que muestra arriba (label) */
  label?:         string
  className?:     string
  /** Altura máxima del dropdown (default 240px) */
  maxHeight?:     number
}

/**
 * Select con buscador integrado. Reemplaza al <select> nativo cuando hay muchas opciones.
 * - Filtra por label + searchText mientras escribís
 * - Navegación con teclado (↑ ↓ Enter Esc)
 * - Click afuera cierra el dropdown
 */
export default function SearchableSelect({
  options, value, onChange, placeholder = 'Buscar...',
  emptyText = 'Sin resultados', disabled, label, className, maxHeight = 240,
}: Props) {
  const [open, setOpen]     = useState(false)
  const [search, setSearch] = useState('')
  const [highlight, setHighlight] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef     = useRef<HTMLInputElement>(null)

  const selected = options.find((o) => o.value === value) ?? null

  // Filtrar
  const q = search.toLowerCase().trim()
  const filtered = q
    ? options.filter((o) =>
        o.label.toLowerCase().includes(q) ||
        (o.searchText?.toLowerCase().includes(q))
      )
    : options

  // Cerrar al hacer click afuera
  useEffect(() => {
    function onClickOut(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setSearch('')
      }
    }
    if (open) document.addEventListener('mousedown', onClickOut)
    return () => document.removeEventListener('mousedown', onClickOut)
  }, [open])

  // Reset highlight cuando cambia la búsqueda
  useEffect(() => { setHighlight(0) }, [search, open])

  function select(opt: SearchOption) {
    if (opt.disabled) return
    onChange(opt.value)
    setOpen(false)
    setSearch('')
  }

  function onKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlight((h) => Math.min(h + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlight((h) => Math.max(h - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const opt = filtered[highlight]
      if (opt) select(opt)
    } else if (e.key === 'Escape') {
      setOpen(false)
      setSearch('')
    }
  }

  function openDropdown() {
    if (disabled) return
    setOpen(true)
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  return (
    <div ref={containerRef} className={`relative ${className ?? ''}`}>
      {label && (
        <label className="block text-xs text-zinc-500 mb-1">{label}</label>
      )}

      {/* Trigger */}
      {!open ? (
        <button
          type="button"
          onClick={openDropdown}
          disabled={disabled}
          className={`w-full flex items-center justify-between rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm outline-none transition
            ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-zinc-600 focus:border-brand-500'}
            ${selected ? 'text-zinc-100' : 'text-zinc-500'}`}
        >
          <span className="truncate text-left flex-1">
            {selected ? selected.label : placeholder}
          </span>
          {selected?.meta && (
            <span className="text-xs text-zinc-500 ml-2 shrink-0">{selected.meta}</span>
          )}
          <span className="ml-2 text-zinc-500 shrink-0">▼</span>
        </button>
      ) : (
        <input
          ref={inputRef}
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={onKey}
          placeholder={placeholder}
          className="w-full rounded-xl border border-brand-500 bg-zinc-800 px-3 py-2.5 text-sm text-zinc-100 outline-none"
        />
      )}

      {/* Dropdown */}
      {open && (
        <div
          className="absolute z-20 mt-1 w-full overflow-y-auto rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl"
          style={{ maxHeight: `${maxHeight}px` }}
        >
          {filtered.length === 0 ? (
            <p className="px-3 py-3 text-sm text-zinc-500">{emptyText}</p>
          ) : (
            filtered.map((opt, i) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => select(opt)}
                onMouseEnter={() => setHighlight(i)}
                disabled={opt.disabled}
                className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm transition
                  ${opt.disabled ? 'text-zinc-600 cursor-not-allowed' : 'text-zinc-200'}
                  ${i === highlight && !opt.disabled ? 'bg-zinc-800' : 'hover:bg-zinc-800'}
                  ${opt.value === value ? 'bg-brand-500/10 text-brand-300' : ''}`}
              >
                <span className="truncate">{opt.label}</span>
                {opt.meta && (
                  <span className="text-xs text-zinc-500 ml-2 shrink-0">{opt.meta}</span>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
