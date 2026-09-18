'use client';

import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

type Router = ReturnType<typeof useRouter>;
const LoadingContext = createContext<{ router: Router; setBusy: (id: string, busy: boolean) => void } | null>(null);

export function useProductLoading(busy: boolean) {
  const context = useContext(LoadingContext);
  const fallbackRouter = useRouter();
  const id = useId();
  const setBusy = context?.setBusy;
  useEffect(() => {
    setBusy?.(id, busy);
    return () => setBusy?.(id, false);
  }, [id, busy, setBusy]);
  return context?.router || fallbackRouter;
}

function LoadingOverlay({ active }: { active: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (active && !element.open) element.showModal();
    if (!active && element.open) element.close();
    return () => { if (element.open) element.close(); };
  }, [active]);
  // Native modal puts every other control (including the preview) inert and restores focus.
  return <dialog ref={dialog} aria-label="Cargando" aria-busy={active}
    onCancel={event => event.preventDefault()}
    className="m-auto rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm dark:border-gray-800 dark:bg-gray-900 dark:text-gray-100">
    <div role="status" aria-live="polite" className="flex max-w-sm flex-col items-center gap-4">
      <Loader2 aria-hidden="true" className="h-10 w-10 animate-spin text-blue-600" />
      <p className="text-lg font-semibold">Cargando…</p>
      <p className="text-sm text-gray-500 dark:text-gray-400">Estamos procesando tu solicitud. Esperá un momento.</p>
    </div>
  </dialog>;
}

export default function ProductLoading({ children }: { children: React.ReactNode }) {
  const baseRouter = useRouter();
  const [pending, startTransition] = useTransition();
  const [tasks, setTasks] = useState<Set<string>>(() => new Set());
  const setBusy = useCallback((id: string, busy: boolean) => {
    setTasks(previous => {
      if (previous.has(id) === busy) return previous;
      const next = new Set(previous);
      if (busy) next.add(id); else next.delete(id);
      return next;
    });
  }, []);
  const router = useMemo(() => ({
    ...baseRouter,
    refresh: () => startTransition(() => baseRouter.refresh()),
    push: (...args: Parameters<Router['push']>) => startTransition(() => baseRouter.push(...args)),
    replace: (...args: Parameters<Router['replace']>) => startTransition(() => baseRouter.replace(...args)),
    back: () => startTransition(() => baseRouter.back()),
  }), [baseRouter]);
  const active = pending || tasks.size > 0;
  return <LoadingContext.Provider value={{ router, setBusy }}>
    <div aria-busy={active} onClickCapture={event => {
      if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      const link = (event.target as Element).closest('a');
      if (!link || link.target || link.hasAttribute('download')) return;
      const url = new URL(link.href, window.location.href);
      if (url.origin !== window.location.origin || !/^\/admin\/products(?:\/|$)/.test(url.pathname)) return;
      event.preventDefault();
      if (!active) router.push(url.pathname + url.search + url.hash);
    }} onSubmitCapture={event => {
      const form = event.target as HTMLFormElement;
      if (form.getAttribute('method')?.toLowerCase() !== 'get') return;
      const url = new URL(form.action || window.location.href);
      if (url.origin !== window.location.origin || url.pathname !== '/admin/products') return;
      event.preventDefault();
      if (active) return;
      url.search = '';
      for (const [key, value] of new FormData(form)) if (typeof value === 'string') url.searchParams.append(key, value);
      router.push(url.pathname + url.search);
    }}>{children}</div>
    <LoadingOverlay active={active} />
  </LoadingContext.Provider>;
}
