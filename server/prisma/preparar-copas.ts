/**
 * Prepara la estructura para venta de vino por copa.
 *
 *  1. Crea 4 ProductGroups vacíos: "Copas Tinto", "Copas Blanco",
 *     "Copas Rosado", "Copas Espumante".
 *  2. Crea 4 Tragos: "Copa de Vino Tinto", "Copa de Vino Blanco",
 *     "Copa de Vino Rosado", "Copa de Espumante" — sin precio.
 *  3. Cada trago tiene como ingrediente el PRIMER vino de su categoría
 *     (que se asignará al grupo correspondiente).
 *
 *  En la reunión del miércoles, el cliente:
 *   - Define qué vinos van en cada grupo (asignando grupoId desde el panel).
 *   - Carga el precio de cada trago (Copa de Tinto, etc.).
 *
 *  Tamaño de copa: 5 oz (≈ 150ml).
 */

import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

const COPA_OZ = 5 // 150ml ≈ 5 oz

interface CopaSpec {
  groupName: string
  tragoName: string
  categoryName: string
  description: string
}

const COPAS: CopaSpec[] = [
  { groupName: 'Copas Tinto',     tragoName: 'Copa de Vino Tinto',     categoryName: 'Vinos Tintos',   description: 'Copa 150ml de vino tinto' },
  { groupName: 'Copas Blanco',    tragoName: 'Copa de Vino Blanco',    categoryName: 'Vinos Blancos',  description: 'Copa 150ml de vino blanco' },
  { groupName: 'Copas Rosado',    tragoName: 'Copa de Vino Rosado',    categoryName: 'Vinos Rosados',  description: 'Copa 150ml de vino rosado' },
  { groupName: 'Copas Espumante', tragoName: 'Copa de Espumante',      categoryName: 'Espumantes',     description: 'Copa de espumante' },
]

async function main() {
  console.log('\n🍷 Preparando estructura para venta por copa...\n')

  for (const c of COPAS) {
    // 1) Crear el grupo (si no existe)
    const group = await prisma.productGroup.upsert({
      where:  { name: c.groupName },
      update: {},
      create: { name: c.groupName },
    })

    // 2) Buscar el primer producto de la categoría para usar como ingrediente base
    const category = await prisma.category.findUnique({ where: { name: c.categoryName } })
    if (!category) {
      console.log(`⚠️  No existe la categoría "${c.categoryName}" — salto ${c.tragoName}`)
      continue
    }
    const firstWine = await prisma.product.findFirst({
      where:   { categoryId: category.id },
      orderBy: { name: 'asc' },
    })
    if (!firstWine) {
      console.log(`⚠️  No hay productos en "${c.categoryName}" — salto ${c.tragoName}`)
      continue
    }

    // 3) Asignar el primer vino al grupo (los demás se asignarán manualmente)
    if (firstWine.grupoId !== group.id) {
      await prisma.product.update({
        where: { id: firstWine.id },
        data:  { grupoId: group.id },
      })
    }

    // 4) Crear o actualizar el trago
    const existing = await prisma.trago.findUnique({ where: { name: c.tragoName } })
    let trago
    if (existing) {
      trago = existing
      console.log(`↻  Trago "${c.tragoName}" ya existía, mantengo.`)
    } else {
      trago = await prisma.trago.create({
        data: {
          name:             c.tragoName,
          description:      c.description,
          active:           true,
          visibleInCatalog: false, // que el cliente lo active cuando defina el precio
        },
      })
      console.log(`✨  Trago creado: "${c.tragoName}"`)
    }

    // 5) Asegurar el ingrediente (oz por copa)
    const ing = await prisma.tragoBotella.findFirst({ where: { tragoId: trago.id } })
    if (!ing) {
      await prisma.tragoBotella.create({
        data: {
          tragoId:   trago.id,
          productId: firstWine.id,
          cantidad:  COPA_OZ,
        },
      })
      console.log(`    → ingrediente base: ${firstWine.name} (${COPA_OZ} oz)`)
    }
  }

  console.log('\n✅ Estructura lista. En la reunión del miércoles:')
  console.log('   1. Desde "Productos" → asignar grupo a cada vino que se sirva por copa.')
  console.log('   2. Desde "Tragos" → poner precio de venta a cada copa.')
  console.log('   3. Marcar el trago como visible en catálogo para que aparezca en la carta.\n')
}

main()
  .catch((e) => { console.error('❌', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
