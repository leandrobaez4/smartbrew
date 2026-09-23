export const PRODUCT_CATEGORIES = [
  {
    slug: 'cafe',
    name: 'Café',
    description: 'Cafeteras, accesorios y herramientas para disfrutar mejores preparaciones todos los días.',
  },
  {
    slug: 'tecnologia',
    name: 'Tecnología',
    description: 'Dispositivos y herramientas elegidos por su utilidad real en la vida cotidiana.',
  },
  {
    slug: 'gadgets',
    name: 'Gadgets',
    description: 'Accesorios inteligentes y soluciones prácticas para simplificar tu rutina.',
  },
  {
    slug: 'smart-home',
    name: 'Smart Home',
    description: 'Productos conectados para hacer tu casa más cómoda, simple y eficiente.',
  },
  {
    slug: 'home-office',
    name: 'Home Office',
    description: 'Tecnología y accesorios para trabajar mejor desde casa.',
  },
] as const;

export type ProductCategorySlug = typeof PRODUCT_CATEGORIES[number]['slug'];

export const PRODUCT_CATEGORY_SLUGS = PRODUCT_CATEGORIES.map(
  ({ slug }) => slug
) as [ProductCategorySlug, ...ProductCategorySlug[]];

export function getProductCategory(slug: string) {
  return PRODUCT_CATEGORIES.find((category) => category.slug === slug);
}
