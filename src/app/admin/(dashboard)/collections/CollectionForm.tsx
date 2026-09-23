import Link from 'next/link';

type CollectionValues = {
  slug: string;
  title: string;
  description: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  image: string | null;
  published: boolean;
};

export default function CollectionForm({
  action,
  collection,
  error,
  saved,
}: {
  action: (formData: FormData) => void | Promise<void>;
  collection?: CollectionValues;
  error?: string;
  saved?: boolean;
}) {
  const inputClass = 'mt-1 block w-full rounded-md border border-gray-300 bg-white p-2 text-gray-900 focus:border-blue-500 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100';

  return (
    <form action={action} className="space-y-6 rounded-lg border border-gray-200 bg-white p-6 shadow dark:border-gray-800 dark:bg-gray-900">
      {error ? <p className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">{error}</p> : null}
      {saved ? <p className="rounded-md bg-green-50 p-3 text-sm text-green-700 dark:bg-green-950/40 dark:text-green-300">Colección guardada.</p> : null}

      <div className="grid gap-5 md:grid-cols-2">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Título
          <input className={inputClass} name="title" defaultValue={collection?.title} maxLength={160} required />
        </label>
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Slug
          <input className={inputClass} name="slug" defaultValue={collection?.slug} maxLength={100} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" placeholder="setup-home-office" required />
        </label>
      </div>

      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
        Descripción
        <textarea className={inputClass} name="description" defaultValue={collection?.description || ''} maxLength={5000} rows={5} />
      </label>

      <div className="grid gap-5 md:grid-cols-2">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Título SEO
          <input className={inputClass} name="seoTitle" defaultValue={collection?.seoTitle || ''} maxLength={70} />
        </label>
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Descripción SEO
          <textarea className={inputClass} name="seoDescription" defaultValue={collection?.seoDescription || ''} maxLength={180} rows={3} />
        </label>
      </div>

      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
        Imagen (URL)
        <input className={inputClass} name="image" type="url" defaultValue={collection?.image || ''} maxLength={2000} placeholder="https://…" />
      </label>

      <label className="flex items-center gap-3 text-sm font-medium text-gray-700 dark:text-gray-300">
        <input name="published" type="checkbox" defaultChecked={collection?.published} className="h-4 w-4 rounded border-gray-300 text-blue-600" />
        Publicada
      </label>

      <div className="flex gap-3">
        <button type="submit" className="rounded-md bg-blue-600 px-5 py-2 font-semibold text-white transition-colors hover:bg-blue-700">Guardar</button>
        <Link href="/admin/collections" className="rounded-md border border-gray-300 px-5 py-2 font-semibold text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800">Cancelar</Link>
      </div>
    </form>
  );
}

