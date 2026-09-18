import ProductLoading from './ProductLoading';

export default function ProductsLayout({ children }: { children: React.ReactNode }) {
  return <ProductLoading>{children}</ProductLoading>;
}
