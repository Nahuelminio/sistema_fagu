/**
 * Cargar precios de COSTO (lo que paga el bar) desde VINOSS FAGUU.docx
 */

import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

// id de producto → costo en pesos
const COSTOS: Array<[number, number, string]> = [
  // Tintos
  [130, 3000,  'Profugo Malbec'],
  [131, 4290,  'Cordero c Piel de Lobo'],
  [132, 2700,  'Oveja Black Malbec'],
  [133, 3280,  '4 Monos Locos'],
  [134, 9240,  'Saint Felicien'],
  [135, 7340,  'Nicasia'],
  [136, 12100, 'DV Cabernet Malbec'],
  [137, 5610,  'Alamos Malbec'],
  [138, 11360, 'Milamore Red Blend'],
  [139, 24200, 'Angelica Zapata'],
  [140, 18150, 'El Enemigo'],
  [141, 23105, 'Alma Negra Tinto'],
  [142, 15960, 'Rutini Cabernet Malbec'],
  [143, 17285, 'DV Catena Malbec'],
  [144, 12795, 'Luigi Bosca Malbec'],
  [145, 4230,  'Norton Tinto Dulce'],
  [146, 5880,  'Santa Julia Tinto Dulce'],
  // Blancos
  [147, 4230,  'Norton Blanco Dulce'],
  [148, 3305,  'Profugo Chenin Dulce'],
  [149, 3590,  'Alaris Blanco Dulce'],
  [150, 8400,  'Trumpeter Chardonnay'],
  [151, 14450, 'Alamos Dulce Natural'],
  [152, 7535,  'Santa Julia Chenin Dulce'],
  [153, 15685, 'Las Perdices Riesling'],
  [154, 22330, 'Rutini Chardonnay'],
  [155, 20370, 'Alma Negra Blanco'],
  // Rosados
  [156, 3920,  'Callia Rosado Dulce'],
  [157, 5600,  'Cosecha Tardia Rosado Dulce'],
  [158, 6270,  'Sottano Rose de Malbec'],
  [159, 6230,  'Perro Callejero Rose'],
  [160, 9590,  'Salentein Rva Rose'],
  [161, 11175, 'Trumpeter Rva Rose'],
  [162, 20310, 'Luigi Bosca Rose'],
  // Espumantes
  [163, 18530, 'Chandon Delice'],
  [164, 18530, 'Chandon Aperitif'],
  [165, 17875, 'Chandon Extra Brut'],
  [166, 10000, 'Salentein Brut Nature'],
  [167, 11410, 'Salentein Blanc de Blanc'],
  [168, 6450,  'Mumm Leger Spritz'],
  // Whisky
  [169, 30800, 'Red Label'],
  [170, 43660, 'Jack Daniels Fire'],
  [171, 43660, 'Jack Daniels Apple'],
  [172, 43660, 'Jack Daniels Honey'],
  [173, 43660, 'Jack Daniels N7'],
  // Licores
  [174, 36925, 'Amarula'],
  [175, 42510, 'Amarula Coffe'],
  [176, 12040, 'Tia Maria'],
  [177, 38570, 'Sheridan'],
  [178, 37675, 'Tambo'],
  // Cervezas
  [179, 3260,  'Corona 330'],
  [180, 2660,  'Stella 330'],
  [181, 3445,  'Blue Moon 355'],
  [182, 3210,  'Heineken 330'],
  [183, 2820,  'Peroni 330'],
  [184, 3305,  'Corona 473'],
  [185, 2080,  'Imperial Golden 473'],
  [186, 1710,  'Amstel 473'],
  // Sin Alcohol
  [192, 3290,  'Cepita Naranja'],
  [193, 4425,  'Citric'],
  [190, 2880,  'Stella Sin Alcohol 330'],
  [191, 2465,  'Heineken 473 Sin Alcohol'],
]

async function main() {
  console.log('\n💰 Cargando precios de costo...\n')
  let updated = 0
  let notFound = 0
  for (const [id, costo, nombre] of COSTOS) {
    const p = await prisma.product.findUnique({ where: { id } })
    if (!p) {
      console.log(`⚠️  ID ${id} (${nombre}) no encontrado`)
      notFound++
      continue
    }
    if (p.name.toLowerCase() !== nombre.toLowerCase()) {
      console.log(`⚠️  ID ${id}: nombre en DB es "${p.name}", esperaba "${nombre}". Saltando.`)
      notFound++
      continue
    }
    await prisma.product.update({
      where: { id },
      data:  { costPrice: costo },
    })
    updated++
  }
  console.log(`\n✅ Actualizados: ${updated}`)
  if (notFound > 0) console.log(`⚠️  No coinciden: ${notFound}`)
  console.log('\n📝 Sin precio cargado (no estaban en el docx):')
  console.log('   - Negra 473, Roja 473, IPA 473, Agua Mineral varios, Coca Cola (común)')
}

main()
  .catch((e) => { console.error('❌', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
