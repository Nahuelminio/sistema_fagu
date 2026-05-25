/**
 * Configurar el admin para entrega al cliente:
 *  - Cambia email y password del admin
 *  - Borra usuarios de prueba
 */

import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

const ADMIN_EMAIL    = 'fagudrinkbar@gmail.com'
const ADMIN_NAME     = 'FAGU Drink Bar'
const ADMIN_PASSWORD = 'Faddygusty2026'

async function main() {
  console.log('\n⚙️  Configurando admin para entrega...\n')

  const hashed = await bcrypt.hash(ADMIN_PASSWORD, 10)

  // 1) Actualizar admin (id=1) con nuevo email + password
  const admin = await prisma.user.update({
    where: { id: 1 },
    data: {
      email:    ADMIN_EMAIL,
      name:     ADMIN_NAME,
      password: hashed,
      role:     'ADMIN',
    },
  })
  console.log(`✅ Admin actualizado: ${admin.email}`)

  // 2) Borrar usuarios de prueba (cualquiera que NO sea el admin)
  const deleted = await prisma.user.deleteMany({
    where: { id: { not: admin.id } },
  })
  console.log(`✅ Usuarios de prueba borrados: ${deleted.count}`)

  // 3) Listar usuarios finales
  const users = await prisma.user.findMany({ select: { id: true, email: true, name: true, role: true } })
  console.log('\n👥 Usuarios finales:')
  users.forEach((u) => console.log(`   ${u.id}. ${u.email} (${u.name}) — ${u.role}`))
  console.log('\n🎉 Listo.\n')
}

main()
  .catch((e) => { console.error('❌ Error:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
