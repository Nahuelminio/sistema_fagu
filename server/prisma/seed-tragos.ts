import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // ── Categorías ───────────────────────────────────────────────────────────
  const catBebidas = await prisma.category.upsert({
    where: { name: 'Bebidas' },
    update: {},
    create: { name: 'Bebidas' },
  })
  const catInsumos = await prisma.category.upsert({
    where: { name: 'Insumos' },
    update: {},
    create: { name: 'Insumos' },
  })

  // ── Ingredientes (upsert por nombre) ─────────────────────────────────────
  const ing = async (name: string, unit: string, catId: number) =>
    prisma.product.upsert({
      where: { name } as never,  // name no es unique en el schema, buscamos by name
      update: {},
      create: { name, unit, categoryId: catId, currentStock: 0, minStock: 0 },
    })

  // Como name no es @unique en Product, buscamos primero y creamos si no existe
  const upsertProduct = async (name: string, unit: string, catId: number) => {
    const existing = await prisma.product.findFirst({ where: { name } })
    if (existing) return existing
    return prisma.product.create({ data: { name, unit, categoryId: catId, currentStock: 0, minStock: 0 } })
  }

  const bebId = catBebidas.id
  const insId = catInsumos.id

  const GIN             = await upsertProduct('Gin',              'oz', bebId)
  const CAMPARI         = await upsertProduct('Campari',          'oz', bebId)
  const VERMUT          = await upsertProduct('Vermut Dulce',     'oz', bebId)
  const TONICA          = await upsertProduct('Agua Tónica',      'oz', bebId)
  const RON             = await upsertProduct('Ron Blanco',       'oz', bebId)
  const JUGO_LIMA       = await upsertProduct('Jugo de Lima',     'oz', insId)
  const ALMIBAR         = await upsertProduct('Almíbar',          'oz', insId)
  const MENTA           = await upsertProduct('Hojas de Menta',   'hojas', insId)
  const SODA            = await upsertProduct('Soda',             'oz', bebId)
  const FRUTILLAS       = await upsertProduct('Frutillas',        'unidades', insId)
  const TEQUILA         = await upsertProduct('Tequila',          'oz', bebId)
  const TRIPLE_SEC      = await upsertProduct('Triple Sec',       'oz', bebId)
  const CACHACA         = await upsertProduct('Cachaça',          'oz', bebId)
  const VODKA           = await upsertProduct('Vodka',            'oz', bebId)
  const LIMA            = await upsertProduct('Lima',             'unidad', insId)
  const AZUCAR          = await upsertProduct('Azúcar',           'cucharadas', insId)
  const PROSECCO        = await upsertProduct('Prosecco',         'oz', bebId)
  const APEROL          = await upsertProduct('Aperol',           'oz', bebId)
  const FERNET          = await upsertProduct('Fernet',           'oz', bebId)
  const COCA            = await upsertProduct('Coca-Cola',        'oz', bebId)
  const JUGO_NARANJA    = await upsertProduct('Jugo de Naranja',  'oz', insId)
  const GRANADINA       = await upsertProduct('Granadina',        'oz', insId)
  const GANCIA          = await upsertProduct('Gancia',           'oz', bebId)
  const SPRITE          = await upsertProduct('Sprite',           'oz', bebId)
  const JUGO_LIMON      = await upsertProduct('Jugo de Limón',    'oz', insId)

  console.log('✅ Ingredientes creados/verificados')

  // ── Recetas ───────────────────────────────────────────────────────────────
  const recetas = [
    {
      name: 'Negroni',
      ingredientes: [
        { product: GIN,    cantidad: 1 },
        { product: CAMPARI, cantidad: 1 },
        { product: VERMUT,  cantidad: 1 },
      ],
    },
    {
      name: 'Gin Tonic',
      ingredientes: [
        { product: GIN,    cantidad: 2 },
        { product: TONICA, cantidad: 5 },
      ],
    },
    {
      name: 'Mojito',
      ingredientes: [
        { product: RON,       cantidad: 2 },
        { product: JUGO_LIMA, cantidad: 1 },
        { product: ALMIBAR,   cantidad: 0.75 },
        { product: MENTA,     cantidad: 7 },
        { product: SODA,      cantidad: 2 },
      ],
    },
    {
      name: 'Mojito Frutilla',
      ingredientes: [
        { product: RON,       cantidad: 2 },
        { product: JUGO_LIMA, cantidad: 1 },
        { product: ALMIBAR,   cantidad: 0.75 },
        { product: MENTA,     cantidad: 7 },
        { product: SODA,      cantidad: 2 },
        { product: FRUTILLAS, cantidad: 7 },
      ],
    },
    {
      name: 'Daiquiri',
      ingredientes: [
        { product: RON,       cantidad: 2 },
        { product: JUGO_LIMA, cantidad: 1 },
        { product: ALMIBAR,   cantidad: 0.75 },
      ],
    },
    {
      name: 'Margarita',
      ingredientes: [
        { product: TEQUILA,   cantidad: 1.5 },
        { product: TRIPLE_SEC, cantidad: 1 },
        { product: JUGO_LIMA, cantidad: 0.75 },
      ],
    },
    {
      name: 'Caipirinha',
      ingredientes: [
        { product: CACHACA, cantidad: 2 },
        { product: LIMA,    cantidad: 1 },
        { product: AZUCAR,  cantidad: 2 },
      ],
    },
    {
      name: 'Caipiroska',
      ingredientes: [
        { product: VODKA,  cantidad: 2 },
        { product: LIMA,   cantidad: 1 },
        { product: AZUCAR, cantidad: 2 },
      ],
    },
    {
      name: 'Aperol Spritz',
      ingredientes: [
        { product: PROSECCO, cantidad: 3 },
        { product: APEROL,   cantidad: 2 },
        { product: SODA,     cantidad: 1 },
      ],
    },
    {
      name: 'Fernet + Coca',
      ingredientes: [
        { product: FERNET, cantidad: 2 },
        { product: COCA,   cantidad: 5 },
      ],
    },
    {
      name: 'Campari + Jugo de Naranja',
      ingredientes: [
        { product: CAMPARI,      cantidad: 2 },
        { product: JUGO_NARANJA, cantidad: 4 },
      ],
    },
    {
      name: 'Tequila Sunrise',
      ingredientes: [
        { product: TEQUILA,      cantidad: 2 },
        { product: JUGO_NARANJA, cantidad: 4 },
        { product: GRANADINA,    cantidad: 0.5 },
      ],
    },
    {
      name: 'Gancia + Sprite',
      ingredientes: [
        { product: GANCIA,     cantidad: 2 },
        { product: SPRITE,     cantidad: 4 },
        { product: JUGO_LIMON, cantidad: 0.25 },
      ],
    },
  ]

  for (const receta of recetas) {
    const existing = await prisma.trago.findFirst({ where: { name: receta.name } })
    if (existing) {
      console.log(`  ⏭  ${receta.name} (ya existe)`)
      continue
    }
    await prisma.trago.create({
      data: {
        name: receta.name,
        active: true,
        ingredientes: {
          create: receta.ingredientes.map((i) => ({
            productId: i.product.id,
            cantidad: i.cantidad,
          })),
        },
      },
    })
    console.log(`  🍹 ${receta.name}`)
  }

  console.log('\n✅ Seed de tragos completado')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
