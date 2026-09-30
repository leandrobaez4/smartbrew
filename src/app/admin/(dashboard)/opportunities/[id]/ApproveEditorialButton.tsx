'use client';

import { useEffect, useRef } from 'react';
import { useFormStatus } from 'react-dom';
import { Loader2 } from 'lucide-react';

export default function ApproveEditorialButton() {
  const { pending } = useFormStatus();
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (pending && !element.open) element.showModal();
    if (!pending && element.open) element.close();
    return () => { if (element.open) element.close(); };
  }, [pending]);

  return <>
    <button type="submit" disabled={pending} className="rounded bg-emerald-600 px-5 py-2 font-semibold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50">
      {pending ? 'Guardando y aprobando…' : 'Guardar y aprobar contenido'}
    </button>
    <dialog ref={dialog} aria-label="Guardando y aprobando contenido" aria-busy={pending}
      onCancel={(event) => event.preventDefault()}
      className="m-auto rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm dark:border-gray-800 dark:bg-gray-900 dark:text-gray-100">
      <div role="status" aria-live="polite" className="flex max-w-sm flex-col items-center gap-4">
        <Loader2 aria-hidden="true" className="h-10 w-10 animate-spin text-emerald-600" />
        <p className="text-lg font-semibold">Guardando y aprobando contenido…</p>
        <p className="text-sm text-gray-500 dark:text-gray-400">SmartBrew está validando el título, la descripción y los datos editoriales. Esperá un momento.</p>
      </div>
    </dialog>
  </>;
}
