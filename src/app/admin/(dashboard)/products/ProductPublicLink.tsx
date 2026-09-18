'use client';
import { useState } from 'react';
import { Copy, ExternalLink } from 'lucide-react';
import { productUrl } from '@/lib/product-url';

export default function ProductPublicLink({ productId, available }: { productId: string; available: boolean }) {
  const [message, setMessage] = useState('');
  const url = productUrl(productId);
  return <section className="my-4 rounded-xl border border-gray-200 p-4 dark:border-gray-700">
    <h3 className="text-sm font-semibold">URL pública para Instagram y anuncios</h3>
    <input aria-label="URL pública del producto" readOnly value={url} className="my-2 w-full rounded border p-2 text-xs dark:bg-gray-950" />
    {available ? <div className="flex flex-wrap gap-3 text-sm">
      <button type="button" className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-white" onClick={async () => {
        try { await navigator.clipboard.writeText(url); setMessage('URL copiada.'); }
        catch { setMessage('No se pudo copiar. Seleccioná y copiá la URL del campo.'); }
      }}><Copy size={15} /> Copiar URL</button>
      <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2"><ExternalLink size={15} /> Ver ficha pública</a>
    </div> : <p className="text-sm text-amber-600">La ficha estará disponible cuando el producto esté activo y tenga un enlace válido de Mercado Libre.</p>}
    <p role="status" className="mt-2 text-xs">{message}</p>
  </section>;
}
