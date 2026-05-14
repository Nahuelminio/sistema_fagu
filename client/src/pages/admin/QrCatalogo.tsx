import { useMemo, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'

export default function QrCatalogo() {
  // URL pública del catálogo (el usuario puede editarla si está en producción)
  const defaultUrl = useMemo(() => {
    return `${window.location.origin}/catalogo`
  }, [])
  const [url, setUrl] = useState(defaultUrl)
  const [size, setSize] = useState(280)

  function handlePrint() { window.print() }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-bold text-zinc-100">QR del catálogo</h1>
        <p className="text-sm text-zinc-500">Imprimí este QR y ponelo en cada mesa para que los clientes vean la carta</p>
      </div>

      {/* Config (no se imprime) */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4 flex flex-col gap-3 print:hidden">
        <label className="text-xs text-zinc-500">URL del catálogo</label>
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-brand-500"
        />
        <label className="text-xs text-zinc-500">Tamaño del QR</label>
        <div className="flex gap-2 flex-wrap">
          {[200, 280, 360, 480].map((s) => (
            <button
              key={s}
              onClick={() => setSize(s)}
              className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
                size === s
                  ? 'border-brand-500 bg-brand-500 text-white'
                  : 'border-zinc-700 bg-zinc-800 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {s}px
            </button>
          ))}
        </div>
        <div>
          <button
            onClick={handlePrint}
            className="rounded-xl bg-zinc-900 border border-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-100 hover:bg-zinc-800 transition"
          >
            Imprimir
          </button>
        </div>
      </div>

      {/* Tarjeta para imprimir */}
      <div id="qr-print" className="mx-auto w-full max-w-md rounded-3xl bg-white text-zinc-900 p-8 shadow-2xl">
        <div className="text-center">
          <p className="text-3xl font-black tracking-widest">FAGU</p>
          <p className="text-xs font-semibold uppercase tracking-[0.4em] text-zinc-600 mt-1">Drink Bar</p>

          <div className="mt-6 flex justify-center bg-white p-3 rounded-2xl">
            <QRCodeSVG value={url} size={size} level="M" includeMargin />
          </div>

          <p className="mt-6 text-base font-semibold text-zinc-800">Escaneá la carta</p>
          <p className="mt-1 text-xs text-zinc-500">Apuntá la cámara del celular al código</p>

          <div className="mx-auto mt-4 h-px w-16 bg-zinc-300" />
          <p className="mt-3 text-[10px] text-zinc-500 break-all">{url}</p>
        </div>
      </div>

      <style>{`
        @media print {
          body * { visibility: hidden; }
          #qr-print, #qr-print * { visibility: visible; }
          #qr-print {
            position: absolute;
            left: 50%;
            top: 50%;
            transform: translate(-50%, -50%);
            box-shadow: none;
            max-width: none;
          }
        }
      `}</style>
    </div>
  )
}
