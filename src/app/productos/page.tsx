import { PrismaClient } from '@prisma/client';

export const dynamic = 'force-dynamic';

const prisma = new PrismaClient();

export default async function ProductosPage() {
  const products = await prisma.product.findMany({
    where: {
      status: 'ACTIVE',
      affiliateUrl: { not: null },
    },
    orderBy: { createdAt: 'desc' },
  });

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-900">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold text-gray-900">SmartBrew: Hallazgos y Recomendaciones</h1>
        </div>
      </header>
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.map(product => (
            <div key={product.id} className="bg-white rounded-lg shadow overflow-hidden flex flex-col">
              {product.primaryImageUrl && (
                <img src={product.primaryImageUrl} alt={product.title} className="w-full h-48 object-cover" />
              )}
              <div className="p-4 flex-1 flex flex-col">
                <h3 className="text-lg font-semibold mb-2">{product.title}</h3>
                <p className="text-xl font-bold text-green-600 mb-4">${product.price?.toString()} {product.currencyId}</p>
                <div className="mt-auto">
                  <a 
                    href={product.affiliateUrl!} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="block w-full text-center bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 font-medium"
                  >
                    Ver en Mercado Libre
                  </a>
                </div>
              </div>
            </div>
          ))}
          {products.length === 0 && (
            <p className="col-span-full text-center text-gray-500 py-12">
              Aún no hay productos recomendados.
            </p>
          )}
        </div>
      </main>
      <footer className="bg-gray-800 text-white text-center py-6 mt-12">
        <div className="max-w-3xl mx-auto px-4 text-sm text-gray-300">
          <p>Algunos enlaces son de afiliado. Podemos recibir una comisión si comprás, sin costo adicional para vos. Los precios y la disponibilidad pueden cambiar en Mercado Libre.</p>
        </div>
      </footer>
    </div>
  );
}
