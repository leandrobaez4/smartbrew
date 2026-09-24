'use client';
import { useProductLoading } from './ProductLoading';

import { useState } from 'react';
import { runPublicationAction } from '@/lib/publication-client';
import Link from 'next/link';
import { 
  X, 
  ExternalLink, 
  Camera, 
  AlertCircle, 
  Copy,
  Check,
  Edit
} from 'lucide-react';
import { ProductStatus } from '@prisma/client';
import type { ProductData } from './ProductTable';
import InstagramPublishButton from './[id]/InstagramPublishButton';
import InstagramReconciliation from './[id]/InstagramReconciliation';
import FacebookInstagramVerification from './[id]/FacebookInstagramVerification';
import CheckAvailabilityButton from './[id]/CheckAvailabilityButton';
import AffiliateConfiguration from './AffiliateConfiguration';
import ProductPublicLink from './ProductPublicLink';
import ProductAdForm from './ProductAdForm';
import ProductCategoryButton from './ProductCategoryButton';
import ProductImageEditor from './ProductImageEditor';
import { safeAffiliateUrl } from '@/lib/product-url';
import { 
  updateProductStatusAction 
} from './actions';

interface ProductPreviewModalProps {
  product: ProductData | null;
  fromUrl?: string;
  onClose: () => void;
}

