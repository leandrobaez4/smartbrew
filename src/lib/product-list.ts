import { Prisma } from '@prisma/client';

export type ProductSort = 'createdAt' | 'title' | 'status' | 'instagram' | 'affiliate';
export type SortDirection = 'asc' | 'desc';
export function parseProductSort(sort?: string): ProductSort {
  return ['title', 'status', 'instagram', 'affiliate'].includes(sort || '') ? sort as ProductSort : 'createdAt';
}
export function parseSortDirection(direction?: string): SortDirection {
  return direction === 'asc' ? 'asc' : 'desc';
}

// Only fixed SQL fragments are used for identifiers and ordering; inputs are parameters.
export function productListQuery(search: string, status: string, sort: ProductSort, direction: SortDirection, skip: number, take: number) {
  const columns = {
    createdAt: Prisma.sql`p."createdAt"`,
    title: Prisma.sql`LOWER(p.title)`,
    status: Prisma.sql`p.status::text`,
    affiliate: Prisma.sql`(LENGTH(TRIM(COALESCE(p."affiliateUrl", ''))) > 0)`,
    instagram: Prisma.sql`EXISTS (SELECT 1 FROM "ContentDraft" d JOIN "Publication" pub ON pub."contentDraftId" = d.id WHERE d."productId" = p.id AND pub.platform = 'INSTAGRAM' AND pub.status = 'PUBLISHED' AND pub."deletedAt" IS NULL)`,
  };
  return Prisma.sql`SELECT p.id FROM "Product" p
    WHERE (${search} = '' OR p.title ILIKE ${`%${search}%`})
    AND (${status} = '' OR p.status::text = ${status})
    ORDER BY ${columns[sort]} ${direction === 'asc' ? Prisma.sql`ASC` : Prisma.sql`DESC`}, p.id ASC
    LIMIT ${take} OFFSET ${skip}`;
}
