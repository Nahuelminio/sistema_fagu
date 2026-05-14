/**
 * Servicio de facturación electrónica — ARCA (ex-AFIP)
 *
 * Para activar:
 * 1. Colocar los archivos del certificado en server/certs/
 *    - certificate.pem
 *    - privatekey.pem
 * 2. Configurar las variables de entorno en .env:
 *    ARCA_CUIT=20XXXXXXXXX
 *    ARCA_PUNTO_VENTA=1
 *    ARCA_PRODUCTION=false   (cambiar a true cuando esté listo para producción)
 *    ARCA_CBTE_TIPO=11       (11 = Factura C Monotributista, 6 = Factura B RI)
 * 3. Cambiar ARCA_ENABLED=true en .env
 *
 * Usa la librería `afip.ts` que se comunica DIRECTAMENTE con los web services
 * de ARCA (WSAA + WSFE) usando los certificados — sin proxies externos.
 */

import fs from 'fs'
import path from 'path'
import https from 'https'
import { Afip } from 'afip.ts'

// AFIP usa cifrado SSL antiguo (DH keys de 1024 bits). Node.js 17+ los rechaza
// por defecto. Forzamos un cipher list más permisivo solo para llamadas HTTPS.
https.globalAgent.options.ciphers = 'DEFAULT:@SECLEVEL=0'

const ARCA_ENABLED = process.env.ARCA_ENABLED === 'true'

// Tipo de comprobante según condición fiscal del negocio:
// 6  = Factura B (Responsable Inscripto a Consumidor Final)
// 11 = Factura C (Monotributista)
const CBTE_TIPO = parseInt(process.env.ARCA_CBTE_TIPO ?? '11')

let afipInstance: Afip | null = null

function getAfip(): Afip | null {
  if (!ARCA_ENABLED) return null
  if (afipInstance) return afipInstance

  const certPath = path.join(__dirname, '../../certs/certificate.pem')
  const keyPath  = path.join(__dirname, '../../certs/privatekey.pem')

  if (!fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
    console.error('[ARCA] No se encontraron los certificados en server/certs/')
    return null
  }

  const cert = fs.readFileSync(certPath, 'utf8')
  const key  = fs.readFileSync(keyPath,  'utf8')

  afipInstance = new Afip({
    cuit:       parseInt(process.env.ARCA_CUIT ?? '0'),
    cert,
    key,
    production: process.env.ARCA_PRODUCTION === 'true',
    handleTicket: false, // afip.ts maneja el cache del token automáticamente
  })

  return afipInstance
}

export interface ClienteFactura {
  nombre: string
  cuit?:  string | null
  dni?:   string | null
}

export interface FacturaResult {
  cae:            string
  caeVencimiento: Date
  nroFactura:     number
  puntoVenta:     number
}

export async function emitirFactura(total: number, cliente?: ClienteFactura | null): Promise<FacturaResult | null> {
  const afip = getAfip()
  if (!afip) {
    console.log('[ARCA] Facturación deshabilitada (ARCA_ENABLED=false o sin certificados)')
    return null
  }

  const puntoVenta = parseInt(process.env.ARCA_PUNTO_VENTA ?? '1')

  // Último comprobante autorizado en este punto de venta
  const lastVoucherResult = await afip.electronicBillingService.getLastVoucher(puntoVenta, CBTE_TIPO)
  const lastNumber = Number(lastVoucherResult.CbteNro ?? 0)
  const nextNumber = lastNumber + 1

  // Fecha en formato YYYYMMDD
  const fechaStr = new Date().toISOString().slice(0, 10).replace(/-/g, '')

  // Determinar tipo y nro de documento del receptor
  let docTipo = 99  // 99 = Consumidor Final
  let docNro  = 0

  if (cliente?.cuit) {
    docTipo = 80  // 80 = CUIT
    docNro  = parseInt(cliente.cuit.replace(/\D/g, ''))
  } else if (cliente?.dni) {
    docTipo = 96  // 96 = DNI
    docNro  = parseInt(cliente.dni.replace(/\D/g, ''))
  }

  // Factura C (Monotributista) → sin IVA discriminado
  // Factura B (RI a Consumidor Final) → IVA 21% incluido en el total
  const isFacturaC = CBTE_TIPO === 11

  // El total que recibimos es bruto (con IVA). Calcular neto e IVA.
  // total = neto + iva  →  neto = total / 1.21  ;  iva = total - neto
  const impNeto = isFacturaC ? total : Math.round((total / 1.21) * 100) / 100
  const impIVA  = isFacturaC ? 0     : Math.round((total - impNeto) * 100) / 100

  const payload: Record<string, unknown> = {
    CantReg:    1,
    PtoVta:     puntoVenta,
    CbteTipo:   CBTE_TIPO,
    Concepto:   1, // 1 = Productos
    DocTipo:    docTipo,
    DocNro:     docNro,
    CbteDesde:  nextNumber,
    CbteHasta:  nextNumber,
    CbteFch:    fechaStr,
    ImpTotal:   total,
    ImpTotConc: 0,
    ImpNeto:    impNeto,
    ImpOpEx:    0,
    ImpIVA:     impIVA,
    ImpTrib:    0,
    MonId:      'PES',
    MonCotiz:   1,
  }

  // Para Factura B agregar el detalle de alicuotas IVA (Id 5 = 21%)
  if (!isFacturaC) {
    payload.Iva = [{ Id: 5, BaseImp: impNeto, Importe: impIVA }]
  }

  const result: any = await afip.electronicBillingService.createVoucher(payload as any) // eslint-disable-line @typescript-eslint/no-explicit-any

  // afip.ts retorna el CAE tanto en el nivel raíz (minúscula) como en response.FeDetResp
  const cae = String(result.cae ?? result.CAE ?? '')
  const vencimientoStr = String(result.caeFchVto ?? result.CAEFchVto ?? '')

  if (!cae) {
    const errors = result.response?.Errors?.Err ?? []
    const errMsg = errors.map((e: any) => `[${e.Code}] ${e.Msg}`).join(' | ') || 'CAE vacío'
    throw new Error(`ARCA rechazó la factura: ${errMsg}`)
  }

  const vencimiento = vencimientoStr.length === 8
    ? new Date(`${vencimientoStr.slice(0, 4)}-${vencimientoStr.slice(4, 6)}-${vencimientoStr.slice(6, 8)}`)
    : new Date()

  console.log(`[ARCA] ✓ Factura emitida — CAE: ${cae} — N° ${puntoVenta}-${String(nextNumber).padStart(8, '0')}`)

  return {
    cae,
    caeVencimiento: vencimiento,
    nroFactura:     nextNumber,
    puntoVenta,
  }
}

