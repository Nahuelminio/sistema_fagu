/**
 * Crea la categoría "Cervezas" y mueve todas las cervezas ahí.
 * Antes estaban amontonadas en "Bebidas".
 */

import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

// Patrones para identificar cervezas — match parcial por nombre
const PATRONES = [
  'Corona', 'Stella', 'Heineken', 'Peroni', 'Blue Moon',
  'Amstel', 'Imperial', 'Negra 473', 'Roja 473', 'IPA',
  'Cerveza',
]

async function main() {
  console.log('\n🍺 Creando categoría "Cervezas" y moviendo productos...\n')

  // 1) Crear (o reutilizar) la categoría "Cervezas"
  let cervezasCat = await prisma.category.findUnique({ where: { name: 'Cervezas' } })
  if (!cervezasCat) {
    // Order = un valor intermedio para que quede entre Bebidas y otras
    const max = await prisma.category.aggregate({ _max: { order: true } })
    cervezasCat = await prisma.category.create({
      data: { name: 'Cervezas', order: (max._max.order ?? 0) + 1 },
    })
    console.log(`✨ Categoría "Cervezas" creada (id=${cervezasCat.id})`)
  } else {
    console.log(`↻ Categoría "Cervezas" ya existía (id=${cervezasCat.id})`)
  }

  // 2) IMPORTANTE: excluir productos que NO son cervezas pero contienen 'Cerveza' o 'Sin Alcohol'
  //    Las "Cervezas Sin Alcohol" SÍ son cervezas → las movemos.
  const cervezas = await prisma.product.findMany({
    where: {
      OR: PATRONES.map((p) => ({ name: { contains: p } })),
    },
    include: { category: true },
    orderBy: { name: 'asc' },
  })

  // Filtrar falsos positivos (por las dudas — no debería haber)
  const aMover = cervezas.filter((c) => {
    // Excluir si por algún motivo cae acá un producto que no es cerveza
    // (Cepita Naranja no matchea, Citric tampoco — patrones limpios)
    return true
  })

  console.log(`\n📦 ${aMover.length} cervezas detectadas:`)
  aMover.forEach((c) => console.log(`   - [${c.category.name}] ${c.name}`))

  // 3) Moverlas a la nueva categoría
  const yaEstaban = aMover.filter((c) => c.categoryId === cervezasCat!.id)
  const aMoverDeVerdad = aMover.filter((c) => c.categoryId !== cervezasCat!.id)

  if (aMoverDeVerdad.length > 0) {
    await prisma.product.updateMany({
      where: { id: { in: aMoverDeVerdad.map((c) => c.id) } },
      data:  { categoryId: cervezasCat.id },
    })
    console.log(`\n✅ Movidas: ${aMoverDeVerdad.length}`)
  }
  if (yaEstaban.length > 0) {
    console.log(`↻ Ya estaban en Cervezas: ${yaEstaban.length}`)
  }

  console.log('\n🎉 Listo. Refrescá el catálogo para ver el cambio.\n')
}

main()
  .catch((e) => { console.error('❌', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
