import { getDropshippingSettings } from '@/lib/dropshipping-settings';
import { requireAdmin } from '@/lib/portal';
import { updateDropshippingSettingsAction } from './actions';

export const dynamic = 'force-dynamic';

type Props = { searchParams: Promise<{ saved?: string; error?: string }> };

const numberFields = [
  ['minimumMargin', 'Margen mínimo (%)', '0.01'],
  ['minimumProfit', 'Ganancia mínima', '0.01'],
  ['minimumStock', 'Stock mínimo', '1'],
  ['priceChangeLimit', 'Límite de cambio de precio (%)', '0.01'],
  ['supplierSyncInterval', 'Intervalo de sincronización (minutos)', '1'],
] as const;

const booleanFields = [
  ['autoPublish', 'Publicación automática'],
  ['autoUpdatePrices', 'Actualización automática de precios'],
  ['autoPauseNoStock', 'Pausar automáticamente sin stock'],
  ['autoSupplierPurchase', 'Compra automática al proveedor'],
] as const;

export default async function DropshippingSettingsPage({ searchParams }: Props) {
  await requireAdmin();
  const [settings, query] = await Promise.all([getDropshippingSettings(), searchParams]);

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Settings / Dropshipping</h1>
      <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">Defaults globales para rentabilidad, automatizaciones y sincronización.</p>
      {query.saved === '1' && <p className="mt-4 rounded-md bg-green-50 p-3 text-sm text-green-800 dark:bg-green-950 dark:text-green-200">Configuración guardada.</p>}
      {query.error && <p className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">{query.error}</p>}

      <form action={updateDropshippingSettingsAction} className="mt-6 space-y-6 rounded-lg border border-gray-200 bg-white p-6 shadow dark:border-gray-800 dark:bg-gray-900">
        <div className="grid gap-5 sm:grid-cols-2">
          {numberFields.map(([name, label, step]) => (
            <label key={name} className="text-sm font-medium text-gray-800 dark:text-gray-200">
              {label}
              <input
                name={name}
                type="number"
                step={step}
                min="0"
                defaultValue={settings[name]}
                required
                className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
              />
            </label>
          ))}
        </div>

        <fieldset className="space-y-3">
          <legend className="text-sm font-semibold text-gray-900 dark:text-white">Automatizaciones</legend>
          {booleanFields.map(([name, label]) => (
            <label key={name} className="flex items-center justify-between gap-4 rounded-md border border-gray-200 p-3 text-sm text-gray-800 dark:border-gray-700 dark:text-gray-200">
              <span>{label}</span>
              <input name={name} type="checkbox" defaultChecked={settings[name]} className="h-4 w-4" />
            </label>
          ))}
        </fieldset>

        <div className="rounded-md bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
          Los defaults son conservadores. Dry Run sigue teniendo prioridad y bloquea toda escritura externa.
        </div>
        <button type="submit" className="rounded-md bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700">Guardar configuración</button>
      </form>
    </div>
  );
}
