'use client';

import { useEffect, useRef } from 'react';
import { useFormStatus } from 'react-dom';
import { Loader2 } from 'lucide-react';

export default function GenerateEditorialForm({ action, label, supplierName }: {
  action: () => void | Promise<void>;
  label: string;
  supplierName: string;
}) {
  return <form action={action}>
    <GenerateEditorialButton label={label} supplierName={supplierName} />
  </form>;
}

function GenerateEditorialButton({ label, supplierName }: { label: string; supplierName: string }) {
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
    <button type="submit" disabled={pending} className="rounded bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50">
      {pending ? 'Generando…' : label}
    </button>
    <dialog ref={dialog} aria-label="Generando contenido con IA" aria-busy={pending}
      onCancel={(event) => event.preventDefault()}
      className="m-auto rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm dark:border-gray-800 dark:bg-gray-900 dark:text-gray-100">
      <div role="status" aria-live="polite" className="flex max-w-sm flex-col items-center gap-4">
        <Loader2 aria-hidden="true" className="h-10 w-10 animate-spin text-blue-600" />
        <p className="text-lg font-semibold">Generando contenido con IA…</p>
        <p className="text-sm text-gray-500 dark:text-gray-400">SmartBrew está preparando el título, la descripción y los datos de {supplierName}. Esperá un momento.</p>
      </div>
    </dialog>
  </>;
}
