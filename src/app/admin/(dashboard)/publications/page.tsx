import { PrismaClient } from '@prisma/client';

export const dynamic = 'force-dynamic';

const prisma = new PrismaClient();

export default async function PublicationsPage() {
  const publications = await prisma.publication.findMany({
    include: { draft: { include: { product: true } } },
    orderBy: { createdAt: 'desc' },
  });

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Publications</h1>
      
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Platform</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Error</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {publications.map(pub => (
              <tr key={pub.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {pub.draft.product.title}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {pub.platform}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-purple-100 text-purple-800`}>
                    {pub.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-red-500 max-w-xs truncate">
                  {pub.lastErrorMessage || '-'}
                </td>
              </tr>
            ))}
            {publications.length === 0 && (
              <tr>
                <td colSpan={4} className="px-6 py-4 text-center text-sm text-gray-500">No publications found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
