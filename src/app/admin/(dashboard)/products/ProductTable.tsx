'use client';
import { useProductLoading } from './ProductLoading';

import { useState } from 'react';
import { runPublicationAction } from '@/lib/publication-client';
import Link from 'next/link';
import { ProductStatus } from '@prisma/client';
import { Camera, Trash2, CheckCircle2, Eye, ExternalLink } from 'lucide-react';
import { unpublishFromInstagramAction } from './actions';
import { enqueueInstagramProductsAction } from './queue-actions';
import ProductPreviewModal from './ProductPreviewModal';
import type { ProductSort, SortDirection } from '@/lib/product-list';
import { formatProductCreation, paginationPages, productInstagramState } from '@/lib/product-table-display';

export type ProductData = {
  category?: string | null;
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
  instagramPublications: { id: string; mediaId: string | null }[];
  instagramBlocked: boolean;
  imageUrls: string[];
  queueStatus?: string | null;
  queueError?: string | null;
  queueNeedsReview?: boolean;
};

export default function ProductTable({ products, total, page, totalPages, search, statusFilter, sort, direction }: {
  sort: ProductSort,
  direction: SortDirection,
  products: ProductData[], 
  total: number, 
  page: number, 
  totalPages: number,
  search: string,
  statusFilter: string
}) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isProcessing, setIsProcessing] = useState(false);
  const router = useProductLoading(isProcessing);
  const [previewProduct, setPreviewProduct] = useState<ProductData | null>(null);
  const visiblePages = paginationPages(page, totalPages);

  // Armamos la URL actual con todos los filtros para poder volver exactamente a este estado
  const currentParams = new URLSearchParams();
  if (page > 1) currentParams.set('page', page.toString());
  if (search) currentParams.set('search', search);
  if (statusFilter && statusFilter !== 'ALL') currentParams.set('status', statusFilter);
  currentParams.set('sort', sort);
  currentParams.set('direction', direction);
  const currentQueryString = currentParams.toString();
  const backUrl = `/admin/products${currentQueryString ? `?${currentQueryString}` : ''}`;
  const pageUrl = (nextPage: number) => {
    const params = new URLSearchParams(currentParams);
    params.set('page', String(nextPage));
    return `?${params}`;
  };
  const sortHeader = (column: ProductSort, label: string) => (
    <th scope="col" aria-sort={sort === column ? (direction === 'asc' ? 'ascending' : 'descending') : 'none'} className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
      <button type="button" className="inline-flex items-center gap-2 cursor-pointer hover:text-blue-600 focus-visible:outline-2 focus-visible:outline-blue-500" onClick={() => {
        const params = new URLSearchParams(currentParams);
        params.delete('page');
        params.set('sort', column);
        params.set('direction', sort === column ? (direction === 'asc' ? 'desc' : 'asc') : (column === 'createdAt' ? 'desc' : 'asc'));
        router.push(`/admin/products?${params}`);
      }}>
        {label}<span aria-hidden="true">{sort === column ? (direction === 'asc' ? '↑' : '↓') : '↕'}</span>
      </button>
    </th>
  );

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
    if (!confirm(`¿Encolar ${selectedIds.size} productos para publicar en Instagram? Se procesarán en segundo plano.`)) return;
    
    setIsProcessing(true);
    const result = await runPublicationAction(() => enqueueInstagramProductsAction(Array.from(selectedIds)));
    if (!result.success) {
      alert(`Error al publicar: ${result.message}`);
    } else {
      alert(result.message || 'Publicación confirmada.');
      setSelectedIds(new Set());
    }
    setIsProcessing(false);
    router.refresh();
  };

  const handleUnpublish = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`¿Eliminar las publicaciones de ${selectedIds.size} productos en Instagram? No es un archivado temporal. Se conservará el historial; solo se marcarán eliminadas cuando Meta lo confirme.`)) return;
    
    setIsProcessing(true);
    const result = await runPublicationAction(() => unpublishFromInstagramAction(Array.from(selectedIds)));
    if (!result.success) alert(result.message);
    else setSelectedIds(new Set());
    setIsProcessing(false);
    router.refresh();
  };

  return (
    <div className="relative">
      <div className="bg-white dark:bg-gray-900 shadow rounded-lg overflow-hidden border border-gray-200 dark:border-gray-800">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
            <thead className="bg-gray-50 dark:bg-gray-950/50">
              <tr>
                <th className="px-3 py-2 text-left">
                  <input 
                    type="checkbox" 
                    checked={selectedIds.size > 0 && selectedIds.size === products.length}
                    onChange={toggleAll}
                    className="rounded border-gray-300 dark:border-gray-700"
                  />
                </th>
                {sortHeader('title', 'Producto')}
                {sortHeader('status', 'Estado')}
                {sortHeader('instagram', 'Instagram')}
                {sortHeader('affiliate', 'Link de afiliado')}
                {sortHeader('createdAt', 'Creado')}
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-800">
              {products.map(product => {
                const instagramState = productInstagramState(product);
                return (
                <tr key={product.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                  <td className="px-3 py-2">
                    <input 
                      type="checkbox" 
                      checked={selectedIds.has(product.id)}
                      onChange={() => toggleSelect(product.id)}
                      className="rounded border-gray-300 dark:border-gray-700"
                    />
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <div 
                      className="flex items-center cursor-pointer group"
                      onClick={() => setPreviewProduct(product)}
                      title="Click para ver vista previa y disponibilidad"
                    >
                      {product.primaryImageUrl && (
                        <img src={product.primaryImageUrl} alt="" className="h-8 w-8 rounded-md mr-2 object-cover border border-gray-200 dark:border-gray-700 group-hover:opacity-80 transition-opacity" />
                      )}
                      <div>
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate max-w-xs group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors" title={product.title}>
                          {product.title}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">{product.externalId} ({product.marketplace})</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      product.status === 'ACTIVE' ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400' :
                      product.status === 'CANDIDATE' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400' :
                      product.status === 'ARCHIVED' ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400' : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-300'
                    }`}>
                      {product.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {instagramState === 'published' ? (
                      <span className="inline-flex items-center gap-1 text-sm font-medium text-pink-600 dark:text-pink-400">
                        <Camera size={16} /> Publicado
                      </span>
                    ) : instagramState === 'review' ? (
                      <span className="text-xs text-amber-600">Revisar intento interrumpido</span>
                    ) : instagramState === 'processing' ? (
                      <span className="text-xs text-blue-600">En cola / procesando</span>
                    ) : instagramState === 'reconciliation' ? (
                      <span className="text-xs text-amber-600">Pendiente de conciliación</span>
                    ) : instagramState === 'failed' ? (
                      <span className="text-xs text-red-600" title={product.queueError || undefined}>Falló · revisar registro</span>
                    ) : (
                      <span className="text-sm text-gray-400 dark:text-gray-500">-</span>
                    )}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-sm">
                    {product.affiliateUrl?.trim() ? (
                      <span className="inline-flex items-center gap-1 text-green-700 dark:text-green-400"><CheckCircle2 size={16} /> Sí</span>
                    ) : <span className="text-gray-500 dark:text-gray-400">No</span>}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                    <time dateTime={new Date(product.createdAt).toISOString()}>{formatProductCreation(product.createdAt)}</time>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-sm font-medium">
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
                );
              })}
              {products.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-sm text-gray-500 dark:text-gray-400">No se encontraron productos.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-wrap justify-between items-center gap-3 mt-4 mb-24">
        <button type="button" onClick={() => router.refresh()} className="cursor-pointer rounded border px-3 py-2 text-sm">Actualizar estado de la cola</button>
        <div className="text-sm text-gray-600 dark:text-gray-400 font-medium">
          Mostrando {products.length} de {total} productos · Página {page} de {totalPages}
        </div>
        <nav aria-label="Paginación de productos" className="flex flex-wrap items-center gap-1 text-sm">
          {page > 1 && (
            <Link href={pageUrl(page - 1)} className="px-4 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
              Anterior
            </Link>
          )}
          {visiblePages.map((number, index) => (
            <span key={number} className="inline-flex items-center gap-1">
              {index > 0 && number - visiblePages[index - 1] > 1 && <span className="px-2 text-gray-500" aria-hidden="true">…</span>}
              <Link href={pageUrl(number)} aria-label={`Página ${number}`} aria-current={number === page ? 'page' : undefined}
                className={`min-w-9 rounded-md border px-3 py-2 text-center ${number === page ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800'}`}>
                {number}
              </Link>
            </span>
          ))}
          {page < totalPages && (
            <Link href={pageUrl(page + 1)} className="px-4 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
              Siguiente
            </Link>
          )}
        </nav>
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
              <Trash2 size={16} /> Eliminar de Instagram
            </button>
            <button
              onClick={handlePublish}
              disabled={isProcessing}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-pink-500 to-orange-400 rounded-md hover:opacity-90 disabled:opacity-50 shadow-md"
            >
              <Camera size={16} /> Encolar en Instagram
            </button>
          </div>
        </div>
      )}

      {/* Product Preview & Availability Modal */}
      {previewProduct && <ProductPreviewModal
        key={previewProduct.id}
        product={products.find(product => product.id === previewProduct.id) || null}
        fromUrl={backUrl}
        onClose={() => setPreviewProduct(null)} 
      />}
    </div>
  );
}
