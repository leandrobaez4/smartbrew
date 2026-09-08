'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Play, MessageSquare, MessageCircle, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { simulateInstagramCommentAction, simulateInstagramDmAction } from './actions';

export default function QueueTester() {
  const router = useRouter();
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ text: string; isError?: boolean } | null>(null);

  const handleSimulateComment = async () => {
    setLoadingAction('comment');
    setStatusMessage(null);
    try {
      const res = await simulateInstagramCommentAction();
      if (res.success) {
        setStatusMessage({ text: res.message });
        setTimeout(() => router.refresh(), 2500); // Refresca después del delay de la cola
      } else {
        setStatusMessage({ text: `Error: ${res.message}`, isError: true });
      }
    } catch (err: any) {
      setStatusMessage({ text: `Error: ${err.message}`, isError: true });
    }
    setLoadingAction(null);
  };

  const handleSimulateDm = async () => {
    setLoadingAction('dm');
    setStatusMessage(null);
    try {
      const res = await simulateInstagramDmAction();
      if (res.success) {
        setStatusMessage({ text: res.message });
        setTimeout(() => router.refresh(), 2500); // Refresca después del delay de la cola
      } else {
        setStatusMessage({ text: `Error: ${res.message}`, isError: true });
      }
    } catch (err: any) {
      setStatusMessage({ text: `Error: ${err.message}`, isError: true });
    }
    setLoadingAction(null);
  };

  return (
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-900 dark:to-indigo-950/40 p-5 rounded-xl border border-blue-100 dark:border-blue-900/30 mb-6 shadow-sm">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Play size={16} className="text-blue-600 dark:text-blue-400" />
            Simulador de Pruebas de la Cola (Comment-to-DM)
          </h3>
          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 max-w-xl">
            Permite probar el circuito completo (disparo, encolado en QStash/DB, retardo de 2s y envío del link de afiliado) de forma inmediata desde el panel autenticado.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleSimulateComment}
            disabled={loadingAction !== null}
            className="inline-flex items-center gap-2 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-100 border border-gray-300 dark:border-gray-700 text-xs font-semibold px-3.5 py-2 rounded-lg transition-colors shadow-sm disabled:opacity-50"
          >
            {loadingAction === 'comment' ? (
              <Loader2 size={14} className="animate-spin text-blue-600" />
            ) : (
              <MessageCircle size={14} className="text-pink-600" />
            )}
            Simular Comentario ("Quiero")
          </button>

          <button
            onClick={handleSimulateDm}
            disabled={loadingAction !== null}
            className="inline-flex items-center gap-2 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-100 border border-gray-300 dark:border-gray-700 text-xs font-semibold px-3.5 py-2 rounded-lg transition-colors shadow-sm disabled:opacity-50"
          >
            {loadingAction === 'dm' ? (
              <Loader2 size={14} className="animate-spin text-indigo-600" />
            ) : (
              <MessageSquare size={14} className="text-indigo-600" />
            )}
            Simular Mensaje Directo (DM)
          </button>
        </div>
      </div>

      {statusMessage && (
        <div className={`mt-3 p-3 rounded-lg text-xs font-medium flex items-center gap-2 ${
          statusMessage.isError 
            ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' 
            : 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
        }`}>
          {statusMessage.isError ? <AlertCircle size={14} /> : <CheckCircle2 size={14} />}
          <span>{statusMessage.text}</span>
        </div>
      )}
    </div>
  );
}
