import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';

const remotePrisma = new PrismaClient({
  datasources: { db: { url: "postgresql://neondb_owner:npg_jVkd3H6IbnmJ@ep-twilight-fog-aczd92ck-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require" } }
});

async function main() {
  const data = JSON.parse(fs.readFileSync('backup.json', 'utf8'));
  const { p: products, d: drafts, pu: pubs } = data;
  
  console.log(`Cargando ${products.length} productos en Neon...`);
  for (const p of products) {
    await remotePrisma.product.upsert({
      where: { marketplace_externalId: { marketplace: p.marketplace, externalId: p.externalId } },
      create: p,
      update: p,
    });
  }

  console.log(`Cargando ${drafts.length} borradores en Neon...`);
  for (const d of drafts) {
    await remotePrisma.contentDraft.upsert({
      where: { id: d.id },
      create: d,
      update: d,
    });
  }

  console.log(`Cargando ${pubs.length} publicaciones en Neon...`);
  for (const pu of pubs) {
    await remotePrisma.publication.upsert({
      where: { id: pu.id },
      create: pu,
      update: pu,
    });
  }

  console.log('Migración desde archivo de backup completada.');
}

main().catch(console.error).finally(() => remotePrisma.$disconnect());
