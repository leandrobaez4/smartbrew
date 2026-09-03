import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'change-me';

  const passwordHash = await argon2.hash(adminPassword);

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: { passwordHash },
    create: {
      email: adminEmail,
      passwordHash,
    },
  });

  console.log(`Admin user created: ${admin.email}`);

  // Fake Smart Home Products
  const smartHomeProducts = [
    {
      marketplace: 'MERCADO_LIBRE',
      externalId: 'SH1',
      siteId: 'MLA',
      title: 'Enchufe Inteligente Wi-Fi Compatible Con Alexa',
      categoryId: 'MLA123',
      price: 15000,
      currencyId: 'ARS',
      originalPermalink: 'https://articulo.mercadolibre.com.ar/MLA-SH1',
      primaryImageUrl: 'https://http2.mlstatic.com/D_NQ_NP_12345-MLA_01_2024-O.jpg',
      status: 'ACTIVE',
    },
    {
      marketplace: 'MERCADO_LIBRE',
      externalId: 'SH2',
      siteId: 'MLA',
      title: 'Cámara De Seguridad Interior Wi-Fi 360',
      categoryId: 'MLA123',
      price: 45000,
      currencyId: 'ARS',
      originalPermalink: 'https://articulo.mercadolibre.com.ar/MLA-SH2',
      primaryImageUrl: 'https://http2.mlstatic.com/D_NQ_NP_12345-MLA_01_2024-O.jpg',
      status: 'ACTIVE',
    },
    {
      marketplace: 'MERCADO_LIBRE',
      externalId: 'SH3',
      siteId: 'MLA',
      title: 'Foco Inteligente LED RGB Wi-Fi 9W',
      categoryId: 'MLA123',
      price: 9000,
      currencyId: 'ARS',
      originalPermalink: 'https://articulo.mercadolibre.com.ar/MLA-SH3',
      primaryImageUrl: 'https://http2.mlstatic.com/D_NQ_NP_12345-MLA_01_2024-O.jpg',
      status: 'CANDIDATE',
    },
    {
      marketplace: 'MERCADO_LIBRE',
      externalId: 'SH4',
      siteId: 'MLA',
      title: 'Cerradura Inteligente Huella Digital',
      categoryId: 'MLA123',
      price: 120000,
      currencyId: 'ARS',
      originalPermalink: 'https://articulo.mercadolibre.com.ar/MLA-SH4',
      primaryImageUrl: 'https://http2.mlstatic.com/D_NQ_NP_12345-MLA_01_2024-O.jpg',
      status: 'CANDIDATE',
    },
    {
      marketplace: 'MERCADO_LIBRE',
      externalId: 'SH5',
      siteId: 'MLA',
      title: 'Sensor De Movimiento Inalámbrico Zigbee',
      categoryId: 'MLA123',
      price: 25000,
      currencyId: 'ARS',
      originalPermalink: 'https://articulo.mercadolibre.com.ar/MLA-SH5',
      primaryImageUrl: 'https://http2.mlstatic.com/D_NQ_NP_12345-MLA_01_2024-O.jpg',
      status: 'CANDIDATE',
    },
  ];

  // Fake Coffee Products
  const coffeeProducts = [
    {
      marketplace: 'MERCADO_LIBRE',
      externalId: 'CO1',
      siteId: 'MLA',
      title: 'Cafetera Espresso Manual 15 Bares',
      categoryId: 'MLA456',
      price: 180000,
      currencyId: 'ARS',
      originalPermalink: 'https://articulo.mercadolibre.com.ar/MLA-CO1',
      primaryImageUrl: 'https://http2.mlstatic.com/D_NQ_NP_12345-MLA_01_2024-O.jpg',
      status: 'ACTIVE',
    },
    {
      marketplace: 'MERCADO_LIBRE',
      externalId: 'CO2',
      siteId: 'MLA',
      title: 'Molino De Café Eléctrico Acero Inoxidable',
      categoryId: 'MLA456',
      price: 55000,
      currencyId: 'ARS',
      originalPermalink: 'https://articulo.mercadolibre.com.ar/MLA-CO2',
      primaryImageUrl: 'https://http2.mlstatic.com/D_NQ_NP_12345-MLA_01_2024-O.jpg',
      status: 'CANDIDATE',
    },
    {
      marketplace: 'MERCADO_LIBRE',
      externalId: 'CO3',
      siteId: 'MLA',
      title: 'Balanza Digital De Precisión Para Café',
      categoryId: 'MLA456',
      price: 32000,
      currencyId: 'ARS',
      originalPermalink: 'https://articulo.mercadolibre.com.ar/MLA-CO3',
      primaryImageUrl: 'https://http2.mlstatic.com/D_NQ_NP_12345-MLA_01_2024-O.jpg',
      status: 'CANDIDATE',
    },
    {
      marketplace: 'MERCADO_LIBRE',
      externalId: 'CO4',
      siteId: 'MLA',
      title: 'Espumador De Leche Eléctrico Recargable',
      categoryId: 'MLA456',
      price: 12000,
      currencyId: 'ARS',
      originalPermalink: 'https://articulo.mercadolibre.com.ar/MLA-CO4',
      primaryImageUrl: 'https://http2.mlstatic.com/D_NQ_NP_12345-MLA_01_2024-O.jpg',
      status: 'CANDIDATE',
    },
    {
      marketplace: 'MERCADO_LIBRE',
      externalId: 'CO5',
      siteId: 'MLA',
      title: 'Prensa Francesa Vidrio Y Acero 600ml',
      categoryId: 'MLA456',
      price: 28000,
      currencyId: 'ARS',
      originalPermalink: 'https://articulo.mercadolibre.com.ar/MLA-CO5',
      primaryImageUrl: 'https://http2.mlstatic.com/D_NQ_NP_12345-MLA_01_2024-O.jpg',
      status: 'CANDIDATE',
    },
  ];

  for (const productData of [...smartHomeProducts, ...coffeeProducts]) {
    await prisma.product.upsert({
      where: {
        marketplace_externalId: {
          marketplace: productData.marketplace,
          externalId: productData.externalId,
        },
      },
      update: productData as any,
      create: productData as any,
    });
  }

  console.log('Fake products created');

  const sh1 = await prisma.product.findUnique({
    where: { marketplace_externalId: { marketplace: 'MERCADO_LIBRE', externalId: 'SH1' } },
  });

  if (sh1) {
    const existingDraft = await prisma.contentDraft.findFirst({
      where: { productId: sh1.id },
    });

    if (!existingDraft) {
      await prisma.contentDraft.create({
        data: {
          productId: sh1.id,
          hook: '¿Querés controlar tus electrodomésticos desde el celular?',
          benefitsJson: [
            'Programá horarios de encendido y apagado automáticos',
            'Compatible con Alexa y Google Assistant',
            'Fácil de instalar, no requiere hub adicional',
          ],
          disclaimer: 'Podemos recibir una comisión si comprás a través de nuestro enlace, sin costo adicional para vos.',
          caption: 'Transformá tu casa en un hogar inteligente con este enchufe Wi-Fi. Podés controlar todo desde la app o con tu voz. ¡Hacé tu vida más cómoda hoy! Encontralo en el link de nuestra bio.',
          hashtagsJson: ['#HogarInteligente', '#Domotica', '#SmartPlug'],
          cta: 'Producto en el link de la bio',
          status: 'READY',
          priceSnapshot: sh1.price,
          currencySnapshot: sh1.currencyId,
        },
      });
      console.log('Ready draft created');
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
