/**
 * Limpia los grupos plurales vacíos creados por preparar-medidas.ts
 * y consolida en los grupos singulares existentes.
 */

import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

const GRUPOS_A_BORRAR = [
  'Tequilas', 'Vodkas', 'Rones', 'Cachaças', 'Fernets',
  'Camparis', 'Aperoles', 'Gancias', 'Vermuts', 'Gines',
]

async function main() {
  console.log('\n🧹 Limpiando grupos duplicados...\n')

  // Caso especial: "Gines" tiene Gin Importado. Lo movemos al grupo "Gin" existente.
  const grupoGin = await prisma.productGroup.findUnique({ where: { name: 'Gin' } })
  const grupoGines = await prisma.productGroup.findUnique({ where: { name: 'Gines' } })
  if (grupoGin && grupoGines) {
    await prisma.product.updateMany({
      where: { grupoId: grupoGines.id },
      data:  { grupoId: grupoGin.id },
    })
    console.log(`✓ Movido Gin Importado al grupo "Gin"`)
  }

  // Borrar todos los grupos plurales vacíos (los productos quedan en sus singulares)
  for (const name of GRUPOS_A_BORRAR) {
    const g = await prisma.productGroup.findUnique({ where: { name } })
    if (!g) continue
    // Por las dudas: desvincular cualquier producto que aún apunte ahí
    await prisma.product.updateMany({ where: { grupoId: g.id }, data: { grupoId: null } })
    await prisma.productGroup.delete({ where: { id: g.id } })
    console.log(`✓ Borrado grupo vacío "${name}"`)
  }

  console.log('\n✅ Listo. Estado final de grupos:')
  const groups = await prisma.productGroup.findMany({
    include: { products: { select: { name: true } } },
    orderBy: { name: 'asc' },
  })
  groups.forEach((g) => {
    console.log(`   [${g.id}] ${g.name}: ${g.products.map((x) => x.name).join(', ') || '(vacío)'}`)
  })
}

main()
  .catch((e) => { console.error('❌', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
