import { describe, expect, it } from 'vitest';
import { opportunityPublicationDisabledReason } from './opportunity-publication';

const ready = { accountId: '84259783', stock: 4, listingStatus: 'DRAFT', editorialStatus: 'APPROVED' };

describe('opportunity publication readiness', () => {
  it('enables a reviewed in-stock product with a connected account', () => {
    expect(opportunityPublicationDisabledReason(ready)).toBeNull();
  });

  it.each([
    [{ ...ready, accountId: '' }, 'Conectá una cuenta'],
    [{ ...ready, listingStatus: 'ACTIVE' }, 'ya tiene una publicación'],
    [{ ...ready, stock: 0 }, 'no tiene stock'],
    [{ ...ready, editorialStatus: 'READY' }, 'aprobá el contenido'],
  ])('explains why publishing is disabled', (input, message) => {
    expect(opportunityPublicationDisabledReason(input)).toContain(message);
  });
});
