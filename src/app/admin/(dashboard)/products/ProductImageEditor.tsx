'use client';

import { useRef, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { mergeProductImages } from '../../../../lib/product-gallery';
import { removeProductImageAction } from './image-actions';
import { useProductLoading } from './ProductLoading';

export default function ProductImageEditor({ productId, title, primaryImageUrl, imageUrls }: {
  productId: string; title: string; primaryImageUrl: string | null; imageUrls: string[];
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const inFlight = useRef(false);
  const router = useProductLoading(busy);
  const images = mergeProductImages(primaryImageUrl ? [primaryImageUrl] : [], imageUrls);

  async function remove(image: string) {
    if (inFlight.current || !window.confirm('¿Eliminar esta imagen de SmartBrew? Si es la principal, la siguiente será la portada. No cambia publicaciones existentes en Instagram.')) return;
    inFlight.current = true;
    setBusy(true);
    setMessage('');
    try {
      const result = await removeProductImageAction(productId, image);
      setMessage(result.message);
      if (result.success) router.refresh();
    } catch {
      setMessage('No se pudo confirmar la eliminación. Actualizá la página antes de reintentar.');
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  return <section className="space-y-3" aria-label="Galería del producto">
    <h3 className="text-sm font-semibold">Imágenes ({images.length})</h3>
    <p className="text-xs text-gray-500 dark:text-gray-400">Los cambios aplican a SmartBrew y futuras publicaciones, no a las ya publicadas en Instagram.</p>
    {images.length ? <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      {images.map((image, index) => <div key={image} className="rounded-xl border border-gray-200 dark:border-gray-700 p-2 space-y-2">
        <a href={image} target="_blank" rel="noopener noreferrer"><img src={image} alt={`${title} · foto ${index + 1}`} loading="lazy" className="h-24 w-full rounded-lg object-contain" /></a>
        <p className="text-xs text-gray-500">{index === 0 ? 'Principal' : `Foto ${index + 1}`}</p>
        <button type="button" disabled={busy} onClick={() => remove(image)} aria-label={`Eliminar foto ${index + 1}`} className="inline-flex items-center justify-center gap-1 w-full rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 px-2 py-2 text-xs font-medium text-red-700 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-950 disabled:opacity-50"><Trash2 size={14} />Eliminar</button>
      </div>)}
    </div> : <p className="text-sm text-amber-700 dark:text-amber-400">Sin imágenes. Necesitás una imagen para publicar en Instagram.</p>}
    {message && <p role="status" className="text-sm">{message}</p>}
  </section>;
}
