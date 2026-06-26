/**
 * Asigna todos los productos sueltos a grupos apropiados,
 * para que el cálculo de costo de los tragos use el promedio del grupo
 * en lugar de un costo fijo del producto representante.
 */

import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

// Map: nombreGrupo → [nombres de productos a asignar]
const ASIGNACIONES: Record<string, string[]> = {
  // Aperitivos / Vermuts / Bitters
  'Vermut Dulce':   ['Carpano rosso'],
  'Gancia':         ['Gancia hibiscus', 'Gancia sin alcohol 473ml'],
  'Amargo Obrero':  ['Amargo Obrero'],
  'Pineral':        ['Pineral'],

  // Licores
  'Curacao Azul':   ['3 plumas blue curacao'],
  'Triple Sec':     ['cointreau', 'Tres plumas triple sec'],
  'Fireball':       ['Fireball'],
  'Jagermeister':   ['jagermeister'],
  'Granadina':      ['granadina cusenier', 'granadina tiptop'],
}

// Ron Blanco → rename a "Ron" y meter Bacardi + Havana
async function reorganizarRon() {
  const ronBlanco = await prisma.productGroup.findUnique({ where: { name: 'Ron Blanco' } })
  if (!ronBlanco) {
    console.log('⚠️ No existe grupo "Ron Blanco"')
    return
  }
  // Renombrar a "Ron"
  await prisma.productGroup.update({ where: { id: ronBlanco.id }, data: { name: 'Ron' } })
  // Mover Bacardi y Havana al grupo
  const rones = await prisma.product.findMany({
    where: { OR: [{ name: 'Bacardi' }, { name: { contains: 'Havana' } }] },
    select: { id: true, name: true },
  })
  const r = await prisma.product.updateMany({
    where: { id: { in: rones.map((x) => x.id) } },
    data:  { grupoId: ronBlanco.id },
  })
  console.log(`✅ Grupo "Ron Blanco" → "Ron" + ${r.count} rones movidos`)
}

async function main() {
  console.log('\n🎯 Asignando grupos a productos sueltos...\n')

  for (const [grupoName, productNames] of Object.entries(ASIGNACIONES)) {
    // Crear o reutilizar el grupo
    let g = await prisma.productGroup.findUnique({ where: { name: grupoName } })
    if (!g) {
      g = await prisma.productGroup.create({ data: { name: grupoName } })
      console.log(`✨ Grupo creado: "${grupoName}"`)
    }
    // Asignar productos
    const aMover = await prisma.product.findMany({
      where: { name: { in: productNames }, grupoId: null },
      select: { id: true, name: true },
    })
    if (aMover.length > 0) {
      await prisma.product.updateMany({
        where: { id: { in: aMover.map((x) => x.id) } },
        data:  { grupoId: g.id },
      })
      console.log(`   → ${aMover.length} producto(s) asignado(s): ${aMover.map((x) => x.name).join(', ')}`)
    }
  }

  await reorganizarRon()

  // Estado final: productos que quedan sin grupo
  const huerfanos = await prisma.product.findMany({
    where: {
      grupoId: null,
      category: { name: { in: ['Aperitivos', 'Licores', 'Ron', 'Vodka', 'Gin', 'Whisky'] } },
    },
    include: { category: true },
  })
  if (huerfanos.length > 0) {
    console.log('\n⚠️ Productos que quedan SIN GRUPO (revisar):')
    huerfanos.forEach((p) => console.log(`   - [${p.category.name}] ${p.name}`))
  } else {
    console.log('\n✅ Todos los productos de spirits/aperitivos tienen grupo asignado')
  }
}

main()
  .catch((e) => { console.error('❌', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
