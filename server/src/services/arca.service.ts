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
 * 3. Cambiar ARCA_ENABLED=true en .env
 */

import path from 'path'

const ARCA_ENABLED = process.env.ARCA_ENABLED === 'true'

// Tipo de comprobante según condición fiscal del negocio:
// 6  = Factura B (Responsable Inscripto a Consumidor Final)
// 11 = Factura C (Monotributista)
const CBTE_TIPO = parseInt(process.env.ARCA_CBTE_TIPO ?? '11')

let afipInstance: unknown = null

async function getAfip() {
  if (!ARCA_ENABLED) return null
  if (afipInstance) return afipInstance

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Afip = require('@afipsdk/afip.js')

  afipInstance = new Afip({
    CUIT:       parseInt(process.env.ARCA_CUIT ?? '0'),
    cert:       path.join(__dirname, '../../../certs/certificate.pem'),
    key:        path.join(__dirname, '../../../certs/privatekey.pem'),
    production: process.env.ARCA_PRODUCTION === 'true',
    res_folder: path.join(__dirname, '../../../certs/'),
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
  const afip = await getAfip() as any
  if (!afip) {
    console.log('[ARCA] Facturación deshabilitada (ARCA_ENABLED=false)')
    return null
  }

  const puntoVenta = parseInt(process.env.ARCA_PUNTO_VENTA ?? '1')

  const lastVoucher = await afip.ElectronicBilling.getLastVoucher(puntoVenta, CBTE_TIPO)
  const nextNumber  = lastVoucher + 1

  const fecha = new Date().toISOString().slice(0, 10).replace(/-/g, '') // YYYYMMDD

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

  const data = {
    CantReg:    1,
    PtoVta:     puntoVenta,
    CbteTipo:   CBTE_TIPO,
    Concepto:   1,
    DocTipo:    docTipo,
    DocNro:     docNro,
    CbteDesde:  nextNumber,
    CbteHasta:  nextNumber,
    CbteFch:    fecha,
    ImpTotal:   total,
    ImpTotConc: 0,
    ImpNeto:    total,
    ImpOpEx:    0,
    ImpIVA:     0,
    ImpTrib:    0,
    MonId:      'PES',
    MonCotiz:   1,
    Iva: [{ Id: 3, BaseImp: total, Importe: 0 }],
  }

  const result = await afip.ElectronicBilling.createVoucher(data)

  const vencimiento = new Date(
    String(result.CAEFchVto).replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3')
  )

  return {
    cae:            result.CAE,
    caeVencimiento: vencimiento,
    nroFactura:     nextNumber,
    puntoVenta,
  }
}
