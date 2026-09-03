'use client';

import { useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { checkAvailability } from './actions';

export default function CheckAvailabilityButton({ productId, externalId }: { productId: string, externalId: string }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  async function handleCheck() {
    setLoading(true);
    setResult(null);
    try {
      const res = await checkAvailability(productId, externalId);
      setResult(res);
    } catch (err: any) {
      setResult({ success: false, message: err.message });
    }
    setLoading(false);
  }

  return (
    <div className="mt-4 p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Verificar en Mercado Libre</h4>
          <p className="text-xs text-gray-500 dark:text-gray-400">Consulta la API para ver si la publicación sigue activa.</p>
        </div>
        <button
          onClick={handleCheck}
          disabled={loading}
          className="flex items-center gap-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 px-3 py-1.5 rounded-md text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 transition-colors"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
          Verificar Estado
        </button>
      </div>
      
      {result && (
        <div className={`mt-3 p-2 text-sm rounded-md ${result.success ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'}`}>
          {result.message}
        </div>
      )}
    </div>
  );
}
