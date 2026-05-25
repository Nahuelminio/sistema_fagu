/**
 * Reset del sistema para arranque del cliente.
 *
 * BORRA:
 *   - Sale + SaleItem (historial de ventas)
 *   - StockMovement (historial de movimientos de stock)
 *   - Comanda + ComandaItem (todas, abiertas y cerradas)
 *   - Caja + MovimientoCaja (historial de cajas)
 *   - BotellaActiva (todas las botellas abiertas)
 *   - GastoMensual + OrdenCompra/OrdenItem
 *
 * MANTIENE:
 *   - Users, Categories, Products, ProductGroup, Trago + ingredientes,
 *     Mesas, Clientes, Proveedores
 *
 * RESETEA:
 *   - currentStock de cada producto a 0
 *
 * ⚠️ DESTRUCTIVO — confirmar antes de correr.
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('\n⚠️  RESET DEL SISTEMA — borrando historiales...\n')

  const result = await prisma.$transaction(async (tx) => {
    // Orden: hijos antes que padres por FK constraints
    const saleItems        = await tx.saleItem.deleteMany()
    const sales            = await tx.sale.deleteMany()
    const stockMovs        = await tx.stockMovement.deleteMany()
    const comandaItems     = await tx.comandaItem.deleteMany()
    const comandas         = await tx.comanda.deleteMany()
    const movimientosCaja  = await tx.movimientoCaja.deleteMany()
    const cajas            = await tx.caja.deleteMany()
    const botellas         = await tx.botellaActiva.deleteMany()
    const gastos           = await tx.gastoMensual.deleteMany()
    const ordenItems       = await tx.ordenItem.deleteMany()
    const ordenes          = await tx.ordenCompra.deleteMany()
    const stockReset       = await tx.product.updateMany({ data: { currentStock: 0 } })
    return {
      saleItems, sales, stockMovs, comandaItems, comandas,
      movimientosCaja, cajas, botellas, gastos, ordenItems, ordenes, stockReset,
    }
  }, { timeout: 60000 })

  console.log('✅ Listo. Borrados:')
  console.log(`   - SaleItems:        ${result.saleItems.count}`)
  console.log(`   - Sales:            ${result.sales.count}`)
  console.log(`   - StockMovements:   ${result.stockMovs.count}`)
  console.log(`   - ComandaItems:     ${result.comandaItems.count}`)
  console.log(`   - Comandas:         ${result.comandas.count}`)
  console.log(`   - MovimientosCaja:  ${result.movimientosCaja.count}`)
  console.log(`   - Cajas:            ${result.cajas.count}`)
  console.log(`   - BotellasActivas:  ${result.botellas.count}`)
  console.log(`   - Gastos:           ${result.gastos.count}`)
  console.log(`   - OrdenItems:       ${result.ordenItems.count}`)
  console.log(`   - OrdenesCompra:    ${result.ordenes.count}`)
  console.log(`✅ Stock reseteado a 0 en ${result.stockReset.count} productos`)
  console.log('\n🎉 Sistema listo para arranque del cliente.\n')
}

main()
  .catch((e) => { console.error('❌ Error:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
