export function opportunityPublicationDisabledReason(input: {
  accountId: string;
  stock: number;
  listingStatus?: string | null;
  editorialStatus?: string | null;
  snapshotExpired?: boolean;
}) {
  if (!input.accountId) return 'Conectá una cuenta de Mercado Libre para publicar.';
  if (input.listingStatus === 'ACTIVE') return 'Este producto ya tiene una publicación activa.';
  if (input.stock <= 0) return 'El producto no tiene stock disponible.';
  if (input.snapshotExpired) return 'El snapshot de Unidrop venció. Verificá nuevamente precio y stock antes de publicar.';
  if (input.editorialStatus !== 'APPROVED') return 'Revisá y aprobá el contenido antes de publicar.';
  return null;
}
