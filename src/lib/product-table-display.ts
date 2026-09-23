export function paginationPages(page: number, totalPages: number): number[] {
  return [...new Set([1, totalPages, page - 1, page, page + 1])]
    .filter(value => value >= 1 && value <= totalPages).sort((a, b) => a - b);
}

const creationDate = new Intl.DateTimeFormat('es-AR', {
  timeZone: 'America/Argentina/Buenos_Aires', day: '2-digit', month: '2-digit', year: 'numeric',
});
export function formatProductCreation(value: Date | string): string {
  return creationDate.format(new Date(value));
}

export type ProductInstagramState = 'published' | 'review' | 'processing' | 'reconciliation' | 'failed' | 'none';

export function productInstagramState(product: {
  isPublished: boolean;
  instagramBlocked: boolean;
  queueStatus?: string | null;
  queueNeedsReview?: boolean;
}): ProductInstagramState {
  if (product.isPublished) return 'published';
  if (product.queueNeedsReview) return 'review';
  if (product.queueStatus === 'STARTED') return 'processing';
  if (product.instagramBlocked) return 'reconciliation';
  if (product.queueStatus === 'FAILED') return 'failed';
  return 'none';
}
