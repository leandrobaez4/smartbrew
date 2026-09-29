'use client';

import { useMemo, useState } from 'react';
import { calculateSupplierProductPricing } from '@/lib/supplier-product-pricing';

export type PricingValues = {
  supplierPriceUsd: number;
  supplierPriceArs: number;
  supplierCurrency: 'USD' | 'ARS';
  exchangeRateArsPerUsd: number;
  vatTreatment: 'INCLUDED' | 'EXCLUDED' | 'UNKNOWN';
  vatPercentage: number;
  internalTaxAmountUsd: number;
  internalTaxAmountArs: number;
  supplierPvpUsd: number;
  supplierPvpArs: number;
  supplierMarkupPercentage: number;
  productSearchCostArs: number;
  shippingCostArs: number;
  marketplaceFeePercentage: number;
  marketplaceFixedFeeArs: number;
  marketplaceCategoryId: string;
  marketplaceListingTypeId: 'gold_special' | 'gold_pro';
  targetMarginPercentage: number;
};

const marginOptions = [10, 15, 20, 25, 30, 40];
const inputClass = 'mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-white';
const ars = (value: number) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(value);
const usd = (value: number) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'USD' }).format(value);

export default function SupplierPricingCalculatorForm({
  action,
  initial,
  supplierLabel,
  shippingReferenceArs,
  packageDefaults,
  submitLabel = 'Guardar producto y cálculo',
}: {
  action: (formData: FormData) => void | Promise<void>;
  initial: PricingValues;
  supplierLabel: string;
  shippingReferenceArs?: number | null;
  packageDefaults?: { weightGrams?: number | null; heightCm?: number | null; widthCm?: number | null; lengthCm?: number | null };
  submitLabel?: string;
}) {
  const [values, setValues] = useState(initial);
  const updateNumber = (name: keyof PricingValues, value: string) => setValues((current) => ({ ...current, [name]: Number(value) || 0 }));
  const calculation = useMemo(() => {
    try { return calculateSupplierProductPricing(values); }
    catch { return null; }
  }, [values]);

  return <form action={action} className="space-y-6">
    <section className="rounded-lg border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
      <h2 className="text-lg font-bold">Costo de {supplierLabel}</h2>
      <p className="mt-1 text-sm text-gray-500">Estos valores llegan desde la extensión y se pueden corregir antes de guardar.</p>
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <input type="hidden" name="supplierCurrency" value={values.supplierCurrency} />
        {values.supplierCurrency === 'USD' ? <>
          <NumberField name="supplierPriceUsd" label="Precio base (USD)" value={values.supplierPriceUsd} onChange={updateNumber} />
          <NumberField name="exchangeRateArsPerUsd" label="Tipo de cambio (ARS por USD)" value={values.exchangeRateArsPerUsd} onChange={updateNumber} />
          <input type="hidden" name="supplierPriceArs" value="0" />
        </> : <>
          <NumberField name="supplierPriceArs" label="Costo base (ARS)" value={values.supplierPriceArs} onChange={updateNumber} />
          <input type="hidden" name="supplierPriceUsd" value="0" />
          <input type="hidden" name="exchangeRateArsPerUsd" value="0" />
        </>}
        <label className="text-sm font-medium">Tratamiento del IVA
          <select name="vatTreatment" value={values.vatTreatment} onChange={(event) => setValues((current) => ({ ...current, vatTreatment: event.target.value as PricingValues['vatTreatment'] }))} className={inputClass}>
            <option value="INCLUDED">Incluido en el costo</option>
            <option value="EXCLUDED">No incluido / sumar IVA</option>
            <option value="UNKNOWN">Desconocido / no estimar</option>
          </select>
        </label>
        <NumberField name="vatPercentage" label="IVA (%)" value={values.vatPercentage} onChange={updateNumber} />
        {values.supplierCurrency === 'USD'
          ? <><NumberField name="internalTaxAmountUsd" label="Impuesto interno (USD)" value={values.internalTaxAmountUsd} onChange={updateNumber} /><input type="hidden" name="internalTaxAmountArs" value="0" /></>
          : <><NumberField name="internalTaxAmountArs" label="Impuesto interno (ARS)" value={values.internalTaxAmountArs} onChange={updateNumber} /><input type="hidden" name="internalTaxAmountUsd" value="0" /></>}
      </div>
      {calculation && <dl className="mt-5 grid gap-3 rounded-md bg-gray-50 p-4 text-sm dark:bg-gray-950 md:grid-cols-2 lg:grid-cols-4">
        <Metric label="Precio en pesos" value={ars(calculation.supplierPriceArs)} />
        <Metric label="IVA aplicado USD" value={usd(calculation.vatAmountUsd)} />
        <Metric label="IVA aplicado ARS" value={ars(calculation.vatAmountArs)} />
        <Metric label="Impuesto interno aplicado" value={`${usd(calculation.internalTaxAmountUsd)} · ${ars(calculation.internalTaxAmountArs)}`} />
        <Metric label={`Costo ${supplierLabel} con impuestos`} value={values.supplierCurrency === 'USD' ? `${usd(calculation.supplierCostWithTaxesUsd)} · ${ars(calculation.supplierCostWithTaxesArs)}` : ars(calculation.supplierCostWithTaxesArs)} />
      </dl>}
    </section>

    <section className="rounded-lg border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
      <h2 className="text-lg font-bold">Referencia comercial del proveedor</h2>
      <p className="mt-1 text-sm text-gray-500">El PVP y el markup sirven para comparar. No reemplazan el precio que SmartBrew calcula desde el costo real.</p>
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <NumberField name="supplierPvpUsd" label={`PVP ${supplierLabel} (USD, opcional)`} value={values.supplierPvpUsd} onChange={updateNumber} required={false} />
        <NumberField name="supplierPvpArs" label={`PVP ${supplierLabel} (ARS, opcional)`} value={values.supplierPvpArs} onChange={updateNumber} required={false} />
        <NumberField name="supplierMarkupPercentage" label={`Markup ${supplierLabel} (%, opcional)`} value={values.supplierMarkupPercentage} onChange={updateNumber} required={false} />
      </div>
      {calculation && (calculation.supplierPvpUsd || calculation.supplierPvpArs) && <p className="mt-4 text-sm text-gray-600 dark:text-gray-300">
        Referencia: {calculation.supplierPvpUsd ? usd(calculation.supplierPvpUsd) : '—'} · {calculation.supplierPvpArs ? ars(calculation.supplierPvpArs) : '—'}
      </p>}
    </section>

    <section className="rounded-lg border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
      <h2 className="text-lg font-bold">Costos y comisión de Mercado Libre</h2>
      <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <NumberField name="productSearchCostArs" label="Búsqueda / gestión del producto (ARS)" value={values.productSearchCostArs} onChange={updateNumber} />
        <NumberField name="shippingCostArs" label="Costo a nuestro cargo si ML obliga (ARS)" value={values.shippingCostArs} onChange={updateNumber} />
        <NumberField name="marketplaceFeePercentage" label="Comisión Mercado Libre (%)" value={values.marketplaceFeePercentage} onChange={updateNumber} />
        <NumberField name="marketplaceFixedFeeArs" label="Cargo fijo Mercado Libre (ARS)" value={values.marketplaceFixedFeeArs} onChange={updateNumber} />
        <label className="text-sm font-medium">Categoría Mercado Libre
          <input name="marketplaceCategoryId" value={values.marketplaceCategoryId} onChange={(event) => setValues((current) => ({ ...current, marketplaceCategoryId: event.target.value.toUpperCase() }))} placeholder="MLA1234" className={inputClass} />
        </label>
        <label className="text-sm font-medium">Tipo de publicación
          <select name="marketplaceListingTypeId" value={values.marketplaceListingTypeId} onChange={(event) => setValues((current) => ({ ...current, marketplaceListingTypeId: event.target.value as PricingValues['marketplaceListingTypeId'] }))} className={inputClass}>
            <option value="gold_special">Sin cuotas / gold_special</option>
            <option value="gold_pro">Con cuotas / gold_pro</option>
          </select>
        </label>
      </div>
      <p className="mt-3 text-xs text-gray-500">Todas las publicaciones se despachan por Mercado Envíos (ME2), sin retiro en persona y con el envío a cargo del comprador. Mercado Libre calcula el importe; usá el costo anterior solo si la categoría o el precio obligan a subsidiarlo.</p>
      {shippingReferenceArs != null && <p className="mt-3 rounded border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">Referencia de envío Tiendanube: {ars(shippingReferenceArs)}. Es informativa y no se suma automáticamente al costo de Mercado Libre.</p>}
      {packageDefaults && <p className="mt-3 text-xs text-gray-500">Paquete precargado: {packageDefaults.weightGrams ?? '—'} g · {packageDefaults.heightCm ?? '—'} × {packageDefaults.widthCm ?? '—'} × {packageDefaults.lengthCm ?? '—'} cm.</p>}
    </section>

    <section className="rounded-lg border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
      <fieldset>
        <legend className="text-lg font-bold">Ganancia deseada</legend>
        <div className="mt-3 flex flex-wrap gap-3">
          {marginOptions.map((margin) => <label key={margin} className={`cursor-pointer rounded-md border px-4 py-3 text-sm font-semibold ${values.targetMarginPercentage === margin ? 'border-blue-600 bg-blue-50 text-blue-800 dark:bg-blue-950 dark:text-blue-200' : 'border-gray-300 dark:border-gray-700'}`}>
            <input type="radio" name="targetMarginPercentage" value={margin} checked={values.targetMarginPercentage === margin} onChange={() => setValues((current) => ({ ...current, targetMarginPercentage: margin }))} className="mr-2" />{margin}%
          </label>)}
        </div>
      </fieldset>
      {calculation ? <dl className="mt-5 grid gap-4 rounded-md bg-blue-50 p-5 dark:bg-blue-950/40 md:grid-cols-2 lg:grid-cols-4">
        <Metric label="Comisión estimada" value={ars(calculation.marketplaceFeeAmountArs)} />
        <Metric label="Costo total" value={ars(calculation.totalCostArs)} />
        <Metric label="Ganancia" value={ars(calculation.targetProfitArs)} />
        <Metric label="Margen neto" value={`${calculation.netMarginPercentage.toFixed(2)}%`} />
        <Metric label="ROI" value={`${calculation.roiPercentage.toFixed(2)}%`} />
        <Metric label="Precio final a publicar" value={ars(calculation.finalPriceArs)} strong />
      </dl> : <p className="mt-4 rounded bg-red-50 p-3 text-sm text-red-700">Revisá los valores: no se puede calcular el precio final.</p>}
    </section>

    <button type="submit" disabled={!calculation} className="rounded-md bg-emerald-600 px-5 py-3 font-semibold text-white hover:bg-emerald-500 disabled:opacity-50">{submitLabel}</button>
  </form>;
}

function NumberField({ name, label, value, onChange, required = true }: {
  name: keyof PricingValues;
  label: string;
  value: number;
  onChange: (name: keyof PricingValues, value: string) => void;
  required?: boolean;
}) {
  return <label className="text-sm font-medium">{label}<input name={name} type="number" min="0" step="0.01" value={value} onChange={(event) => onChange(name, event.target.value)} required={required} className={inputClass} /></label>;
}

function Metric({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return <div><dt className="text-xs uppercase tracking-wide text-gray-500">{label}</dt><dd className={strong ? 'mt-1 text-xl font-bold text-blue-700 dark:text-blue-300' : 'mt-1 font-semibold'}>{value}</dd></div>;
}
