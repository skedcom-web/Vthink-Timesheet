import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL as string,
});
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Seeding database...');

  const passwordHash = await bcrypt.hash('password123', 12);

  const richard = await prisma.user.upsert({
    where: { email: 'richard@vthink.com' },
    update: {},
    create: { name: 'Richard', email: 'richard@vthink.com', passwordHash, role: 'SUPER_ADMIN', employeeId: 'EMP000', department: 'Executive' },
  });

  const john = await prisma.user.upsert({
    where: { email: 'john@vthink.com' },
    update: {},
    create: { name: 'John', email: 'john@vthink.com', passwordHash, role: 'COMPANY_ADMIN', employeeId: 'EMP001', department: 'Management' },
  });

  const sarah = await prisma.user.upsert({
    where: { email: 'sarah@vthink.com' },
    update: {},
    create: { name: 'Sarah', email: 'sarah@vthink.com', passwordHash, role: 'PROJECT_MANAGER', employeeId: 'EMP002', department: 'Engineering' },
  });

  const james = await prisma.user.upsert({
    where: { email: 'james@vthink.com' },
    update: {},
    create: { name: 'James', email: 'james@vthink.com', passwordHash, role: 'TEAM_MEMBER', employeeId: 'EMP003', department: 'Engineering' },
  });

  const jane = await prisma.user.upsert({
    where: { email: 'jane@vthink.com' },
    update: {},
    create: { name: 'Jane Smith', email: 'jane@vthink.com', passwordHash, role: 'TEAM_MEMBER', employeeId: 'EMP004', department: 'Design' },
  });

  const mike = await prisma.user.upsert({
    where: { email: 'mike@vthink.com' },
    update: {},
    create: { name: 'Mike Johnson', email: 'mike@vthink.com', passwordHash, role: 'TEAM_MEMBER', employeeId: 'EMP005', department: 'Engineering' },
  });

  console.log('✅ Users seeded (6)');

  const project1 = await prisma.project.upsert({
    where: { code: 'GT01-PRJ-001' },
    update: {},
    create: {
      code: 'GT01-PRJ-001', name: 'Mobile App Phase 1',
      description: 'Mobile application development - Phase 1',
      status: 'ACTIVE', projectManagerId: sarah.id,
      clientName: 'GlobalTech Inc',
      startDate: new Date('2026-01-01'), endDate: new Date('2026-06-30'),
    },
  });

  const project2 = await prisma.project.upsert({
    where: { code: 'GT01-PRJ-002' },
    update: {},
    create: {
      code: 'GT01-PRJ-002', name: 'Website Redesign',
      status: 'ACTIVE', projectManagerId: sarah.id,
      clientName: 'GlobalTech Inc', startDate: new Date('2026-01-15'),
    },
  });

  const project3 = await prisma.project.upsert({
    where: { code: 'GT01-PRJ-003' },
    update: {},
    create: {
      code: 'GT01-PRJ-003', name: 'Database Migration',
      status: 'ACTIVE', projectManagerId: sarah.id,
    },
  });

  console.log('✅ Projects seeded (3)');

  const task1 = await prisma.task.upsert({
    where: { id: '00000000-0000-0000-0000-000000000101' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000101',
      projectId: project1.id, name: 'Database Schema Design',
      taskType: 'DEVELOPMENT', priority: 'HIGH', status: 'ACTIVE', createdById: sarah.id, startDate: new Date('2026-02-01'),
    },
  });

  const task2 = await prisma.task.upsert({
    where: { id: '00000000-0000-0000-0000-000000000102' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000102',
      projectId: project1.id, name: 'API Development',
      taskType: 'DEVELOPMENT', priority: 'HIGH', status: 'ACTIVE', createdById: sarah.id, startDate: new Date('2026-02-15'),
    },
  });

  const task3 = await prisma.task.upsert({
    where: { id: '00000000-0000-0000-0000-000000000201' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000201',
      projectId: project2.id, name: 'Homepage Mockup',
      taskType: 'DESIGN', priority: 'MEDIUM', status: 'ACTIVE', createdById: sarah.id,
    },
  });

  await prisma.task.upsert({
    where: { id: '00000000-0000-0000-0000-000000000202' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000202',
      projectId: project2.id, name: 'CSS Cleanup',
      taskType: 'DESIGN', priority: 'LOW', status: 'ACTIVE', createdById: sarah.id,
    },
  });

  await prisma.task.upsert({
    where: { id: '00000000-0000-0000-0000-000000000301' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000301',
      projectId: project3.id, name: 'Schema Analysis',
      taskType: 'DEVELOPMENT', priority: 'HIGH', status: 'ACTIVE', createdById: sarah.id,
    },
  });

  console.log('✅ Tasks seeded (5)');

  await prisma.taskAssignment.upsert({
    where: { id: '00000000-0000-0000-0000-000000001001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000001001',
      taskId: task1.id, employeeId: james.id, assignedById: sarah.id,
      assignStartDate: new Date('2026-02-01'), assignEndDate: new Date('2026-02-28'),
      allocationPercentage: 100, roleOnTask: 'Lead Developer',
    },
  });

  await prisma.taskAssignment.upsert({
    where: { id: '00000000-0000-0000-0000-000000001002' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000001002',
      taskId: task3.id, employeeId: jane.id, assignedById: sarah.id,
      assignStartDate: new Date('2026-02-01'), assignEndDate: new Date('2026-02-28'),
      allocationPercentage: 80, roleOnTask: 'UI Designer',
    },
  });

  await prisma.taskAssignment.upsert({
    where: { id: '00000000-0000-0000-0000-000000001003' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000001003',
      taskId: task2.id, employeeId: mike.id, assignedById: sarah.id,
      assignStartDate: new Date('2026-02-15'), assignEndDate: new Date('2026-03-31'),
      allocationPercentage: 100, roleOnTask: 'Backend Developer',
    },
  });

  console.log('✅ Assignments seeded (3)');

  const weekStart1 = new Date('2026-02-02');
  const weekEnd1 = new Date('2026-02-08');

  await prisma.timesheet.upsert({
    where: { employeeId_weekStartDate: { employeeId: james.id, weekStartDate: weekStart1 } },
    update: {},
    create: {
      employeeId: james.id, weekStartDate: weekStart1, weekEndDate: weekEnd1,
      status: 'SUBMITTED', totalHours: 40, submittedAt: new Date('2026-02-09'),
      entries: {
        create: [{
          projectId: project1.id, taskId: task1.id,
          monday: 8, tuesday: 8, wednesday: 8, thursday: 8, friday: 8,
          saturday: 0, sunday: 0, totalHours: 40,
        }],
      },
    },
  });

  await prisma.timesheet.upsert({
    where: { employeeId_weekStartDate: { employeeId: jane.id, weekStartDate: weekStart1 } },
    update: {},
    create: {
      employeeId: jane.id, weekStartDate: weekStart1, weekEndDate: weekEnd1,
      status: 'SUBMITTED', totalHours: 38, submittedAt: new Date('2026-02-09'),
      entries: {
        create: [{
          projectId: project2.id, taskId: task3.id,
          monday: 8, tuesday: 8, wednesday: 6, thursday: 8, friday: 8,
          saturday: 0, sunday: 0, totalHours: 38,
        }],
      },
    },
  });

  await prisma.timesheet.upsert({
    where: { employeeId_weekStartDate: { employeeId: mike.id, weekStartDate: new Date('2026-01-26') } },
    update: {},
    create: {
      employeeId: mike.id,
      weekStartDate: new Date('2026-01-26'), weekEndDate: new Date('2026-02-01'),
      status: 'SUBMITTED', totalHours: 42, submittedAt: new Date('2026-02-02'),
      entries: {
        create: [{
          projectId: project1.id, taskId: task2.id,
          monday: 8, tuesday: 9, wednesday: 8, thursday: 9, friday: 8,
          saturday: 0, sunday: 0, totalHours: 42,
        }],
      },
    },
  });

  console.log('✅ Timesheets seeded (3)');
  console.log('\n🎉 Seeding complete!');
  console.log('\nDemo accounts (password: password123):');
  console.log('  richard@vthink.com  — Super Admin');
  console.log('  john@vthink.com     — Company Admin');
  console.log('  sarah@vthink.com    — Project Manager');
  console.log('  james@vthink.com    — Team Member');
  console.log('  jane@vthink.com     — Team Member');
  console.log('  mike@vthink.com     — Team Member\n');
}

main()
  .catch((e) => { console.error('❌ Seed failed:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
