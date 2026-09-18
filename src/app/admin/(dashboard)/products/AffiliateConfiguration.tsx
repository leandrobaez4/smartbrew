'use client';
import { useProductLoading } from './ProductLoading';
import { useState } from 'react';
import { updateAffiliateUrlAction } from './affiliate-actions';
import { runPublicationAction } from '@/lib/publication-client';

export default function AffiliateConfiguration({ productId, affiliateUrl }: { productId: string; affiliateUrl: string | null }) {
  const [pending, setPending] = useState(false);
  const router = useProductLoading(pending);
  const [message, setMessage] = useState('');
  return (
      <form action={async formData => {
          setPending(true);
          const result = await runPublicationAction(() => updateAffiliateUrlAction(productId, formData));
          setMessage(result.message || '');
          setPending(false);
          if (result.success) router.refresh();
        }} className="border-t border-gray-200 dark:border-gray-800 pt-6">
        <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Configuración de Afiliado</h2>
        
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Enlace de Afiliado</label>
          <input 
            type="url" 
            name="affiliateUrl" 
            defaultValue={affiliateUrl || ''} 
            placeholder="https://mercadolibre.com.ar/..."
            required
            className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-700 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-600" 
          />
        </div>

        <div className="mb-4 flex items-start">
          <div className="flex h-5 items-center">
            <input 
              id="confirmed" 
              name="confirmed" 
              type="checkbox" 
              required
              className="h-4 w-4 rounded border-gray-300 dark:border-gray-700 text-blue-600 focus:ring-blue-500 bg-white dark:bg-gray-950" 
            />
          </div>
          <div className="ml-3 text-sm">
            <label htmlFor="confirmed" className="font-medium text-gray-700 dark:text-gray-300">Confirmación</label>
            <p className="text-gray-500 dark:text-gray-400">Generé este enlace dentro del Programa de Afiliados. La aplicación no puede garantizar que una venta sea atribuida o comisionable; eso lo determina Mercado Libre.</p>
          </div>
        </div>

        <button 
          type="submit"
          disabled={pending} 
          className="bg-blue-600 dark:bg-blue-700 text-white px-4 py-2 rounded-md hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors font-medium"
        >
          {pending ? 'Guardando…' : 'Guardar y Activar'}
        </button>
        <p role="status" className="mt-2 text-sm">{message}</p>
      </form>
  );
}
