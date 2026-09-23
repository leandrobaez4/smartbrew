import { execFileSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';

const BASELINE = '20260923173000_baseline';
const prisma = new PrismaClient();

function runPrisma(args) {
  execFileSync('npx', ['prisma', ...args], { stdio: 'inherit' });
}

async function readMigrationState() {
  const [table] = await prisma.$queryRaw`
    SELECT to_regclass('public."_prisma_migrations"') IS NOT NULL AS "exists"
  `;
  if (!table.exists) return { tableExists: false, applied: false, count: 0 };

  const [state] = await prisma.$queryRaw`
    SELECT
      COUNT(*)::int AS "count",
      BOOL_OR("migration_name" = ${BASELINE} AND "finished_at" IS NOT NULL AND "rolled_back_at" IS NULL) AS "applied"
    FROM "_prisma_migrations"
  `;
  return { tableExists: true, applied: state.applied === true, count: state.count };
}

try {
  const state = await readMigrationState();
  if (!state.applied) {
    if (state.tableExists && state.count > 0) {
      throw new Error('La base tiene un historial de Prisma incompatible; no se aplicó el baseline automáticamente.');
    }
    console.log(`Registrando baseline existente: ${BASELINE}`);
    runPrisma(['migrate', 'resolve', '--applied', BASELINE]);
  }

  runPrisma(['migrate', 'deploy']);
} finally {
  await prisma.$disconnect();
}
