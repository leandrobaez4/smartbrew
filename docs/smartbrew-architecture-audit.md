# SmartBrew architecture audit

## Current stack

- Next.js 16.3.3 with the App Router and React 19.
- Prisma 6.19.3 with PostgreSQL.
- Mercado Libre product lookup through `MercadoLibreClient`.
- Manual imports through a Server Action and affiliate imports through a signed QStash Route Handler.
- A separate BullMQ discovery worker.
- OpenAI is currently used for Instagram copy, not for public product editorial content.
- Admin and portal authentication are separate; public products use `ACTIVE` as the published state.

## Compatibility decisions

- `Product.title`, `externalId`, and `originalPermalink` remain in place because public pages, admin screens, jobs, ads, Instagram publishing, and seed data depend on them. They represent the original marketplace title, marketplace-scoped ID, and source permalink respectively.
- New editorial fields are additive. Existing records are backfilled from `title` into `originalTitle` and continue to render through the legacy fallback until the editorial product page ticket lands.
- Existing `ProductStatus` values remain unchanged: `CANDIDATE` is the current draft/review state and `ACTIVE` is the current published state. Replacing the enum would break existing publication and admin workflows.
- `ProductAIStatus` is independent from publication state so an OpenAI failure cannot delete or invalidate imported marketplace data.

## Import paths

1. Manual admin import: `src/app/admin/(dashboard)/products/import/actions.ts`.
2. Affiliate extension/QStash: `src/lib/affiliate-import.ts` and `src/app/api/queue/affiliate-import/route.ts`.
3. Discovery worker: `src/worker.ts`.

All three persist the original title. Imports using the Mercado Libre API also persist the optional source description, full gallery, normalized attributes, category, currency, seller identifiers, and permalink. Description lookup is best-effort and cannot fail the product import.

## Planned extension points

- Editorial generation: add a product-specific schema/generator beside `src/lib/domain/openai-client.ts`; do not reuse the Instagram schema.
- Manual regeneration: authenticated Server Action under the product admin route.
- Public product page: consume `displayTitle` and editorial fields with fallbacks to `title`.
- Categories/collections: use the new normalized `category`, `tags`, and stable `slug` fields.
- Affiliate tracking: centralize redirects instead of changing stored marketplace URLs.

## Migration and validation

- Migration: `prisma/migrations/20260922000000_product_editorial_fields/migration.sql`.
- The migration is additive and backfills `originalTitle` without rewriting existing URLs or publication state.
- Required checks after each phase: Prisma validation/generation, unit tests, TypeScript, ESLint, and production build.
