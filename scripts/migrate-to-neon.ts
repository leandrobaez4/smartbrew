import { PrismaClient } from '@prisma/client';

const localPrisma = new PrismaClient({
  datasources: { db: { url: "postgresql://app:app@postgres:5432/affiliate_content?schema=public" } }
});

const remotePrisma = new PrismaClient({
  datasources: { db: { url: "postgresql://neondb_owner:npg_jVkd3H6IbnmJ@ep-twilight-fog-aczd92ck-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require" } }
});

async function main() {
  console.log('Iniciando migración de Local a Neon...');
  
  const products = await localPrisma.product.findMany();
  console.log(`Se encontraron ${products.length} productos locales.`);

  let count = 0;
  for (const p of products) {
    await remotePrisma.product.upsert({
      where: { marketplace_externalId: { marketplace: p.marketplace, externalId: p.externalId } },
      create: p,
      update: p,
    });
    count++;
    if (count % 10 === 0) console.log(`Copiados: ${count}/${products.length}`);
  }

  const drafts = await localPrisma.contentDraft.findMany();
  console.log(`\nSe encontraron ${drafts.length} borradores.`);
  for (const d of drafts) {
    await remotePrisma.contentDraft.upsert({
      where: { id: d.id },
      create: d,
      update: d,
    });
  }

  const pubs = await localPrisma.publication.findMany();
  console.log(`\nSe encontraron ${pubs.length} publicaciones.`);
  for (const pu of pubs) {
    await remotePrisma.publication.upsert({
      where: { id: pu.id },
      create: pu,
      update: pu,
    });
  }

  console.log('\n¡Migración completada con éxito!');
}

main().catch(e => console.error(e)).finally(async () => {
  await localPrisma.$disconnect();
  await remotePrisma.$disconnect();
});
