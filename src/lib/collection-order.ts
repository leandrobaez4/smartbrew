export type MoveDirection = 'up' | 'down';

export function reorderedProductIds(ids: string[], productId: string, direction: MoveDirection) {
  const currentIndex = ids.indexOf(productId);
  if (currentIndex < 0) return ids;

  const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
  if (targetIndex < 0 || targetIndex >= ids.length) return ids;

  const next = [...ids];
  [next[currentIndex], next[targetIndex]] = [next[targetIndex], next[currentIndex]];
  return next;
}

