# Tovarka

A Ukrainian one-page homewares store with a React storefront, an Express API, PostgreSQL persistence, and a transactional Telegram notification outbox. The catalog is seeded demonstration data, not a claim about real inventory or a real merchant. Local SVG product illustrations are original project assets; replace them with your product photography when publishing a real catalog. No invented phone numbers, addresses, or social profiles are used.

## Requirements

- Node.js 22.12 or newer (validated with Node 24.19.0), npm 11.
- Docker with Compose v2, or an existing PostgreSQL 17 database.
- Telegram credentials are optional for local development; orders work without them.

## Quick start

Run from the repository root:

```bash
cp .env.example .env  # Only if .env does not already exist.
npm ci
npm run db:generate
docker compose up -d --wait postgres
npm run db:migrate
npm run db:seed
npm run dev
```

In a sandbox without a writable default npm cache, use `npm ci --cache /workspace/.npm-cache`. The root `prepare` script builds the shared package. Generation loads the root `.env` without exposing anything to Vite.

The frontend listens on port 5173 and proxies `/api` to the backend on port 3000. Run them separately with `npm run dev:frontend` and `npm run dev:backend`. The health endpoint checks an actual database query. Confirm startup with:

```bash
curl --fail http://127.0.0.1:3000/api/health
curl --fail http://127.0.0.1:5173/api/products
```

The expected health response is `{"data":{"status":"ok"}}`. The catalog contains six products in three categories, including one unavailable product. Seeding is repeatable and does not replenish stock or overwrite existing product records. Stop local PostgreSQL with `docker compose stop postgres`; its named volume retains data. Do not run `docker compose down -v` unless you intend to erase that database. Docker processes and volumes must not be assumed to survive a new cloud machine; recreate the development database with the commands above if necessary. Production data belongs on durable PostgreSQL storage with backups.

## Environment variables

All configuration lives in the **root `.env`**, or injected backend process variables, which take precedence. `.env` is ignored by Git. There are no frontend secrets or required `VITE_*` variables.

| Variable             | Purpose                                                 | Development default                                                  |
| -------------------- | ------------------------------------------------------- | -------------------------------------------------------------------- |
| `NODE_ENV`           | Runtime mode                                            | `development`                                                        |
| `DATABASE_URL`       | Backend-only PostgreSQL connection                      | `postgresql://tovarka:local-development-only@localhost:5432/tovarka` |
| `PORT`               | API listening port                                      | `3000`                                                               |
| `FRONTEND_URL`       | Exact allowed browser origin                            | `http://localhost:5173`                                              |
| `TELEGRAM_BOT_TOKEN` | Backend-only bot credential                             | Empty                                                                |
| `TELEGRAM_CHAT_ID`   | Destination private/group chat identifier               | Empty                                                                |
| `POSTGRES_PASSWORD`  | Optional Compose password override                      | `local-development-only`                                             |
| `TEST_DATABASE_URL`  | Separate integration-test database; must end in `_test` | No default                                                           |
| `CHROMIUM_PATH`      | Optional browser-test executable                        | System Chromium when available                                       |

The Compose credentials are development-only. For a custom password, set both `POSTGRES_PASSWORD` and the corresponding password in `DATABASE_URL` before the first database initialization. Changing the environment does not change a password in an existing PostgreSQL volume. For an existing database, skip the Docker step and configure `DATABASE_URL`; apply migrations and seed only to the database you intend to use.

## Database and migrations

The Prisma schema is at `apps/backend/prisma/schema.prisma`. It defines Category, Product, Order, OrderItem, and Notification. Prices use PostgreSQL decimals; order lines contain immutable product-name and price snapshots. Money displayed in the cart is calculated in integer kopecks. Orders use Prisma Decimal arithmetic and database prices, never browser totals.

Migrations are versioned SQL in `apps/backend/prisma/migrations`. The initial SQL was generated with Prisma's schema diff; subsequent SQL adds notification progress and larger order amount columns. SQL constraints additionally protect nonnegative stock/prices and positive quantities.

**Migration runner:** `npm run db:migrate` runs `apps/backend/src/utils/migrate.ts` using the PostgreSQL driver. It applies these Prisma-format SQL migrations in transactions, serializes concurrent runners with a PostgreSQL advisory lock, stores SHA-256 checksums in `_tovarka_migrations`, and rejects modifications to applied migrations. Run it repeatedly safely; never edit an applied migration. This runner deliberately uses its own ledger, not Prisma Migrate's internal tables.

