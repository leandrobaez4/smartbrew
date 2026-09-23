# Mercado Libre Affiliate Automation MVP

A full-stack local application to discover products from Mercado Libre Argentina, manage affiliate links, generate copy via OpenAI, render vertical video reels via Remotion, and publish them to Instagram automatically.

## Requirements
- Docker Compose
- Node.js 22 LTS

## Quick Start
1. `cp .env.example .env`
2. `docker compose up --build`
3. Run migrations and seed:
   ```bash
   npm run db:migrate
   npm run db:seed
   ```
4. Access `http://localhost:4193/admin/login` (admin@example.com / change-me)
5. Access the public landing page at `http://localhost:4193/productos`

## Documentation
- [Architecture](docs/architecture.md)
- [Mercado Libre Setup](docs/mercado-libre-setup.md)
- [Meta Setup](docs/meta-setup.md)
- [Demo Guide](docs/demo.md)

## Database migrations

Prisma Migrate is the source of truth for the database schema.

- During development, change `prisma/schema.prisma` and run `npm run db:migrate -- --name <change>`.
- Commit the generated directory under `prisma/migrations/`.
- Vercel runs `npm run vercel-build`, which generates Prisma Client and applies pending migrations with `prisma migrate deploy` before building Next.js.
- Do not use `prisma db push` against shared or production databases.

The first deployment of this migration workflow detects the pre-existing production database, records `20260923173000_baseline` as already applied, and then switches to normal `prisma migrate deploy` behavior. It refuses to overwrite a different, non-empty Prisma migration history.
