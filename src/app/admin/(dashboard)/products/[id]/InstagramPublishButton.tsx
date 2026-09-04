'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Camera, Trash2, Loader2, RefreshCw } from 'lucide-react';
import { publishToInstagramAction, unpublishFromInstagramAction, verifyInstagramPublicationAction } from '../actions';

export default function InstagramPublishButton({ productId, isPublished }: { productId: string, isPublished: boolean }) {
  const router = useRouter();
  const [isProcessing, setIsProcessing] = useState(false);

  const handlePublish = async () => {
    if (!confirm('¿Seguro que querés publicar este producto en Instagram?')) return;
    
    setIsProcessing(true);
    const result = await publishToInstagramAction([productId]);
    if (result && !result.success) {
      alert(`Error al publicar: ${result.message}`);
    } else {
      alert('✅ ¡Producto publicado con éxito en Instagram!');
    }
    setIsProcessing(false);
    router.refresh();
  };

  const handleUnpublish = async () => {
    if (!confirm('¿Seguro que querés despublicar este producto de Instagram? (Solo lo remueve de nuestro sistema)')) return;
    
    setIsProcessing(true);
    const result = await unpublishFromInstagramAction([productId]);
    if (result && !result.success) {
      alert(`Error al despublicar: ${result.message}`);
    } else {
      alert('🗑️ Producto desvinculado de Instagram correctamente.');
    }
    setIsProcessing(false);
    router.refresh();
  };

  const handleVerify = async () => {
    setIsProcessing(true);
    const result = await verifyInstagramPublicationAction(productId);
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
          <div className="flex items-center gap-3">
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
              <Trash2 size={16} /> Desvincular
            </button>
          </div>
        ) : (
          <button
            onClick={handlePublish}
            disabled={isProcessing}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-pink-500 to-orange-400 rounded-md hover:opacity-90 disabled:opacity-50 shadow-sm transition-opacity"
          >
            <Camera size={18} /> Publicar ahora en Instagram
          </button>
        )}
      </div>

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
    </>
  );
}
