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

In a sandbox without a writable default npm cache, use `npm ci --cache /workspace/.npm-cache`. The root `prepare` script builds the shared package. The backend `predev` hook generates Prisma Client before each development-server start, including `npm run dev` and `npm run dev:backend`. This restores the client after `npm ci` replaces `node_modules`; if a standalone build, seed, or administrator command reports an uninitialized client, run `npm run db:generate` first. Generation loads the root `.env` without exposing anything to Vite.

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

`POSTGRES_PORT` controls the PostgreSQL port exposed on the host (default `5432`); PostgreSQL inside the container continues to use port `5432`. Keep the port in `DATABASE_URL` consistent with `POSTGRES_PORT`.

The Compose credentials are development-only. For a custom password, set both `POSTGRES_PASSWORD` and the corresponding password in `DATABASE_URL` before the first database initialization. Changing the environment does not change a password in an existing PostgreSQL volume. For an existing database, skip the Docker step and configure `DATABASE_URL`; apply migrations and seed only to the database you intend to use.

If Docker on Windows cannot bind port 5432, select a different available port by editing these two entries in the existing root `.env` (do not overwrite the rest of the file):

```env
POSTGRES_PORT=5433
DATABASE_URL=postgresql://tovarka:local-development-only@127.0.0.1:5433/tovarka
```

Then run `docker compose up -d --wait postgres`, `npm run db:migrate`, and `npm run db:seed`. Use your existing password if you previously configured one. The named database volume is preserved when Compose recreates the container for a port change. If port 5433 is also unavailable, choose another available port and update both entries consistently. Update test connection URLs to use the selected port as well.

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

Migration failures report a safe `stage`, `code`, and troubleshooting hint instead of the raw database error. `28P01` means the database rejected the password; `ECONNREFUSED` means no database is accepting the connection; `3D000` means the selected database does not exist. Check `docker compose ps` and verify your local root `.env` against the credentials used to initialize PostgreSQL. On Windows, a separately installed PostgreSQL service may already use port 5432. Do not share `.env` or a connection URL when requesting help; share only the diagnostic code and stage. Existing Docker volumes keep their original database password when `.env` changes.

Keep product changes in the seed script or authorized database operations. Catalog writes are available only through the authenticated administration API described below. There is no unauthenticated product-write endpoint.

## Administration panel

The Ukrainian admin UI is at **`/admin`** on the same frontend host as the store. It provides total order count, orders in the last 24 hours, the sum of placed orders (not paid revenue), total products, searchable/paginated orders with customer contacts and historical item snapshots, category creation, and product creation with stock, visibility, price, description, and photo upload. Hidden products are excluded from the public catalog. The current scope does not include editing/deleting products or changing order statuses.

After pulling an update, stop the running development server, preserve your existing `.env` (including the PostgreSQL port you selected), and run each command separately from the repository root:

```bash
npm ci
npm run db:generate
npm run db:migrate
npm run admin:create
npm run dev
```

PostgreSQL must be running before migration and account creation. `admin:create` is an interactive backend-only command. Enter a username (press Enter to use `admin`), then a password of 12–128 characters twice. Password input is masked and is never written to source, `.env`, or console output. If Git Bash does not expose an interactive terminal, run the command in PowerShell or Windows Terminal from the same repository. There is no built-in password or public registration/setup endpoint. Re-running the command with an existing username resets that account's password and revokes all its sessions without deleting orders or products.

Open `/admin` on the store's frontend, using the exact origin configured in `FRONTEND_URL`; the default is the frontend on `localhost` port `5173`. Signing in through a different hostname such as `127.0.0.1` requires updating `FRONTEND_URL` and restarting the backend. Keep your working `DATABASE_URL` unchanged when adding an administrator. Account data is stored in the same PostgreSQL database as orders.

Passwords use salted scrypt hashes. Sessions use random 256-bit tokens in HttpOnly, SameSite=Strict cookies; only token digests are stored in PostgreSQL. Sessions expire after eight hours and are revoked on logout/password reset. Production cookies are Secure and require HTTPS. Login attempts are rate limited. Every admin mutation requires the configured browser Origin plus a custom request header, and every customer-data endpoint requires a valid server session. Private responses use `Cache-Control: no-store`; the browser clears private query data on logout/expiry. The UI does not store passwords or session tokens in localStorage.

Product photo uploads accept a single PNG, JPEG, or WebP up to 5 MiB, check the file signature, generate a random filename, and exclude SVG/HTML uploads. Uploaded photos are public product assets under `/uploads`; only administrators may upload them. Use photographs intended to be public. The default filesystem directory is `.data/uploads` relative to the backend process working directory (normally `apps/backend/.data/uploads`). It is ignored by Git. Set `UPLOAD_DIR` to an absolute persistent directory for production and back it up along with the database. File uploads are separate from database transactions: a photo uploaded before a discarded form can remain unused on disk. Existing catalog images and HTTPS image URLs remain supported, including in persisted carts.

Admin API routes (all under `/api/admin`):

| Method | Path          | Purpose                                                       |
| ------ | ------------- | ------------------------------------------------------------- |
| POST   | `/login`      | Validate credentials and set the session cookie               |
| GET    | `/session`    | Current administrator identity                                |
| POST   | `/logout`     | Revoke the current session                                    |
| GET    | `/stats`      | Store order/product counts and order amount                   |
| GET    | `/orders`     | Paginated orders; `search` matches number, customer, or phone |
| POST   | `/products`   | Create a validated catalog product                            |
| POST   | `/categories` | Create a product category                                     |
| POST   | `/uploads`    | Upload a product photo as multipart field `image`             |

