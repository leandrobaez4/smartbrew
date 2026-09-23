'use client';

import { useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { regenerateProductEditorial } from './actions';

export default function RegenerateEditorialButton({ productId, aiStatus, aiError }: { productId: string; aiStatus: string; aiError: string | null }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const router = useRouter();

  async function regenerate() {
    setLoading(true);
    setResult(null);
    try {
      const response = await regenerateProductEditorial(productId);
      setResult(response);
      router.refresh();
    } catch (error) {
      setResult({ success: false, message: error instanceof Error ? error.message : 'No se pudo regenerar el contenido.' });
    } finally {
      setLoading(false);
    }
  }

  return <section className="mt-4 rounded-lg border border-purple-200 bg-purple-50 p-4 dark:border-purple-900 dark:bg-purple-950/30">
    <div className="flex items-center justify-between gap-4">
      <div>
        <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Contenido editorial SmartBrew</h4>
        <p className="text-xs text-gray-600 dark:text-gray-400">Estado IA: {aiStatus}</p>
      </div>
      <button type="button" onClick={regenerate} disabled={loading} className="flex items-center gap-2 rounded-md bg-purple-700 px-3 py-2 text-sm font-medium text-white hover:bg-purple-800 disabled:opacity-50">
        {loading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
        Regenerar contenido con IA
      </button>
    </div>
    {(result || aiError) && <p className={`mt-3 text-sm ${result?.success ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
      {result?.message || aiError}
    </p>}
  </section>;
}
