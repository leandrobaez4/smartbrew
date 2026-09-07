'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  X, 
  ExternalLink, 
  Camera, 
  Trash2, 
  Loader2, 
  AlertCircle, 
  Copy,
  Check,
  Edit
} from 'lucide-react';
import { ProductStatus } from '@prisma/client';
import { ProductData } from './ProductTable';
import { 
  publishToInstagramAction, 
  unpublishFromInstagramAction, 
  updateProductStatusAction 
} from './actions';

interface ProductPreviewModalProps {
  product: ProductData | null;
  onClose: () => void;
}

export default function ProductPreviewModal({ product, onClose }: ProductPreviewModalProps) {
  const router = useRouter();
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStatus, setCurrentStatus] = useState<ProductStatus | null>(product?.status || null);
  const [isPublished, setIsPublished] = useState<boolean>(product?.isPublished || false);
  const [copied, setCopied] = useState(false);

  if (!product) return null;

  const handleStatusChange = async (newStatus: ProductStatus) => {
    setIsProcessing(true);
    const res = await updateProductStatusAction(product.id, newStatus);
    if (res.success) {
      setCurrentStatus(newStatus);
      router.refresh();
    } else {
      alert(`Error al actualizar estado: ${res.message}`);
    }
    setIsProcessing(false);
  };

  const handlePublish = async () => {
    if (!product.affiliateUrl) {
      alert('⚠️ Este producto no tiene Link de Afiliado configurado. Configuralo antes de publicar.');
      return;
    }
    if (!confirm(`¿Publicar "${product.title}" en Instagram?`)) return;

    setIsProcessing(true);
    const res = await publishToInstagramAction([product.id]);
    if (res.success) {
      setIsPublished(true);
      alert('✅ ¡Producto publicado con éxito en Instagram!');
      router.refresh();
    } else {
      alert(`Error al publicar: ${res.message}`);
    }
    setIsProcessing(false);
  };

  const handleUnpublish = async () => {
    const confirmMsg = confirm(
      `¿Despublicar "${product.title}" de Instagram?\n\nSi el producto se quedó sin stock en Mercado Libre, también se marcará como PAUSADO para evitar enviar a compradores a un link roto.`
    );
    if (!confirmMsg) return;

    setIsProcessing(true);
    const res = await unpublishFromInstagramAction([product.id]);
    if (res.success) {
      await updateProductStatusAction(product.id, 'PAUSED');
      setIsPublished(false);
      setCurrentStatus('PAUSED');
      alert('🗑️ ¡Producto despublicado de Instagram y marcado como PAUSADO correctamente!');
      router.refresh();
    } else {
      alert(`Error al despublicar: ${res.message}`);
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

  const activeStatus = currentStatus || product.status;

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

          {/* Acciones de Estado y Despublicación */}
          <div className="space-y-4 pt-2 border-t border-gray-100 dark:border-gray-800">
            {/* Control de Instagram */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-pink-50/50 dark:bg-pink-950/20 border border-pink-100 dark:border-pink-900/30">
              <div>
                <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
                  <Camera size={16} className="text-pink-600" />
                  Estado en Instagram
                </h4>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {isPublished 
                    ? 'Este producto figura como PUBLICADO en tu cuenta de Instagram.' 
                    : 'Aún no fue publicado en Instagram.'}
                </p>
              </div>

              {isPublished ? (
                <button
                  onClick={handleUnpublish}
                  disabled={isProcessing}
                  className="inline-flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white font-medium px-4 py-2 rounded-xl text-xs transition-colors shadow-sm disabled:opacity-50 whitespace-nowrap"
                >
                  {isProcessing ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  Despublicar y Pausar
                </button>
              ) : (
                <button
                  onClick={handlePublish}
                  disabled={isProcessing || !product.affiliateUrl}
                  className="inline-flex items-center justify-center gap-2 bg-pink-600 hover:bg-pink-700 text-white font-medium px-4 py-2 rounded-xl text-xs transition-colors shadow-sm disabled:opacity-50 whitespace-nowrap"
                >
                  {isProcessing ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
                  Publicar en Instagram
                </button>
              )}
            </div>

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
            href={`/admin/products/${product.id}`}
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
