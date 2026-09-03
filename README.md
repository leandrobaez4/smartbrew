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
