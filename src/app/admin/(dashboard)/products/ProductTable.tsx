'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ProductStatus } from '@prisma/client';
import { Camera, Trash2, CheckCircle2, Loader2, Eye, ExternalLink } from 'lucide-react';
import { publishToInstagramAction, unpublishFromInstagramAction } from './actions';
import ProductPreviewModal from './ProductPreviewModal';

export type ProductData = {
  id: string;
  title: string;
  externalId: string | null;
  marketplace: string;
  status: ProductStatus;
  price: number | null;
  currencyId: string | null;
  primaryImageUrl: string | null;
  originalPermalink: string;
  affiliateUrl: string | null;
  createdAt: Date;
  isPublished: boolean;
};

export default function ProductTable({ products, total, page, totalPages, search, statusFilter }: { 
  products: ProductData[], 
  total: number, 
  page: number, 
  totalPages: number,
  search: string,
  statusFilter: string
}) {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isProcessing, setIsProcessing] = useState(false);
  const [previewProduct, setPreviewProduct] = useState<ProductData | null>(null);

  // Armamos la URL actual con todos los filtros para poder volver exactamente a este estado
  const currentParams = new URLSearchParams();
  if (page > 1) currentParams.set('page', page.toString());
  if (search) currentParams.set('search', search);
  if (statusFilter && statusFilter !== 'ALL') currentParams.set('status', statusFilter);
  const currentQueryString = currentParams.toString();
  const backUrl = `/admin/products${currentQueryString ? `?${currentQueryString}` : ''}`;

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const toggleAll = () => {
    if (selectedIds.size === products.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(products.map(p => p.id)));
    }
  };

  const handlePublish = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`¿Publicar ${selectedIds.size} productos seleccionados en Instagram?`)) return;
    
    setIsProcessing(true);
    const result = await publishToInstagramAction(Array.from(selectedIds));
    if (result && !result.success) {
      alert(`Error al publicar: ${result.message}`);
    } else {
      alert(`✅ ¡${selectedIds.size} producto(s) publicado(s) con éxito en Instagram!`);
      setSelectedIds(new Set());
    }
    setIsProcessing(false);
    router.refresh();
  };

  const handleUnpublish = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`¿Despublicar ${selectedIds.size} productos seleccionados de Instagram?`)) return;
    
    setIsProcessing(true);
    await unpublishFromInstagramAction(Array.from(selectedIds));
    setSelectedIds(new Set());
    setIsProcessing(false);
    router.refresh();
  };

  return (
    <div className="relative">
      <div className="bg-white dark:bg-gray-900 shadow rounded-lg overflow-hidden border border-gray-200 dark:border-gray-800 mb-20">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
            <thead className="bg-gray-50 dark:bg-gray-950/50">
              <tr>
                <th className="px-6 py-3 text-left">
                  <input 
                    type="checkbox" 
                    checked={selectedIds.size > 0 && selectedIds.size === products.length}
                    onChange={toggleAll}
                    className="rounded border-gray-300 dark:border-gray-700"
                  />
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Producto</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Estado</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Instagram</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-800">
              {products.map(product => (
                <tr key={product.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                  <td className="px-6 py-4">
                    <input 
                      type="checkbox" 
                      checked={selectedIds.has(product.id)}
                      onChange={() => toggleSelect(product.id)}
                      className="rounded border-gray-300 dark:border-gray-700"
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div 
                      className="flex items-center cursor-pointer group"
                      onClick={() => setPreviewProduct(product)}
                      title="Click para ver vista previa y disponibilidad"
                    >
                      {product.primaryImageUrl && (
                        <img src={product.primaryImageUrl} alt="" className="h-10 w-10 rounded-lg mr-3 object-cover border border-gray-200 dark:border-gray-700 group-hover:opacity-80 transition-opacity" />
                      )}
                      <div>
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate max-w-xs group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors" title={product.title}>
                          {product.title}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">{product.externalId} ({product.marketplace})</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      product.status === 'ACTIVE' ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400' :
                      product.status === 'CANDIDATE' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400' :
                      product.status === 'ARCHIVED' ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400' : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-300'
                    }`}>
                      {product.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {product.isPublished ? (
                      <span className="inline-flex items-center gap-1 text-sm font-medium text-pink-600 dark:text-pink-400">
                        <Camera size={16} /> Publicado
                      </span>
                    ) : (
                      <span className="text-sm text-gray-400 dark:text-gray-500">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setPreviewProduct(product)}
                        className="inline-flex items-center gap-1 text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                        title="Vista previa y disponibilidad"
                      >
                        <Eye size={16} />
                        <span>Previa</span>
                      </button>
                      <a 
                        href={product.originalPermalink} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 transition-colors"
                        title="Verificar directamente en Mercado Libre"
                      >
                        <ExternalLink size={15} />
                        <span>ML</span>
                      </a>
                      <Link 
                        href={`/admin/products/${product.id}?from=${encodeURIComponent(backUrl)}`} 
                        className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300"
                      >
                        Editar
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
              {products.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-sm text-gray-500 dark:text-gray-400">No se encontraron productos.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex justify-between items-center mt-6">
        <div className="text-sm text-gray-600 dark:text-gray-400 font-medium">
          Mostrando {products.length} de {total} productos
        </div>
        <div className="flex gap-2">
          {page > 1 && (
            <Link href={`?page=${page - 1}&search=${search}&status=${statusFilter}`} className="px-4 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
              Anterior
            </Link>
          )}
          {page < totalPages && (
            <Link href={`?page=${page + 1}&search=${search}&status=${statusFilter}`} className="px-4 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
              Siguiente
            </Link>
          )}
        </div>
      </div>

      {/* Sticky Action Bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-0 left-64 right-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 p-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] flex justify-between items-center z-10 transition-transform">
          <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {selectedIds.size} productos seleccionados
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleUnpublish}
              disabled={isProcessing}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
            >
              <Trash2 size={16} /> Despublicar
            </button>
            <button
              onClick={handlePublish}
              disabled={isProcessing}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-pink-500 to-orange-400 rounded-md hover:opacity-90 disabled:opacity-50 shadow-md"
            >
              <Camera size={16} /> Publicar en Instagram
            </button>
          </div>
        </div>
      )}

      {/* Loading Overlay */}
      {isProcessing && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm transition-opacity">
          <div className="bg-white dark:bg-gray-900 p-8 rounded-2xl shadow-2xl flex flex-col items-center gap-4 border border-gray-200 dark:border-gray-800 max-w-sm text-center">
            <Loader2 className="w-12 h-12 animate-spin text-pink-600 dark:text-pink-500" />
            <div>
              <p className="text-gray-900 dark:text-gray-100 font-semibold text-lg">Procesando...</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Conectando con Instagram, por favor no cierres esta ventana.</p>
            </div>
          </div>
        </div>
      )}

      {/* Product Preview & Availability Modal */}
      <ProductPreviewModal 
        product={previewProduct} 
        fromUrl={backUrl}
        onClose={() => setPreviewProduct(null)} 
      />
    </div>
  );
}
