'use client';

import { useState } from 'react';
import type { ManualMercadoLibrePublication } from '@/lib/manual-mercado-libre-publication';

export default function ManualPublicationActions({ publication }: { publication: ManualMercadoLibrePublication }) {
  const [status, setStatus] = useState('');

  async function copy(label: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setStatus(`${label} copiado.`);
    } catch {
      setStatus(`No se pudo copiar ${label.toLowerCase()}.`);
    }
  }

  return <div className="space-y-4">
    <div className="flex flex-wrap gap-3">
      <button type="button" onClick={() => copy('Paquete completo', JSON.stringify(publication, null, 2))} className="rounded bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-500">Copiar paquete completo</button>
      <button type="button" onClick={() => copy('SELLER_SKU', publication.sellerSku)} className="rounded border border-gray-300 px-4 py-2 font-semibold dark:border-gray-700">Copiar SELLER_SKU</button>
      <a href="https://www.mercadolibre.com.ar/publicaciones/nuevo" target="_blank" rel="noreferrer" className="rounded bg-yellow-500 px-4 py-2 font-semibold text-gray-950 hover:bg-yellow-400">Abrir Mercado Libre</a>
    </div>
    {status && <p role="status" className="text-sm text-gray-600 dark:text-gray-300">{status}</p>}
  </div>;
}
