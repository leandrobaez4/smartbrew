'use client';
import { useProductLoading } from '../ProductLoading';

import { useState } from 'react';
import { runPublicationAction } from '@/lib/publication-client';
import { Camera, Trash2, RefreshCw } from 'lucide-react';
import { unpublishFromInstagramAction, verifyInstagramPublicationAction } from '../actions';
import { enqueueInstagramProductsAction } from '../queue-actions';

export default function InstagramPublishButton({ productId, isPublished, blocked = false, canPublish = true }: { productId: string, isPublished: boolean, blocked?: boolean, canPublish?: boolean }) {
  const [isProcessing, setIsProcessing] = useState(false);
  const router = useProductLoading(isProcessing);

  const handlePublish = async () => {
    if (isPublished || blocked || !canPublish || isProcessing) return;
    if (!confirm('¿Agregar este producto a la cola de publicación de Instagram?')) return;
    
    setIsProcessing(true);
    const result = await runPublicationAction(() => enqueueInstagramProductsAction([productId]));
    if (!result.success) {
      alert(`Error al encolar: ${result.message}`);
    } else {
      alert(result.message || 'Producto encolado. Podés cerrar la pantalla.');
    }
    setIsProcessing(false);
    router.refresh();
  };

  const handleUnpublish = async () => {
    if (!confirm('¿Eliminar la publicación de Instagram? No es un archivado temporal. SmartBrew conservará el historial y solo marcará la eliminación cuando Meta la confirme.')) return;
    
    setIsProcessing(true);
    const result = await runPublicationAction(() => unpublishFromInstagramAction([productId]));
    if (result && !result.success) {
      alert(`Error al despublicar: ${result.message}`);
    } else {
      alert('🗑️ Eliminación confirmada.');
    }
    setIsProcessing(false);
    router.refresh();
  };

  const handleVerify = async () => {
    setIsProcessing(true);
    const result = await runPublicationAction(() => verifyInstagramPublicationAction(productId));
    if (result && !result.success) {
      alert(`Error al verificar: ${result.message}`);
    } else if (result) {
      alert(result.message);
    }
    setIsProcessing(false);
    router.refresh();
  };

  return (
    <>
      <div className="mt-4 border-t border-gray-200 dark:border-gray-800 pt-4">
        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Instagram</h3>
        {isPublished ? (
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1 text-sm font-medium text-pink-600 dark:text-pink-400 bg-pink-50 dark:bg-pink-900/20 px-3 py-1.5 rounded-full">
              <Camera size={16} /> Publicado
            </span>
            <button
              onClick={handleVerify}
              disabled={isProcessing}
              className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900/40 disabled:opacity-50 transition-colors"
            >
              <RefreshCw size={16} /> Verificar en IG
            </button>
            <button
              onClick={handleUnpublish}
              disabled={isProcessing}
              className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
            >
              <Trash2 size={16} /> Eliminar en Instagram
            </button>
          </div>
        ) : (
          <button
            onClick={handlePublish}
            disabled={isProcessing || blocked || !canPublish}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-pink-500 to-orange-400 rounded-md hover:opacity-90 disabled:opacity-50 shadow-sm transition-opacity"
          >
            <Camera size={18} /> {blocked ? 'En cola / procesando' : 'Encolar publicación en Instagram'}
          </button>
        )}
        {!isPublished && !canPublish && <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">Configurá el enlace de afiliado y la imagen antes de publicar.</p>}
        {blocked && <button type="button" onClick={() => router.refresh()} className="mt-2 text-sm text-blue-600 dark:text-blue-400 hover:underline">Actualizar estado de la cola</button>}
      </div>

    </>
  );
}
