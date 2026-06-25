/**
 * Prepara la estructura para venta de:
 *  - Vasos de whisky (2 oz)
 *  - Copas de licor (1.5 oz)
 *  - Medidas/shots de destilados (1.5 oz)
 *
 * Whisky y licores usan ProductGroup porque hay variantes (5 whiskys, 5 licores).
 * Los destilados singulares (Tequila, Vodka, etc.) se hacen como Trago directo,
 * y se les asigna un grupo igualmente — así mañana el cliente puede agregar
 * variantes (Vodka Absolut, Tequila Premium, etc.) sin tocar el trago.
 *
 * Los tragos arrancan SIN precio y NO visibles en catálogo. El cliente los
 * activa y les pone precio en la reunión.
 */

import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

interface Pack {
  groupName:   string  // nombre del ProductGroup
  tragoName:   string  // nombre del Trago
  description: string
  oz:          number  // tamaño del servicio
  productNames: string[] // nombres exactos de productos a incluir en el grupo
}

const PACKS: Pack[] = [
  // ── Vasos de whisky ──────────────────────────────────────────────────
  {
    groupName:   'Vasos Whisky',
    tragoName:   'Vaso de Whisky',
    description: 'Vaso 60ml de whisky',
    oz:          2,
    productNames: ['Red Label', 'Jack Daniels Fire', 'Jack Daniels Apple', 'Jack Daniels Honey', 'Jack Daniels N7'],
  },
  // ── Copas de licor ───────────────────────────────────────────────────
  {
    groupName:   'Copas Licor',
    tragoName:   'Copa de Licor',
    description: 'Copa 45ml de licor / digestivo',
    oz:          1.5,
    productNames: ['Amarula', 'Amarula Coffe', 'Tia Maria', 'Sheridan', 'Tambo'],
  },
  // ── Medidas de destilados ────────────────────────────────────────────
  // Cada uno con su propio grupo (vacío con 1 producto por ahora) para
  // permitir variantes futuras (Vodka Importado, Tequila Reposado, etc.)
  { groupName: 'Tequilas',   tragoName: 'Medida de Tequila',   description: 'Shot 45ml de tequila',  oz: 1.5, productNames: ['Tequila'] },
  { groupName: 'Vodkas',     tragoName: 'Medida de Vodka',     description: 'Shot 45ml de vodka',    oz: 1.5, productNames: ['Vodka'] },
  { groupName: 'Gines',      tragoName: 'Medida de Gin',       description: 'Medida 45ml de gin',    oz: 1.5, productNames: ['Gin', 'Gin Importado'] },
  { groupName: 'Rones',      tragoName: 'Medida de Ron',       description: 'Shot 45ml de ron',      oz: 1.5, productNames: ['Ron Blanco'] },
  { groupName: 'Cachaças',   tragoName: 'Medida de Cachaça',   description: 'Shot 45ml de cachaça',  oz: 1.5, productNames: ['Cachaça'] },
  { groupName: 'Fernets',    tragoName: 'Medida de Fernet',    description: 'Medida 45ml de fernet', oz: 1.5, productNames: ['Fernet'] },
  { groupName: 'Camparis',   tragoName: 'Medida de Campari',   description: 'Medida 45ml de Campari', oz: 1.5, productNames: ['Campari'] },
  { groupName: 'Aperoles',   tragoName: 'Medida de Aperol',    description: 'Medida 45ml de Aperol', oz: 1.5, productNames: ['Aperol'] },
  { groupName: 'Gancias',    tragoName: 'Medida de Gancia',    description: 'Medida 45ml de Gancia', oz: 1.5, productNames: ['Gancia'] },
  { groupName: 'Vermuts',    tragoName: 'Medida de Vermut',    description: 'Medida 45ml de vermut', oz: 1.5, productNames: ['Vermut Dulce'] },
]

async function main() {
  console.log('\n🥃 Preparando estructura para vasos de whisky, copas de licor y medidas...\n')

  for (const pack of PACKS) {
    // 1) Buscar el grupo correcto:
    //    - Si TODOS los productos del pack ya pertenecen al mismo grupo existente,
    //      lo reutilizamos en vez de crear uno nuevo plural vacío.
    const productsForCheck = await prisma.product.findMany({
      where:  { name: { in: pack.productNames } },
      select: { grupoId: true },
    })
    const grupoIdsExistentes = [...new Set(productsForCheck.map((p) => p.grupoId).filter(Boolean))]
    let group
    if (grupoIdsExistentes.length === 1) {
      group = await prisma.productGroup.findUnique({ where: { id: grupoIdsExistentes[0]! } })
      if (!group) {
        group = await prisma.productGroup.upsert({
          where: { name: pack.groupName }, update: {}, create: { name: pack.groupName },
        })
      }
    } else {
      group = await prisma.productGroup.upsert({
        where: { name: pack.groupName }, update: {}, create: { name: pack.groupName },
      })
    }

    // 2) Asignar productos al grupo (si todavía no tienen)
    const products = await prisma.product.findMany({
      where: { name: { in: pack.productNames } },
    })
    if (products.length === 0) {
      console.log(`⚠️  No encontré productos para ${pack.tragoName} → salto.`)
      continue
    }
    for (const p of products) {
      if (p.grupoId !== group.id) {
        // Sólo reasignar si NO tiene otro grupo (no pisar grupos manuales)
        if (!p.grupoId) {
          await prisma.product.update({ where: { id: p.id }, data: { grupoId: group.id } })
        } else if (p.grupoId !== group.id) {
          console.log(`   ↳ "${p.name}" ya estaba en otro grupo, no lo pisamos.`)
        }
      }
    }
    const productosFinales = await prisma.product.findMany({ where: { grupoId: group.id } })

    // 3) Crear el trago (si no existe)
    const existing = await prisma.trago.findUnique({ where: { name: pack.tragoName } })
    let trago = existing
    if (!trago) {
      trago = await prisma.trago.create({
        data: {
          name:             pack.tragoName,
          description:      pack.description,
          active:           true,
          visibleInCatalog: false,
        },
      })
      console.log(`✨ "${pack.tragoName}" → ${pack.oz} oz | grupo "${group.name}" (${productosFinales.length} producto${productosFinales.length === 1 ? '' : 's'})`)
    } else {
      console.log(`↻ "${pack.tragoName}" ya existía | grupo "${group.name}" (${productosFinales.length} producto${productosFinales.length === 1 ? '' : 's'})`)
    }

    // 4) Asegurar el ingrediente (apunta al primer producto del grupo)
    const ing = await prisma.tragoBotella.findFirst({ where: { tragoId: trago.id } })
    const baseProd = productosFinales[0] ?? products[0]
    if (!ing) {
      await prisma.tragoBotella.create({
        data: { tragoId: trago.id, productId: baseProd.id, cantidad: pack.oz },
      })
    }
  }

  console.log(`\n✅ Listo. ${PACKS.length} tragos preparados.`)
  console.log('\n📋 En la reunión del miércoles, el cliente debe:')
  console.log('   1. Ponerle precio de venta a cada trago de medida/copa/vaso.')
  console.log('   2. Marcar "visible en catálogo" para que aparezca en la carta pública.')
  console.log('   3. (Opcional) Agregar más botellas a los grupos si suman variantes.\n')
}

main()
  .catch((e) => { console.error('❌', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
