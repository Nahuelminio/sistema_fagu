import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const cats = await prisma.category.findMany({ select: { id: true, name: true } })
  console.log('Categorías existentes:')
  cats.forEach((c) => console.log(`  - ${c.name}`))
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
