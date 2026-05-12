/**
 * Guards para evitar stock negativo en la base de datos.
 *
 * Los decrementos se hacen con `{ decrement: N }` de Prisma, que es atómico
 * pero NO valida que el resultado sea ≥ 0. Estos helpers re-leen el valor
 * después de la operación dentro de la misma transacción y, si quedó
 * negativo, lo normalizan a 0 y registran un AJUSTE para auditoría.
 *
 * Es una capa defensiva: la validación previa al transaction sigue siendo
 * la primera línea de defensa. Esto cubre race conditions o bugs.
 */

import { Prisma } from '@prisma/client'

type Tx = Omit<Prisma.TransactionClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>

/** Normaliza el stock de un producto a 0 si quedó negativo, registra AJUSTE */
export async function guardProductStock(
  tx: Tx,
  productId: number,
  userId: number,
  context: string,
): Promise<void> {
  const p = await tx.product.findUnique({ where: { id: productId }, select: { currentStock: true, name: true } })
  if (!p) return
  const stock = Number(p.currentStock)
  if (stock < 0) {
    await tx.product.update({
      where: { id: productId },
      data:  { currentStock: 0 },
    })
    await tx.stockMovement.create({
      data: {
        productId,
        userId,
        type: 'AJUSTE',
        quantity: Math.abs(stock),
        notes: `Normalización a 0 — stock quedó en ${stock.toFixed(2)} (${context})`,
      },
    })
    console.warn(`[StockGuard] ${p.name}: stock negativo normalizado a 0 (era ${stock}, contexto: ${context})`)
  }
}

/** Normaliza el restante de TODAS las botellas activas a 0 si quedaron negativas */
export async function guardBotellaActivaRestante(tx: Tx): Promise<void> {
  await tx.botellaActiva.updateMany({
    where: { restante: { lt: 0 } },
    data:  { restante: 0 },
  })
}