export default function ProductPreviewModal({ product, fromUrl, onClose }: ProductPreviewModalProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const router = useProductLoading(isProcessing);
  const [copied, setCopied] = useState(false);

  if (!product) return null;

  const isPublished = product.isPublished;

  const handleStatusChange = async (newStatus: ProductStatus) => {
    setIsProcessing(true);
    const res = await runPublicationAction(() => updateProductStatusAction(product.id, newStatus));
    if (res.success) {
      router.refresh();
    } else {
      alert(`Error al actualizar estado: ${res.message}`);
    }
    setIsProcessing(false);
  };

  const copyAffiliateUrl = () => {
    if (!product.affiliateUrl) return;
    navigator.clipboard.writeText(product.affiliateUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const statusColors: Record<ProductStatus, { bg: string, text: string, label: string }> = {
    ACTIVE: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-800 dark:text-green-400', label: 'Activo' },
    PAUSED: { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-800 dark:text-amber-400', label: 'Pausado (Sin stock)' },
    CANDIDATE: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-800 dark:text-blue-400', label: 'Candidato' },
    ARCHIVED: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-800 dark:text-red-400', label: 'Archivado' },
  };

  const activeStatus = product.status;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div 
        className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col border border-gray-200 dark:border-gray-800"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-950/50">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Vista Previa</span>
            <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${statusColors[activeStatus].bg} ${statusColors[activeStatus].text}`}>
              {statusColors[activeStatus].label}
            </span>
          </div>
          <button 
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Imagen */}
            <div className="md:col-span-1">
              <div className="relative aspect-square rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-inner">
                {product.primaryImageUrl ? (
                  <img 
                    src={product.primaryImageUrl} 
                    alt={product.title} 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">
                    Sin imagen
                  </div>
                )}
                {isPublished && (
                  <div className="absolute top-2 left-2 bg-pink-600 text-white text-[11px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 shadow">
                    <Camera size={12} /> IG Activo
                  </div>
                )}
              </div>
            </div>

            {/* Info principal */}
            <div className="md:col-span-2 flex flex-col justify-between">
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 line-clamp-2">
                  {product.title}
                </h3>
                <div className="mt-2 text-2xl font-black text-blue-600 dark:text-blue-400">
                  ${product.price ? product.price.toLocaleString('es-AR') : 'S/D'}{' '}
                  <span className="text-xs font-semibold text-gray-400">{product.currencyId || 'ARS'}</span>
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  ID Externo: <span className="font-mono text-gray-600 dark:text-gray-300">{product.externalId}</span> ({product.marketplace})
                </p>
              </div>

              {/* Botón directo para verificar disponibilidad en Mercado Libre */}
              <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
                <a
                  href={product.originalPermalink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full inline-flex items-center justify-center gap-2 bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-semibold px-4 py-2.5 rounded-xl text-sm transition-all shadow-sm hover:shadow active:scale-[0.99]"
                >
                  <ExternalLink size={16} />
                  Verificar en Mercado Libre
                </a>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 text-center mt-1.5">
                  Abre la publicación para comprobar si sigue activa o si el vendedor la pausó.
                </p>
              </div>
            </div>
          </div>

          <ProductImageEditor productId={product.id} title={product.title} primaryImageUrl={product.primaryImageUrl} imageUrls={product.imageUrls} />

          <ProductPublicLink productId={product.id} available={product.status === 'ACTIVE' && Boolean(safeAffiliateUrl(product.affiliateUrl))} />
          <ProductAdForm productId={product.id} />
          <ProductCategoryButton productId={product.id} category={product.category} />
          {/* Link de Afiliado */}
          <div className="bg-gray-50 dark:bg-gray-800/50 p-3.5 rounded-xl border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
              <span>Link de Afiliado configurado:</span>
              {product.affiliateUrl && (
                <button 
                  onClick={copyAffiliateUrl}
                  className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline"
                >
                  {copied ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
                  {copied ? '¡Copiado!' : 'Copiar'}
                </button>
              )}
            </div>
            {product.affiliateUrl ? (
              <p className="text-xs font-mono text-gray-700 dark:text-gray-200 truncate bg-white dark:bg-gray-900 px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700">
                {product.affiliateUrl}
              </p>
            ) : (
              <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                <AlertCircle size={14} /> Sin link de afiliado. No se podrá publicar en Instagram hasta configurarlo.
              </p>
            )}
          </div>

          <details className="rounded-xl border border-gray-200 dark:border-gray-700 p-4">
            <summary className="cursor-pointer text-sm font-semibold">Editar enlace de afiliado</summary>
            <AffiliateConfiguration key={product.affiliateUrl} productId={product.id} affiliateUrl={product.affiliateUrl} />
          </details>

          {/* Acciones de Estado y Despublicación */}
          <div className="space-y-4 pt-2 border-t border-gray-100 dark:border-gray-800">
            <div className="p-4 rounded-xl bg-pink-50/50 dark:bg-pink-950/20 border border-pink-100 dark:border-pink-900/30">
              <InstagramPublishButton productId={product.id} isPublished={isPublished}
                blocked={product.instagramBlocked || product.queueStatus === 'STARTED'}
                canPublish={Boolean(product.affiliateUrl && product.primaryImageUrl)} />
              {product.queueStatus === 'STARTED' && <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">{product.queueNeedsReview ? 'Intento interrumpido: verificá el resultado antes de volver a publicar.' : 'En cola / procesando. No se enviará otra publicación.'}</p>}
              {product.instagramPublications.map(pub => (
                <InstagramReconciliation key={pub.id} productId={product.id} publicationId={pub.id} mediaId={pub.mediaId} />
              ))}
            </div>
            <FacebookInstagramVerification key={product.instagramPublications.map(pub => pub.id).join(',')} productId={product.id} publications={product.instagramPublications} />
            <CheckAvailabilityButton productId={product.id} externalId={product.externalId || ''} />

            {/* Selector manual de estado del producto */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
                Cambiar Estado en SmartBrew
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {(['ACTIVE', 'PAUSED', 'CANDIDATE', 'ARCHIVED'] as ProductStatus[]).map(st => (
                  <button
                    key={st}
                    onClick={() => handleStatusChange(st)}
                    disabled={isProcessing || activeStatus === st}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all text-center ${
                      activeStatus === st 
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 ring-2 ring-blue-500/20' 
                        : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    {statusColors[st].label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3.5 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950">
          <Link
            href={`/admin/products/${product.id}${fromUrl ? `?from=${encodeURIComponent(fromUrl)}` : ''}`}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400"
          >
            <Edit size={14} />
            Editar configuración completa
          </Link>
          <button
            onClick={onClose}
            className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 px-4 py-1.5 rounded-xl text-xs font-semibold hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
