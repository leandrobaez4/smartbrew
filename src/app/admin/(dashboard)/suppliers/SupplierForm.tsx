import { SupplierIntegrationType, SupplierStatus } from '@prisma/client';
import Link from 'next/link';

type SupplierValues = {
  name: string;
  slug: string;
  type: string | null;
  website: string | null;
  apiUrl: string | null;
  integrationType: SupplierIntegrationType;
  status: SupplierStatus;
};

export default function SupplierForm({
  action,
  supplier,
  error,
  saved,
}: {
  action: (formData: FormData) => void | Promise<void>;
  supplier?: SupplierValues;
  error?: string;
  saved?: boolean;
}) {
  const inputClass = 'mt-1 block w-full rounded-md border border-gray-300 bg-white p-2 text-gray-900 focus:border-blue-500 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100';

  return (
    <form action={action} className="space-y-6 rounded-lg border border-gray-200 bg-white p-6 shadow dark:border-gray-800 dark:bg-gray-900">
      {error ? <p className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">{error}</p> : null}
      {saved ? <p className="rounded-md bg-green-50 p-3 text-sm text-green-700 dark:bg-green-950/40 dark:text-green-300">Proveedor guardado.</p> : null}

      <div className="grid gap-5 md:grid-cols-2">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Nombre
          <input className={inputClass} name="name" defaultValue={supplier?.name} maxLength={160} required />
        </label>
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Slug
          <input className={inputClass} name="slug" defaultValue={supplier?.slug} maxLength={100} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" required />
        </label>
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Tipo
          <input className={inputClass} name="type" defaultValue={supplier?.type || ''} maxLength={100} placeholder="Mayorista, fabricante…" />
        </label>
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Integración
          <select className={inputClass} name="integrationType" defaultValue={supplier?.integrationType || SupplierIntegrationType.MANUAL}>
            {Object.values(SupplierIntegrationType).map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </label>
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Sitio web
          <input className={inputClass} name="website" type="url" defaultValue={supplier?.website || ''} maxLength={2000} />
        </label>
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
          URL de API
          <input className={inputClass} name="apiUrl" type="url" defaultValue={supplier?.apiUrl || ''} maxLength={2000} />
        </label>
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Estado
          <select className={inputClass} name="status" defaultValue={supplier?.status || SupplierStatus.ACTIVE}>
            {Object.values(SupplierStatus).map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </label>
      </div>

      <fieldset className="rounded-md border border-gray-200 p-4 dark:border-gray-700">
        <legend className="px-2 font-semibold text-gray-900 dark:text-white">Credenciales cifradas</legend>
        <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
          Nunca se muestran las credenciales guardadas. Al editar, dejá un campo vacío para conservar su valor actual.
        </p>
        <div className="grid gap-5 md:grid-cols-2">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">API key<input className={inputClass} name="apiKey" type="password" autoComplete="off" maxLength={4096} /></label>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">API secret<input className={inputClass} name="apiSecret" type="password" autoComplete="off" maxLength={4096} /></label>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Usuario<input className={inputClass} name="username" type="password" autoComplete="off" maxLength={512} /></label>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Contraseña<input className={inputClass} name="password" type="password" autoComplete="new-password" maxLength={4096} /></label>
        </div>
      </fieldset>

      <div className="flex gap-3">
        <button type="submit" className="rounded-md bg-blue-600 px-5 py-2 font-semibold text-white hover:bg-blue-700">Guardar</button>
        <Link href="/admin/suppliers" className="rounded-md border border-gray-300 px-5 py-2 font-semibold text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800">Cancelar</Link>
      </div>
    </form>
  );
}