The optional admin browser scenario requires a disposable seeded database, a dedicated admin account, a test order, and process variables `ADMIN_TEST_USERNAME`, `ADMIN_TEST_PASSWORD`, `ADMIN_TEST_CUSTOMER`, and `ADMIN_TEST_PRODUCT`. Never provide production credentials to browser tests. Run `npm run test:browser -- tests/browser/admin.spec.ts` with those variables injected securely. Without the two credential variables, this optional scenario is explicitly skipped; the three storefront scenarios still run normally. The scenario places a product in the database and uploads a photo, so use disposable fixtures and clean them up after testing.

## Telegram configuration

1. Open Telegram's verified `@BotFather`, send `/newbot`, and follow its instructions. Store the issued token in `TELEGRAM_BOT_TOKEN` using secure environment settings or your ignored local `.env`. Never paste credentials into issues or source code.
2. Start a private conversation with the bot and send a message, or add the bot to the destination group and allow it to send messages. Channel notifications require suitable administrator permission.
3. Use the official Bot API's `getUpdates` method from a private backend tool to inspect `message.chat.id` (or `channel_post.chat.id`) after sending a message. If a webhook is configured, polling `getUpdates` cannot be used concurrently; inspect the webhook update in your backend instead. Do not put a token-bearing URL in screenshots, shell history, or shared logs. Group IDs may be negative; preserve the full value as a string.
4. Save that ID as `TELEGRAM_CHAT_ID`, allow backend HTTPS access to `api.telegram.org`, and restart the backend. Both variables must be present.
5. Place a development order with your own contact details. Check the Notification row in the private database for delivery status. Unit and integration tests mock Telegram. For browser tests, explicitly set both Telegram variables to empty values in the disposable backend process.

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

Delivery methods are `post`, `courier`, and `pickup`; the first two require an address. At most 50 distinct products and 99 units per line are accepted. Duplicate product lines and client-supplied prices are rejected. An identical payload with the same key returns the original order with 200; a new order returns 201; a changed payload with an existing key returns 409. Persist the same key when retrying a network failure. The frontend stores a request digest and key, never checkout contact details, in localStorage. SHA-256 is calculated with a pure JavaScript implementation, and UUIDs use `crypto.getRandomValues` when `crypto.randomUUID` is unavailable. Checkout therefore works on development HTTP origins without SubtleCrypto; saved SHA-256 digests remain compatible across upgrades and reloads. Cart product data is also persisted there. If browser storage is disabled, persistence across reloads is unavailable.

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

The HTTP checkout browser regression serves an insecure HTTP origin through a local request bridge, verifies that SubtleCrypto and native UUID APIs are absent, drops the first response after the order commits, reloads the page, and checks that retry returns the same order.

These tests exercise real PostgreSQL transactions, catalog validation, authoritative prices, invalid requests, stock rollback, concurrent overselling, concurrent duplicate requests, rate limiting, and successful/failed/multipart Telegram delivery with mocked HTTP requests.

Browser tests require the running frontend/backend and seeded development products. Use an isolated backend with `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` explicitly set to empty values, so real notifications are not sent. They create a test order and reduce stock; run against a disposable development database. They cover filters, unavailable products, quantity controls, cart persistence, form validation, checkout success, responsive layout, local images, and keyboard dialog dismissal.

```bash
# If system Chromium is unavailable:
npx playwright install chromium
# With npm run dev already running:
npm run test:browser
```

Validation after adding the administration panel: 39 unit tests, 22 PostgreSQL integration tests, and 4 Chromium browser scenarios passed (including the separately configured admin scenario). Type checking, linting, and the production build passed. No real Telegram message was sent; actual delivery requires the two Telegram variables and permitted network access.

## Production build and deployment

```bash
npm ci
npm run db:generate
npm run build
npm run db:migrate
NODE_ENV=production npm run start -w @tovarka/backend
```

Serve `apps/frontend/dist` with a static web server, use an SPA fallback to `index.html` for `/admin`, and proxy `/api` and `/uploads` to the private backend. Use HTTPS, a durable PostgreSQL database, process supervision, restricted database access, and backups. Set `FRONTEND_URL` to the actual site origin and inject the backend environment variables. Frontend and backend are separate build artifacts; the Express server does not serve the frontend. Seed only if you explicitly want demonstration products. Replace the seed catalog, product illustrations, and merchant contact/policy details before running a real store. Online payment integration is not implemented.

## Project map

```text
apps/frontend/
  public/images/         Original local SVG product illustrations
  src/components/        Header, cards, accessible dialog, cart, checkout, UI states
  src/admin/             Login, dashboard, order details, product/category/photo forms
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
  src/services/          Catalog, orders, admin authentication, uploads, Telegram/outbox
  src/repositories/      Product/order/admin/outbox database operations
  src/middleware/        Central error handling
  src/utils/             App errors and transactional migration runner
packages/shared/         Strict shared schemas, types, delivery labels, money helpers
tests/                   Unit and PostgreSQL integration tests; browser/ Chromium tests
```

The root configuration includes npm workspaces, strict TypeScript, ESLint, Prettier, Vitest, Playwright, and Docker Compose. Each cloud task already has an isolated checkout; use it directly rather than creating a Git worktree.