The cloud network blocks native engine downloads from `binaries.prisma.sh`, and Prisma 6's experimental WASM migration adapter fails to deserialize PostgreSQL catalog `name` columns. Consequently, this project's tested migration command uses the SQL runner rather than `prisma migrate deploy`. The stable Prisma 6.19.3 client uses the JavaScript PostgreSQL adapter; generation uses the supported JS CLI configuration and does not require native engine downloads. **Do not mix the SQL runner with `prisma migrate deploy` on the same database without explicitly baselining Prisma Migrate first.** Native Prisma Migrate was not validated in this environment.

For schema changes, save the previous schema and generate a reviewed SQL diff from the backend directory:

```bash
# Save the previous schema before editing it.
cp prisma/schema.prisma /tmp/tovarka-previous.prisma
# Edit prisma/schema.prisma, then:
mkdir -p prisma/migrations/YYYYMMDDHHMM_description
npx prisma migrate diff --from-schema-datamodel /tmp/tovarka-previous.prisma \
  --to-schema-datamodel prisma/schema.prisma --script \
  > prisma/migrations/YYYYMMDDHHMM_description/migration.sql
# Review the SQL and add any necessary data migrations, then:
cd ../..
npm run db:migrate
npm run db:generate
```

Keep product changes in the seed script or authorized database operations. There is intentionally no public catalog-write endpoint or administration dashboard.

## Telegram configuration

1. Open Telegram's verified `@BotFather`, send `/newbot`, and follow its instructions. Store the issued token in `TELEGRAM_BOT_TOKEN` using secure environment settings or your ignored local `.env`. Never paste credentials into issues or source code.
2. Start a private conversation with the bot and send a message, or add the bot to the destination group and allow it to send messages. Channel notifications require suitable administrator permission.
3. Use the official Bot API's `getUpdates` method from a private backend tool to inspect `message.chat.id` (or `channel_post.chat.id`) after sending a message. If a webhook is configured, polling `getUpdates` cannot be used concurrently; inspect the webhook update in your backend instead. Do not put a token-bearing URL in screenshots, shell history, or shared logs. Group IDs may be negative; preserve the full value as a string.
4. Save that ID as `TELEGRAM_CHAT_ID`, allow backend HTTPS access to `api.telegram.org`, and restart the backend. Both variables must be present.
5. Place a development order with your own contact details. Check the Notification row in the private database for delivery status. Automated tests always mock Telegram.

Order creation commits before notification processing. The outbox is created in the same transaction as the order. With missing credentials, messages stay `PENDING` and are picked up when a configured server starts. A background worker atomically claims work, escapes customer text, splits long messages safely, and records progress after each part. Multiple workers cannot claim the same pending part simultaneously.

Statuses are `PENDING`, `PROCESSING`, `SENT`, `FAILED`, and `UNKNOWN`. Explicit Telegram rate-limit rejections are retried after five minutes, up to five attempts per part. Permission errors become `FAILED`. A timeout or 5xx can occur after acceptance, so such outcomes become `UNKNOWN` instead of being resent automatically. Stale processing leases also become `UNKNOWN`. Telegram does not provide an idempotency key, so exactly-once delivery across a process crash cannot be promised. An operator must inspect the destination chat before deliberately requeuing a failed/unknown notification through private database administration. Requeuing preserves `nextPart`; a delivered part is not intentionally repeated. No public retry endpoint exposes customer information.

Successful checkout means the database saved the order; it makes no promise that Telegram delivered a message. No card information is collected, and online payment is not implemented. Delivery charges and payment arrangements are confirmed manually.

## API

Successful responses use `{ "data": ... }`; errors use `{ "error": { "code": "...", "message": "..." } }` with Ukrainian messages. Internal database errors and stack traces are never returned.

| Method | Endpoint            | Behavior                                                   |
| ------ | ------------------- | ---------------------------------------------------------- |
| GET    | `/api/health`       | Actual database readiness; 503 when unavailable            |
| GET    | `/api/products`     | Active products with category, search, sorting, pagination |
| GET    | `/api/products/:id` | Active product by UUID, or 404                             |
| GET    | `/api/categories`   | Categories                                                 |
| POST   | `/api/orders`       | Validated transactional checkout                           |

Product query parameters: `search`, category slug `category`, `sort` (`newest`, `price-asc`, `price-desc`, `name`), `page` (1-based), and `limit` (1–48). Sorting has a stable ID tie-breaker.

Orders require a UUID `Idempotency-Key` header and the following payload:

```json
{
  "customer": {
    "customerName": "Олена Коваль",
    "phone": "+380671234567",
    "email": "",
    "deliveryMethod": "post",
    "deliveryAddress": "Київ, відділення 12",
    "comment": ""
  },
  "items": [{ "productId": "REPLACE_WITH_CATALOG_UUID", "quantity": 1 }]
}
```

