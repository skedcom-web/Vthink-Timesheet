import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL as string,
});
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Seeding database — Super Admin only...\n');

  // ── Super Admin ──────────────────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash('Admin@vThink2026', 12);

  const superAdmin = await prisma.user.upsert({
    where:  { email: 'admin@vthink.co.in' },
    update: {},
    create: {
      name:               'Super Admin',
      email:              'admin@vthink.co.in',
      passwordHash,
      role:               'SUPER_ADMIN',
      employeeId:         'SA001',
      department:         'Administration',
      active:             true,
      mustChangePassword: false,
    },
  });

  console.log('✅ Super Admin created');
  console.log('\n─────────────────────────────────────────');
  console.log('  Login credentials:');
  console.log('  Employee ID : SA001');
  console.log('  Email       : admin@vthink.co.in');
  console.log('  Password    : Admin@vThink2026');
  console.log('─────────────────────────────────────────\n');
  console.log('🎉 Seeding complete! Login and create all other users from the app.');
}

main()
  .catch((e) => { console.error('❌ Seed failed:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