export interface NotaCreditoArgs {
  total:    number
  cliente?: ClienteFactura | null
  /** Datos de la factura original que se está anulando */
  facturaOriginal: {
    cbteTipo:   number   // 6 (Factura B), 11 (Factura C), etc.
    puntoVenta: number
    nroFactura: number
    fecha:      Date     // fecha de la factura original (para CbteFch del CbteAsoc)
  }
}

/**
 * Emite una Nota de Crédito (NC) asociada a una factura previa.
 * Tipos: Factura A (1) → NC A (3); Factura B (6) → NC B (8); Factura C (11) → NC C (13).
 * El mapeo es siempre +2.
 */
export async function emitirNotaCredito(args: NotaCreditoArgs): Promise<FacturaResult | null> {
  const afip = getAfip()
  if (!afip) {
    console.log('[ARCA] NC no emitida (ARCA_ENABLED=false o sin certificados)')
    return null
  }

  const puntoVenta = parseInt(process.env.ARCA_PUNTO_VENTA ?? '1')
  // El tipo de NC = tipo de factura + 2 (6 → 8, 11 → 13)
  const ncTipo = args.facturaOriginal.cbteTipo + 2

  // Último NC del mismo tipo
  const lastVoucherResult = await afip.electronicBillingService.getLastVoucher(puntoVenta, ncTipo)
  const lastNumber = Number(lastVoucherResult.CbteNro ?? 0)
  const nextNumber = lastNumber + 1

  const fechaStr = new Date().toISOString().slice(0, 10).replace(/-/g, '')

  // Documento del receptor — mismo que en la factura original
  let docTipo = 99
  let docNro  = 0
  if (args.cliente?.cuit) {
    docTipo = 80
    docNro  = parseInt(args.cliente.cuit.replace(/\D/g, ''))
  } else if (args.cliente?.dni) {
    docTipo = 96
    docNro  = parseInt(args.cliente.dni.replace(/\D/g, ''))
  }

  const isNCC = ncTipo === 13 // NC Factura C
  const impNeto = isNCC ? args.total : Math.round((args.total / 1.21) * 100) / 100
  const impIVA  = isNCC ? 0           : Math.round((args.total - impNeto) * 100) / 100

  // Fecha de la factura original en YYYYMMDD
  const fchOrigStr = args.facturaOriginal.fecha.toISOString().slice(0, 10).replace(/-/g, '')

  const payload: Record<string, unknown> = {
    CantReg:    1,
    PtoVta:     puntoVenta,
    CbteTipo:   ncTipo,
    Concepto:   1,
    DocTipo:    docTipo,
    DocNro:     docNro,
    CbteDesde:  nextNumber,
    CbteHasta:  nextNumber,
    CbteFch:    fechaStr,
    ImpTotal:   args.total,
    ImpTotConc: 0,
    ImpNeto:    impNeto,
    ImpOpEx:    0,
    ImpIVA:     impIVA,
    ImpTrib:    0,
    MonId:      'PES',
    MonCotiz:   1,
    // Comprobante asociado: la factura original que se anula
    CbtesAsoc: [{
      Tipo:   args.facturaOriginal.cbteTipo,
      PtoVta: args.facturaOriginal.puntoVenta,
      Nro:    args.facturaOriginal.nroFactura,
      CbteFch: fchOrigStr,
    }],
  }

  if (!isNCC) {
    payload.Iva = [{ Id: 5, BaseImp: impNeto, Importe: impIVA }]
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result: any = await afip.electronicBillingService.createVoucher(payload as any)
  const cae = String(result.cae ?? result.CAE ?? '')
  const vencimientoStr = String(result.caeFchVto ?? result.CAEFchVto ?? '')

  if (!cae) {
    const errors = result.response?.Errors?.Err ?? []
    const errMsg = errors.map((e: any) => `[${e.Code}] ${e.Msg}`).join(' | ') || 'CAE vacío'
    throw new Error(`ARCA rechazó la Nota de Crédito: ${errMsg}`)
  }

  const vencimiento = vencimientoStr.length === 8
    ? new Date(`${vencimientoStr.slice(0, 4)}-${vencimientoStr.slice(4, 6)}-${vencimientoStr.slice(6, 8)}`)
    : new Date()

  console.log(`[ARCA] ✓ Nota de Crédito emitida — CAE: ${cae} — N° ${puntoVenta}-${String(nextNumber).padStart(8, '0')} (anula factura ${args.facturaOriginal.puntoVenta}-${args.facturaOriginal.nroFactura})`)

  return { cae, caeVencimiento: vencimiento, nroFactura: nextNumber, puntoVenta }
}

/** Tipo de comprobante actual configurado en .env */
export function getCbteTipo(): number {
  return CBTE_TIPO
}