Delivery methods are `post`, `courier`, and `pickup`; the first two require an address. At most 50 distinct products and 99 units per line are accepted. Duplicate product lines and client-supplied prices are rejected. An identical payload with the same key returns the original order with 200; a new order returns 201; a changed payload with an existing key returns 409. Persist the same key when retrying a network failure. The frontend stores a request digest and key, never checkout contact details, in localStorage. Cart product data is also persisted there. If browser storage is disabled, persistence across reloads is unavailable.

Orders run at serializable isolation with bounded conflict retries. Stock updates are conditional and locked in a consistent order; insufficient stock rolls back all prior line updates. The unique database key and request hash prevent duplicate orders and duplicate outbox jobs. Price changes are authoritative on the server; the receipt shows the saved total. The cart offers an explicit price/stock refresh.

Request bodies are limited to 24 KiB; order creation is limited to 12 requests per minute per client IP. CORS uses one explicit frontend origin. No customer or order-listing endpoint is public. When deploying behind a proxy, configure Express `trust proxy` for your exact trusted infrastructure before relying on per-client rate limiting; it is intentionally not enabled globally. Avoid logging request bodies and set an appropriate order-data retention policy for your store.

## Verification

Unit validation and money/transport tests:

```bash
npm test
npm run typecheck
npm run lint
```

Integration tests **erase the selected test database's application tables**. Use a dedicated database whose name ends in `_test`, never the development or production database:

```bash
docker compose exec -T postgres psql -U tovarka -d tovarka -c 'CREATE DATABASE tovarka_test;'
DATABASE_URL=postgresql://tovarka:local-development-only@localhost:5432/tovarka_test npm run db:migrate
TEST_DATABASE_URL=postgresql://tovarka:local-development-only@localhost:5432/tovarka_test npm run test:integration
```

These tests exercise real PostgreSQL transactions, catalog validation, authoritative prices, invalid requests, stock rollback, concurrent overselling, concurrent duplicate requests, rate limiting, and successful/failed/multipart Telegram delivery with mocked HTTP requests.

Browser tests require the running frontend/backend and seeded development products. They create a test order and reduce stock; run against a disposable development database. They cover filters, unavailable products, quantity controls, cart persistence, form validation, checkout success, responsive layout, local images, and keyboard dialog dismissal.

```bash
# If system Chromium is unavailable:
npx playwright install chromium
# With npm run dev already running:
npm run test:browser
```

Validation during implementation: 21 unit tests, 12 PostgreSQL integration tests, and 3 Chromium browser scenarios passed. Type checking, linting, and the production build passed. No real Telegram message was sent; actual delivery requires the two Telegram variables and permitted network access.

## Production build and deployment

```bash
npm ci
npm run db:generate
npm run build
npm run db:migrate
NODE_ENV=production npm run start -w @tovarka/backend
```

Serve `apps/frontend/dist` with a static web server and proxy `/api` to the private backend. Use HTTPS, a durable PostgreSQL database, process supervision, restricted database access, and backups. Set `FRONTEND_URL` to the actual site origin and inject the backend environment variables. Frontend and backend are separate build artifacts; the Express server does not serve the frontend. Seed only if you explicitly want demonstration products. Replace the seed catalog, product illustrations, and merchant contact/policy details before running a real store. There is no admin UI or online payment integration.

## Project map

```text
apps/frontend/
  public/images/         Original local SVG product illustrations
  src/components/        Header, cards, accessible dialog, cart, checkout, UI states
  src/sections/          Hero, catalog, benefits, ordering steps, contact, footer
  src/hooks/             Dedicated persistent cart provider
  src/services/          Typed API client and endpoint methods
  src/utils/             Formatting and persistent idempotency keys
  src/styles/            Tailwind entry and responsive design system
apps/backend/
  prisma/                Schema, seed data, versioned SQL migrations
  src/config/            Validated environment and Prisma connection
  src/controllers/       Request parsing and response mapping
  src/routes/            REST routes and order rate limiter
  src/services/          Catalog, transaction orchestration, Telegram, outbox worker
  src/repositories/      Product/order/outbox database operations
  src/middleware/        Central error handling
  src/utils/             App errors and transactional migration runner
packages/shared/         Strict shared schemas, types, delivery labels, money helpers
tests/                   Unit and PostgreSQL integration tests; browser/ Chromium tests
```

The root configuration includes npm workspaces, strict TypeScript, ESLint, Prettier, Vitest, Playwright, and Docker Compose. Each cloud task already has an isolated checkout; use it directly rather than creating a Git worktree.
