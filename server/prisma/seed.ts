import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const password = await bcrypt.hash('admin123', 10)

  const admin = await prisma.user.upsert({
    where: { email: 'admin@bar.com' },
    update: {},
    create: { email: 'admin@bar.com', name: 'Admin', password, role: 'ADMIN' },
  })

  const bebidas = await prisma.category.upsert({
    where: { name: 'Bebidas' },
    update: {},
    create: { name: 'Bebidas' },
  })

  const snacks = await prisma.category.upsert({
    where: { name: 'Snacks' },
    update: {},
    create: { name: 'Snacks' },
  })

  await prisma.product.createMany({
    skipDuplicates: true,
    data: [
      { name: 'Cerveza Lager', categoryId: bebidas.id, unit: 'unidades', minStock: 24, currentStock: 48, costPrice: 350, salePrice: 600, visibleInCatalog: true },
      { name: 'Coca Cola 500ml', categoryId: bebidas.id, unit: 'unidades', minStock: 12, currentStock: 30, costPrice: 280, salePrice: 500, visibleInCatalog: true },
      { name: 'Agua Mineral', categoryId: bebidas.id, unit: 'unidades', minStock: 12, currentStock: 20, costPrice: 150, salePrice: 300, visibleInCatalog: true },
      { name: 'Maní', categoryId: snacks.id, unit: 'porciones', minStock: 10, currentStock: 15, costPrice: 100, salePrice: 200, visibleInCatalog: true },
    ],
  })

  console.log('Seed completado. Admin:', admin.email, '/ Contraseña: admin123')
}

main().catch(console.error).finally(() => prisma.$disconnect())
