# Demo Walkthrough

1. Run `docker compose up --build`. This will start PostgreSQL, Redis, the Next.js app, and the Worker.
2. In another terminal, seed the DB: `npm run db:seed`.
3. Open `http://localhost:4193/admin/login` and login with `admin@example.com` / `change-me`.
4. Go to **Products**, select an existing product or import one.
5. In the product detail view, add an affiliate link (e.g. `https://mercadolibre.com.ar/...`), check the confirmation box, and save.
6. Go to **Drafts**, click on a draft and click "Approve and Publish".
7. Because `INSTAGRAM_DRIVER=fake` and `OPENAI_DRIVER=fake` are set, the system will simulate video rendering and publishing.
8. Go to `http://localhost:4193/productos` to see the public landing page displaying your approved active products!
