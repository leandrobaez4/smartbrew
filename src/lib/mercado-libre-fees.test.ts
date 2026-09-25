import { describe, expect, it } from 'vitest';
import { parseMercadoLibreFeeQuote } from './mercado-libre-fees';

describe('Mercado Libre fee quote', () => {
  it('reads percentage, fixed fee and total fee for the requested listing type', () => {
    expect(parseMercadoLibreFeeQuote([{
      listing_type_id: 'gold_special',
      sale_fee_amount: 887.7,
      sale_fee_details: { fixed_fee: 200, meli_percentage_fee: 13, percentage_fee: 13 },
    }], 'gold_special')).toEqual({ percentage: 13, fixedFeeArs: 200, saleFeeAmountArs: 887.7 });
  });

  it('rejects incomplete provider responses', () => {
    expect(() => parseMercadoLibreFeeQuote({ listing_type_id: 'gold_special' }, 'gold_special')).toThrow(/inválida/);
  });
});
