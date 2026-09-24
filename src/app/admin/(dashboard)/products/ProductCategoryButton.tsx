'use client';

import { useRef, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { useProductLoading } from './ProductLoading';
import { recalculateProductCategory } from './category-actions';
import { getProductCategory } from '../../../../lib/product-categories';

export default function ProductCategoryButton({ productId, category }: { productId: string; category?: string | null }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const pending = useRef(false);
  const router = useProductLoading(busy);
  async function calculate() {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setMessage('');
    try {
      const result = await recalculateProductCategory(productId);
      setMessage(result.message);
      router.refresh();
    } catch {
      setMessage('No se pudo confirmar el resultado. Actualizá la página antes de reintentar.');
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return <section className="rounded-xl border border-purple-200 dark:border-purple-900 bg-purple-50 dark:bg-purple-950/30 p-4 space-y-2">
    <h3 className="text-sm font-semibold">Categoría: {category ? getProductCategory(category)?.name || category : 'Sin categoría'}</h3>
    <p className="text-xs text-gray-600 dark:text-gray-400">Recalcula y guarda solo la categoría con IA. No modifica el contenido editorial.</p>
    <button type="button" disabled={busy} onClick={calculate} className="inline-flex items-center gap-2 rounded-lg bg-purple-700 px-3 py-2 text-sm font-medium text-white hover:bg-purple-800 disabled:opacity-50">
      <Sparkles size={16} />{busy ? 'Calculando categoría…' : 'Calcular categoría con IA'}
    </button>
    {message && <p role="status" className="text-sm">{message}</p>}
  </section>;
}
