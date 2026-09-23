export type SearchableProduct = {
  title: string;
  originalTitle: string | null;
  displayTitle: string | null;
  category: string | null;
  tags: string[];
};

export function filterPublicProducts<T extends SearchableProduct>(products: T[], query: string, category: string) {
  const normalizedQuery = query.trim().toLocaleLowerCase('es');
  return products.filter((product) => {
    if (category && product.category !== category) return false;
    if (!normalizedQuery) return true;
    return [product.displayTitle, product.originalTitle, product.title, product.category, ...product.tags]
      .some((value) => value?.toLocaleLowerCase('es').includes(normalizedQuery));
  });
}
