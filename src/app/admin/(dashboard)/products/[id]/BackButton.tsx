'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

export default function BackButton() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get('from');

  const handleBack = () => {
    if (from) {
      router.push(from);
    } else if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      router.push('/admin/products');
    }
  };

  return (
    <button
      type="button"
      onClick={handleBack}
      className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 mb-4 px-3 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors border border-transparent hover:border-gray-200 dark:hover:border-gray-700"
    >
      <ArrowLeft size={16} />
      <span>Volver al listado</span>
    </button>
  );
}
