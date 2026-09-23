'use client';

import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { runPublicationAction } from '@/lib/publication-client';
import { resumeInstagramPublicationAction } from '../actions';
import { useProductLoading } from '../ProductLoading';

export default function InstagramPublicationRecovery({
  productId,
  publicationId,
  containerId,
  message,
}: {
  productId: string;
  publicationId: string;
  containerId: string;
  message: string | null;
}) {
  const [pending, setPending] = useState(false);
  const [resultMessage, setResultMessage] = useState('');
  const router = useProductLoading(pending);

  const retry = async () => {
    if (!confirm('¿Reintentar la publicación usando el mismo contenedor de Instagram? No se volverán a subir las imágenes ni se creará otro registro.')) return;
    setPending(true);
    const result = await runPublicationAction(() => resumeInstagramPublicationAction(productId, publicationId));
    setResultMessage(result.message || 'No se pudo completar el reintento.');
    setPending(false);
    router.refresh();
  };

  return (
    <div className="mt-4 rounded-md border border-amber-400 bg-amber-50 p-3 text-sm text-amber-950 dark:bg-amber-950/20 dark:text-amber-200">
      <p className="font-medium">Publicación pendiente en Meta</p>
      <p className="mt-1">{message || 'El contenedor necesita conciliación antes de continuar.'}</p>
      <p className="mt-1 break-all text-xs">Registro: {publicationId} · Contenedor: {containerId}</p>
      <button type="button" disabled={pending} onClick={retry} className="mt-3 flex cursor-pointer items-center gap-2 rounded border border-amber-600 px-3 py-2 disabled:cursor-not-allowed disabled:opacity-50">
        <RefreshCw size={16} className={pending ? 'animate-spin' : ''} />
        {pending ? 'Consultando a Meta…' : 'Reintentar con el mismo contenedor'}
      </button>
      {resultMessage && <p role="status" className="mt-2">{resultMessage}</p>}
    </div>
  );
}
