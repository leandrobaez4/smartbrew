'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Eye } from 'lucide-react';
import type { CatalogItem } from '@/lib/catalog-read-model';
import ProductPreviewModal from '../products/ProductPreviewModal';
import type { ProductData } from '../products/ProductTable';

function money(amount: number | null, currency: string | null) {
  if (amount == null) return '—';
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: currency || 'ARS' }).format(amount);
}

function CatalogThumbnail({ imageUrl, title }: { imageUrl: string | null; title: string }) {
  const [failed, setFailed] = useState(false);

  if (!imageUrl || failed) {
    return <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-sm font-bold text-gray-500 dark:bg-gray-800">{title.charAt(0).toUpperCase()}</div>;
  }

  // Product images can come from arbitrary marketplace CDNs, so the browser loads them directly.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={imageUrl} alt={title} className="h-12 w-12 shrink-0 rounded-lg border border-gray-200 object-cover dark:border-gray-700" onError={() => setFailed(true)} />;
}

export default function CatalogTable({ items, affiliateProducts, fromUrl }: {
  items: CatalogItem[];
  affiliateProducts: ProductData[];
  fromUrl: string;
}) {
  const [previewProduct, setPreviewProduct] = useState<ProductData | null>(null);
  const previewsById = new Map(affiliateProducts.map((product) => [product.id, product]));

  return <>
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
        <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500 dark:bg-gray-950"><tr>{['Producto', 'Origen', 'Identidad', 'Estado', 'Disponibilidad', 'Precio', 'Actualizado', 'Acción'].map((heading) => <th key={heading} className="px-4 py-3">{heading}</th>)}</tr></thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-800">{items.map((item) => {
          const affiliatePreview = item.sourceKind === 'AFFILIATE_MARKETPLACE' ? previewsById.get(item.productId) : undefined;
          return <tr key={item.catalogKey}>
            <td className="px-4 py-3"><div className="flex items-center gap-3"><CatalogThumbnail imageUrl={item.imageUrl} title={item.title} /><div><p className="max-w-sm font-semibold">{item.title}</p><p className="text-xs text-gray-500">{item.externalId || 'Sin ID externo'}</p></div></div></td>
            <td className="px-4 py-3">{item.sourceKind === 'AFFILIATE_MARKETPLACE' ? <span className="rounded-full bg-cyan-100 px-2 py-1 text-xs font-semibold text-cyan-800 dark:bg-cyan-950 dark:text-cyan-200">Afiliado · {item.marketplace}</span> : <span className="rounded-full bg-violet-100 px-2 py-1 text-xs font-semibold text-violet-800 dark:bg-violet-950 dark:text-violet-200">Dropshipping · {item.supplierName}</span>}</td>
            <td className="px-4 py-3 text-sm">{item.sourceKind === 'AFFILIATE_MARKETPLACE' ? <><p>Producto {item.productId}</p><p className="text-xs text-gray-500">Compra externa por enlace de afiliado</p></> : <><p>{item.supplierSlug} · {item.sku || item.externalId}</p><p className="text-xs text-gray-500">Oferta propia del proveedor</p></>}</td>
            <td className="px-4 py-3 text-sm font-semibold">{item.status}{item.sourceKind === 'SUPPLIER' && item.listingStatus ? <p className="text-xs font-normal text-gray-500">ML: {item.listingStatus}</p> : null}</td>
            <td className="px-4 py-3 text-sm">{item.sourceKind === 'AFFILIATE_MARKETPLACE' ? 'No aplica' : item.availability === 'UNKNOWN' ? 'Sin informar' : item.availability === 'AVAILABLE' ? `${item.stock} en stock` : 'Sin stock'}</td>
            <td className="px-4 py-3 text-sm"><p className="font-semibold">{money(item.price, item.currency)}</p>{item.sourceKind === 'SUPPLIER' && item.priceKind ? <p className="text-xs text-gray-500">{item.priceKind === 'PUBLISHED' ? 'Publicado en ML' : 'Calculado por SmartBrew'}</p> : null}</td>
            <td className="px-4 py-3 text-sm"><time dateTime={item.updatedAt.toISOString()}>{item.updatedAt.toLocaleString('es-AR')}</time>{item.sourceKind === 'SUPPLIER' ? <p className="text-xs text-gray-500">Sync {item.lastSyncAt.toLocaleString('es-AR')}</p> : null}</td>
            <td className="px-4 py-3">{item.sourceKind === 'AFFILIATE_MARKETPLACE' ? <div className="flex items-center gap-3">
              <button type="button" disabled={!affiliatePreview} onClick={() => affiliatePreview && setPreviewProduct(affiliatePreview)} className="inline-flex items-center gap-1 font-semibold text-blue-600 hover:underline disabled:cursor-not-allowed disabled:text-gray-400 dark:text-blue-400" title="Vista previa y disponibilidad"><Eye size={16} /> Previa</button>
              <Link href={item.href} className="text-sm font-semibold text-gray-600 hover:underline dark:text-gray-300">Editar</Link>
            </div> : <Link href={item.href} className="font-semibold text-blue-600 hover:underline dark:text-blue-400">Ver dropshipping</Link>}</td>
          </tr>;
        })}{!items.length && <tr><td colSpan={8} className="px-4 py-10 text-center text-sm text-gray-500">No hay productos para estos filtros.</td></tr>}</tbody>
      </table>
    </div>
    {previewProduct && <ProductPreviewModal key={previewProduct.id} product={previewProduct} fromUrl={fromUrl} onClose={() => setPreviewProduct(null)} />}
  </>;
}
