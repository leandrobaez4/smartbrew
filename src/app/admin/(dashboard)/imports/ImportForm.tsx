'use client';

import { useActionState, useEffect } from 'react';
import { uploadHtmlAction } from './actions';
import { UploadCloud } from 'lucide-react';

export function ImportForm() {
  const [state, formAction, isPending] = useActionState(uploadHtmlAction, { error: null } as any);

  useEffect(() => {
    if (state?.success) {
      // Clear form or show success message briefly
      const fileInput = document.getElementById('htmlFile') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
    }
  }, [state]);

  return (
    <div className="bg-white dark:bg-gray-900 mb-8">
      {state?.error && (
        <div className="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 p-3 rounded mb-4">
          {state.error}
        </div>
      )}
      
      {state?.success && (
        <div className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 p-3 rounded mb-4">
          ¡Archivo subido exitosamente! El procesamiento comenzó.
        </div>
      )}

      <form action={formAction} className="flex flex-col gap-4">
        <div className="flex-1">
          <input
            type="file"
            name="htmlFile"
            id="htmlFile"
            accept=".html,.htm"
            required
            className="block w-full text-sm text-gray-500 dark:text-gray-400
              file:mr-4 file:py-2 file:px-4
              file:rounded-md file:border-0
              file:text-sm file:font-semibold
              file:bg-blue-50 dark:file:bg-blue-900/30 file:text-blue-700 dark:file:text-blue-400
              hover:file:bg-blue-100 dark:hover:file:bg-blue-900/50 border border-gray-300 dark:border-gray-700 rounded-md p-1 bg-white dark:bg-gray-950"
          />
        </div>
        <button
          type="submit"
          disabled={isPending}
          className="flex justify-center items-center space-x-2 bg-blue-600 dark:bg-blue-700 text-white px-6 py-2 rounded-md hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-50 transition-colors w-full"
        >
          <UploadCloud size={20} />
          <span>{isPending ? 'Subiendo...' : 'Importar Archivo'}</span>
        </button>
      </form>
    </div>
  );
}
