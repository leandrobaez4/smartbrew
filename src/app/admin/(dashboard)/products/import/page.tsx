'use client';

import { useActionState } from 'react';
import { importProductAction } from './actions';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function ImportProductPage() {
  const [state, formAction, isPending] = useActionState(importProductAction, { error: null } as { error: string | null });

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center space-x-4 mb-6">
        <Link href="/admin/products" className="text-gray-500 hover:text-gray-700">
          <ArrowLeft size={24} />
        </Link>
        <h1 className="text-2xl font-bold">Importar Producto Manualmente</h1>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <p className="text-gray-600 mb-6">
          Pegá el link completo de Mercado Libre de un producto que quieras agregar a tu lista de candidatos, o directamente el ID del artículo (ej: MLA12345678).
        </p>

        {state?.error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
            {state.error}
          </div>
        )}

        <form action={formAction} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Link de Mercado Libre o ID (MLA)
            </label>
            <input
              type="text"
              name="mlUrl"
              placeholder="https://articulo.mercadolibre.com.ar/MLA-..."
              required
              className="w-full border border-gray-300 rounded-md px-4 py-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div className="flex justify-end pt-4">
            <button
              type="submit"
              disabled={isPending}
              className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 font-medium"
            >
              {isPending ? 'Buscando e Importando...' : 'Importar a Candidatos'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
