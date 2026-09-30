import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
vi.mock('@/lib/supplier-product-pricing', async () => await import('../../../../../lib/supplier-product-pricing'));
import SupplierPricingCalculatorForm, { type PricingValues } from './SupplierPricingCalculatorForm';

vi.stubGlobal('React', React);

const initial: PricingValues = {
  supplierPriceUsd: 0,
  supplierPriceArs: 10_000,
  supplierCurrency: 'ARS',
  exchangeRateArsPerUsd: 0,
  vatTreatment: 'INCLUDED',
  vatPercentage: 21,
  internalTaxAmountUsd: 0,
  internalTaxAmountArs: 0,
  supplierPvpUsd: 0,
  supplierPvpArs: 0,
  supplierMarkupPercentage: 0,
  productSearchCostArs: 0,
  shippingCostArs: 0,
  marketplaceFeePercentage: 13,
  marketplaceFixedFeeArs: 0,
  marketplaceCategoryId: '',
  marketplaceListingTypeId: 'gold_special',
  targetMarginPercentage: 20,
};

describe('SupplierPricingCalculatorForm', () => {
  it('renders the opportunity submit button with its blocking loading dialog', () => {
    const html = renderToStaticMarkup(<SupplierPricingCalculatorForm
      action={() => {}}
      initial={initial}
      supplierLabel="Unidrop"
      submitLabel="Guardar en oportunidades"
    />);

    expect(html).toContain('Guardar en oportunidades');
    expect(html).toContain('aria-label="Guardando oportunidad"');
    expect(html).toContain('Guardando oportunidad…');
    expect(html).toContain('Estamos procesando el producto y sus cálculos');
  });
});
