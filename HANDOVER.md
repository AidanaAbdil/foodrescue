# FoodRescue — handover

Read this before making any change. It is the state of the project as of **2026-10-02**
(see `git log` for the latest commit; pushed to `github.com/AidanaAbdil/foodrescue`, branch `main`).
Also read `AGENTS.md` and `README.md`.

---

## 1. What this is

A "Too Good To Go"-style web app for **Kazakhstan**: cafés, bakeries and shops sell
unsold food in discounted **surprise bags**; customers order and pay online, then pick
the bag up during a time window by showing a short pickup code.

Two kinds of users:
- **Customers** browse, search, order and pay, see "My orders", cancel (refund before pickup starts).
- **Store owners** set up a store, add/edit/hide bags (with photos), see who's coming, mark orders
  collected. They **cannot order** (separate customer account needed).

**Next planned step: putting the site online** (see §9). After that: real Kaspi Pay / Halyk ePay.

---

## 2. Working with the user (important)

- **Beginner with dev tooling.** Explain in plain language, give exact copy-paste commands,
  say what each step does. Warn against things like `sudo git`.
- **Native Kazakh speaker** (also reads Russian). She reviews all Kazakh text — ask her, don't
  suggest an outside reviewer. When adding Kazakh strings, list them in a table for her review.
- **Git:** commit after each finished feature **and `git push` right after every commit**
  (her standing instruction). Never commit `.env`, `dev.db`, `uploads/`.
- **Never wipe her data.** Her own accounts exist in the local DB (a store owner with a store, and a
  customer). `npm run db:seed` is safe (only replaces the two demo accounts), but don't reset the
  database or delete users without asking. An earlier version of the seed deleted all users and
  wiped her account — she noticed.
- **Brand identity matters** to her: she rejected the original teal for looking like Too Good To Go
  and chose **Terracotta & Sage** (§6). Don't drift back toward TGTG's look.
- She decided: Kazakhstan only; Russian + Kazakh + English; online payment only; full refund only
  before pickup starts; sample stores in Almaty and Astana.

---

## 3. Running it

```bash
npm install            # also runs prisma generate
npm run dev            # http://localhost:3000
npm run db:seed        # refresh demo data (keeps real accounts)
npx prisma migrate dev --name <change> && npx prisma generate   # after editing schema.prisma
npx tsc --noEmit && npx eslint src prisma                       # run before every commit
```

- `.env` (git-ignored) contains only `DATABASE_URL="file:./dev.db"`. Optional settings:
  `PAYMENT_PROVIDER` (default `test`), `APP_URL` (site address for links in emails),
  `EMAIL_PROVIDER` (none yet → emails are printed in the `npm run dev` terminal),
  `TEST_REFUNDS_FAIL=true` (makes test refunds fail, to try the retry logic).
- **After a migration, restart `npm run dev`.** The Prisma client is cached on `globalThis` across
  hot reloads, so new tables are `undefined` until restart (`Cannot read properties of undefined
  (reading 'findMany')`). There is no `.env.example` yet (a permission check blocked copying `.env`;
  writing one from scratch is fine if wanted).
- **Demo accounts** (password `password123`): `customer@example.com` (Алия Нурланова),
  `owner@example.com` (Ерлан Сейтжанов, owns 4 sample stores: 2 Almaty, 2 Astana).

### Environment quirks (her Mac)
- Node **24.21** (Prisma 7 CLI needs ≥20.19; an old Node 20.17 caused crashes earlier). If you see
  `NODE_MODULE_VERSION` errors: `npm rebuild better-sqlite3`.
- **`head` is not the usual command** on this machine (it's a Perl HTTP tool). Use `sed -n 1,20p`.
- BSD tools: no `cat -A`; `sed -i ''` syntax. zsh: unquoted globs like `--include=*.tsx` fail.
- No Homebrew, no `gh` CLI. Git pushes over HTTPS with her stored credentials.
- `sqlite3` CLI does **not** enforce foreign keys unless you run `PRAGMA foreign_keys=ON;` first.

---

## 4. Stack — and "this is not the Next.js you know"

- **Next.js 16.3** (App Router, Turbopack), **React 19.2**, **Tailwind CSS 4**, **TypeScript**.
- **Prisma 7** with the `prisma-client` generator → `src/generated/prisma` (git-ignored),
  SQLite via `@prisma/adapter-better-sqlite3`. Config in `prisma.config.ts`.
- `AGENTS.md` says: read `node_modules/next/dist/docs/` before writing Next code. Things already
  relied on:
  - `params` / `searchParams` are **Promises**; typed with global `PageProps<"/route">`,
    `LayoutProps`, `RouteContext`.
  - `cookies()` / `headers()` are async; cookies can only be **set** in Server Actions / Route Handlers.
  - `redirect()` throws — keep it outside `try/catch`.
  - Server Action files (`"use server"`) may **only export async functions** (constants live in `src/lib`).
  - Server Action body limit raised to 5 MB in `next.config.ts` (photo uploads).
  - `public/` files are only reliably served if present at build time → uploads use a route handler.
  - Middleware is now called **proxy** (not used yet).
- No external auth/i18n/validation libraries — all hand-rolled and small (see below).

---

## 5. Architecture map

```
prisma/schema.prisma        User, Session, Store, SurpriseBag, Order, Payment (+ enums)
prisma/seed.ts              demo data (Almaty/Astana, tenge); only touches DEMO_EMAILS
src/app/                    pages; each folder is a URL
  page.tsx                  home: hero, search, city filter, near-me, categories, grid
  bags/[id]/page.tsx        bag details + ReserveForm
  orders/page.tsx           customer's orders (pending/upcoming/past), pay/cancel
  pay/test/[paymentId]/     TEST payment page (stand-in for Kaspi/Halyk)
  dashboard/…               store owner: stats, pickups, bag list, new/edit bag, store setup
  login/, signup/           auth pages (support ?next= return path)
  uploads/[file]/route.ts   serves uploaded photos
  not-found.tsx             localized 404
  actions/                  Server Actions: auth, orders, payments, dashboard, photos, locale
src/lib/
  session.ts                sessions, getCurrentUser (cached), requireUser/requireOwner, safeReturnPath
  password.ts               scrypt hashing (node:crypto)
  payments/service.ts       the payment state machine (holds, confirm, fail, cancel, refund)
  payments/provider.ts      provider interface + selection (PAYMENT_PROVIDER)
  payments/test-provider.ts fake provider
  uploads.ts                save/validate/delete/read photos in ./uploads
  format.ts                 price input parsing (tenge→tiyn), discount %
  geo.ts                    haversine km, coords parsing
  categories.ts             category emoji + list (names are in dictionaries)
  orders.ts                 MAX_PER_ORDER = 3
src/i18n/                   config, server (getI18n), client (useI18n), shared (formatters), dictionaries
src/components/             Header, MobileMenu, LanguageSwitcher, BagCard, StatCard, ReserveForm,
                            auth/*, dashboard/* (BagForm, PhotoField, StoreSetupForm, LocationPicker…),
                            search/NearMeButton
```

Pattern: **Server Components query Prisma directly**; mutations are **Server Actions** used as
form `action`s (work without JS too); client components only where interaction needs it.

---

## 6. Key decisions and conventions

### Money, time, units (Kazakhstan)
- Prices are **Int in tiyn** (1 ₸ = 100 tiyn). Owners type whole tenge (`1490`, `1 490`);
  `parsePrice` converts. Display: `f.price()` → "1 490 ₸" (no decimals).
- **All times are Kazakhstan time, UTC+5 (`Asia/Almaty`)**, regardless of server clock:
  parse form dates with `parseLocalDateTime`, "today" with `startOfToday()`, format with `f.time/f.day`.
  Never use `new Date(y, m, d)` / `toLocaleTimeString()` without the time zone.
- Distances in **km**; 24-hour clock.

### Languages (`src/i18n`)
- Locale from cookie `locale` (set by the РУС · ҚАЗ · ENG switcher), else `Accept-Language`, else **ru**.
  URLs are not localized (trade-off: weaker SEO for kk/en; could move to `/kk/...` later).
- `dictionaries/ru.ts` is the source of truth; `kk.ts` and `en.ts` are typed `Dictionary`, so
  **missing keys fail `tsc`**. Server: `const { dict, f, fill, plural } = await getI18n()`.
  Client: `useI18n()`. Server Actions return already-translated error strings.
- Placeholders `{n}`, `{store}` via `fill()`; plurals via `plural(n, forms)` (Intl.PluralRules;
  Russian needs one/few/many).
- **Kazakh grammar rules learned:**
  - Don't attach case endings to numbers/times in templates ("3-ге" is wrong, should be "3-ке";
    it varies). Rephrase instead, e.g. "Төлеу мерзімі: {time}".
  - Kazakh puts the number **inside** the sentence: stat labels are templates like
    `"Бүгін {n} тапсырыс берілді"`; `StatCard` renders text-before / big number / text-after.
- Glossary she chose for Kazakh: **дүкен** (store), **алып кету** (pickup), **тапсырыс беру**
  (to order), **тосын сый пакеті** (surprise bag), **Жеке парақша** (dashboard),
  tagline **"Тағам қоқысқа емес, дастарқанға лайық."**
- Russian search treats ё = е.

### Brand / UI
- Colors are tokens in `src/app/globals.css`: `brand` #c2553a (terracotta), `brand-dark` #8f3b26,
  `brand-light` #e3ebdd (soft sage), `accent` #5e7d5a (sage), page bg #faf6f1. Chosen to pass
  WCAG AA with white text; terracotta text on the page bg is too faint → use `brand-dark` there.
- Font Geist with `cyrillic` + `cyrillic-ext` (Kazakh letters).
- Header: inline links on `lg+`, ☰ `MobileMenu` below. Check layouts at 375 px width.

### Auth & sessions
- **Rate limiting** (`src/lib/rate-limit.ts`, `AuthAttempt` table): 5 wrong passwords per email /
  15 min, 20 failed logins per IP / 15 min, 3 reset emails per address / hour. The IP comes from
  `x-forwarded-for`, which is only trustworthy behind a hosting proxy that sets it.
- **Password reset**: `/forgot-password` → one-time link (`PasswordResetToken`, hashed, 1 hour) →
  `/reset-password?token=…`. Same reply whether or not the email exists. Resetting logs out all
  devices. Email goes through `src/lib/mailer.ts` (printed to the terminal until a provider is added).
- Random 32-byte token in an httpOnly cookie `session`; DB stores only its SHA-256 (`Session.tokenHash`),
  30-day expiry. `secure` only in production.
- Login uses one generic error message and a dummy hash for unknown emails (no account enumeration).
- `?next=` return paths pass through `safeReturnPath` (blocks `//evil.com`).
- Roles: CUSTOMER, STORE_OWNER (ADMIN exists in schema, unused). Sign-up can't create ADMIN.
- **Only customers can order** (her decision): store accounts see a notice instead of the order
  form, have no "My orders" (`/orders` redirects to `/dashboard`), and `reserveBag` refuses them.

### Orders & payments (`src/lib/payments/service.ts`)
```
order ──► PENDING_PAYMENT (bag held 15 min, Order.expiresAt)
            ├─ paid ─────────► RESERVED ──► COLLECTED (owner marks)
            │                    └─ cancel before pickupStart ─► CANCELLED + refund
            └─ declined / timed out ─► EXPIRED (stock released)
late payment on an EXPIRED order → re-take stock if available, else automatic refund
```
- **Every state change is a conditional `updateMany` (`where: { status: … }`)**, so double clicks,
  races and late callbacks can't oversell, pay, refund or release stock twice. Keep this pattern.
- Stock is held by decrementing `quantityAvailable` in the same conditional update that checks it.
- Expiry has **no background job**: `releaseExpiredHolds()` runs at the top of pages that show stock
  (home, bag page, orders, dashboard, pay page, reserveBag).
- When a hold expires the **Payment stays PENDING on purpose** (customer may still pay at the
  provider). This was a real bug found in testing — don't "tidy" it to FAILED.
- Provider interface: `createPayment`, `resumeUrl`, `refund`. Only `test` exists. It throws in
  production unless `ALLOW_TEST_PAYMENTS=true`.
- Pickup codes: 2 Latin letters (no I/O) + 4 digits, unique, shown only after payment.
- `paymentHousekeeping()` (called at the top of stock/order pages) releases expired holds and
  **retries failed refunds**; meanwhile the customer sees "refund in progress".
- Store dashboard shows only paid orders; "reserved" counts RESERVED+COLLECTED.

### Photos (`src/lib/uploads.ts`)
- Picked in `PhotoField`, shrunk in the browser (≤1600 px JPEG, EXIF rotation), uploaded immediately
  via `uploadBagPhoto`; URL travels in hidden `imageUrl`. Server checks magic bytes (JPEG/PNG/WebP),
  ≤4 MB, random UUID names, saves to `./uploads` (git-ignored), served by `/uploads/[file]` with
  immutable caching + `nosniff`. `saveBag` only accepts the bag's current photo or an existing
  upload; replaced/removed uploads are deleted, and uploads older than a day that no bag uses are
cleaned up whenever someone uploads. Sample data uses Unsplash (allowed in `next.config.ts`).

### Push notifications (stores and customers)
- Web Push (`web-push`), keys in `.env` (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`;
  generated locally, git-ignored — a new server needs its own keys, and changing keys invalidates
  existing subscriptions). `PushSubscription` per device with its locale.
- `src/components/PushToggle.tsx` ("🔔 Notifications on this device") on /dashboard and on
  /orders (customers): asks permission, subscribes via the service worker, saves with
  `savePushSubscription`. iPhone needs the site installed to the Home Screen first (iOS 16.4+);
  the toggle checks that first. Waiting for the service worker times out after 10 s (registers it if
  missing) and failures are shown in red, never silently. When on, a "Test" link sends a test
  notification to that device only (`sendTestPush`).
- Customers: `storeCancelOrder` (store "Can't hand over" or admin) → `notifyStoreCancelled` →
  "Order CODE cancelled · {store} can't hand over… full refund", opens /orders.
- "Can't hand over" asks on the page (`ConfirmSubmit`, no browser popup) with a reason:
  `Order.cancelReason` = SOLD_OUT / CLOSING / OTHER (`CANCEL_REASONS` in src/lib/orders.ts). For two
  days, My orders shows an apology box per store-cancelled order (reason unless OTHER, refund amount
  and state) plus up to 3 bags from other stores in the same city. Idea for later: a goodwill
  voucher, which needs a credits/promo system first.
- `confirmPayment` → `notifyNewOrder` (src/lib/push.ts) → "🔔 New order CODE · bag × n · pickup …"
  to all the owner's devices; tapping opens /dashboard (`public/sw.js`, cache `offline-v3`).
  Expired subscriptions (404/410) are deleted. Sending never breaks a payment.
- The service worker is now registered in development too (push needs it).
- Verified with a real (non-headless) Chrome window: notification arrived via FCM. Headless Chrome
  has no push service.
- Header shows "Dashboard (n)" for owners with paid orders waiting today (admins: "Admin (n)" stores
  to review); `src/lib/header-counts.ts`. `LiveCount` polls `/api/counts` every 15 s and on tab focus
  and calls `router.refresh()` when the number changed; order/review actions call `refresh()` so
  the header redraws at once (a `redirect` to the same page alone keeps the old header).
- Push only reaches the owner of the store whose bag was ordered: test with your own store's bag.
- Dashboard sound button (`NewOrderAlert`) remembers "on" in localStorage. After a reload the browser
  may hold sound until the first click: the button then reads "Tap to activate sound" and any click
  or key press on the page wakes it (clicking the button itself does not turn it off).
- This is the start of the "staff app" direction she chose; next: a "pack N bags" reminder before
  pickup (needs a scheduled job on the server), customer notifications.

### Account, store contact, store-side cancel, error screens (2026-10-02)
- `/account` (`AccountForms`, `src/app/actions/account.ts`): change name, email (password needed),
  password (logs out other devices via `deleteOtherSessions`), and delete the account: refused while
  paid orders are waiting (as customer or at own stores); otherwise wipes name/email/password/consent
  (`deletedAt` set, email → `deleted-<id>@deleted.invalid`), deletes sessions/favourites/reset
  tokens, hides the owner's stores/bags/schedules, keeps orders/payments anonymously.
- Store `phone` (required in the form, normalised to +7…, `src/lib/phone.ts`) and `openingHours`;
  call links on store/bag/order pages; dashboard reminder when missing.
- Owner dashboard pickups: "Can't hand over" (`storeCancelOrder`, full refund, no restock,
  `Order.cancelledBy`) and "Didn't show up" (`markNoShow`, status NO_SHOW, only after pickup start,
  no refund); both confirm first (`ConfirmSubmit`). Admin shows per-customer no-show counts.
- `src/app/error.tsx` (translated, `retry` prop in Next 16), `global-error.tsx`, `loading.tsx`.
  Note: with `loading.tsx`, pages stream, so `redirect()` during rendering arrives as a 200 with a
  `<meta http-equiv="refresh">` instead of a 307. Browsers follow it; tests must look for it.

### Homepage: Bags | Stores tabs, search, "Show more" (2026-10-03)
- `/?tab=stores` switches to the store list; the search box only searches the open tab. Category and
  label chips belong to the Bags tab. Tabs show counts.
- All filtering runs in the database. Search uses `searchText` columns on SurpriseBag and Store
  (lowercased in JS, ё→е; SQLite can't lowercase Cyrillic). **Any code that saves a bag's
  title/description or a store's name/description/address must also save `searchText`**
  (`bagSearchText` / `storeSearchText` in src/lib/search.ts). `npm run db:search` recomputes all
  (run once after deploying the migration; the seed calls it).
- `?show=24` etc.: 12 per page, max 240. "Near me" sorts up to 500 matches by distance in JS.
- Stores tab: stores with bags on sale first (A–Z), then the rest (A–Z).
- Sold-out bags appear only once the available list is fully shown.

### Earnings report for stores (2026-10-03)
- Dashboard → "📊 Доходы" (`/dashboard/earnings?period=week|month|last-month`, Kazakhstan time,
  weeks start Monday). Orders count on their pickup day. Sold = paid and not refunded (collected,
  no-show, or still reserved). Shows revenue, payout, food value saved, waiting/no-show/refunded
  counts, tables by day and by bag. Logic in `src/lib/earnings.ts`.
- Commission: `PLATFORM_FEE_PERCENT` in .env (e.g. 10). Not set = "no commission". Business decision
  still open; payouts aren't connected (test payments).
- "Скачать CSV" → `/dashboard/earnings/export?period=…`: `;`-separated with a BOM for Excel; cells
  starting with = + - @ are escaped (CSV formula injection).

### Link previews (Open Graph) (2026-10-03)
- `opengraph-image.tsx` in src/app (site card), bags/[id] (photo, title, price, −%, pickup date,
  address) and stores/[id] (name, address, bags on sale). Shared renderer `src/lib/og.tsx`
  (`next/og` ImageResponse, 1200×630) with Noto Sans from `assets/fonts` (OFL; covers Kazakh + ₸).
- Uploaded WebP photos and missing photos show the store's first letter instead (the renderer
  can't draw WebP; emoji would need an outside service).
- Root layout sets `metadataBase` from `siteUrl()` (APP_URL, or the request's host, so the demo
  tunnel works). Stores under review get the general card and no title/description.
- Previews show the real date, not "Today", because chat apps cache them.

### "Pack N bags" reminder and help page (2026-10-03)
- Stores: `sendPackReminders` (src/lib/reminders.ts, run by the background timer) sends one push per
  owner and pickup time, `PACK_REMINDER_MINUTES` (default 60) before pickup, for bags with paid orders:
  "📦 Пора собирать пакеты к 18:00 · Хлебный сюрприз — 3 шт.". `SurpriseBag.packReminderSentAt` makes it
  once only. The dashboard shows "Собрать к выдаче" (counts per bag and pickup time).
- `/help` (footer + phone menu): customer FAQ in 5 sections; answers fill in the real rules (price levels,
  multiplier, 15-minute hold, max 3 per order, 7 days for complaints). Contact box appears when
  `SUPPORT_EMAIL`, `SUPPORT_PHONE` and/or `SUPPORT_TELEGRAM` are set in .env. Links to /partners.
- Tests: notifications.spec.ts (pack reminder), help.spec.ts (57 tests in total).

### Commission + yearly fee, founding partners (2026-10-03)
- Decision: **20% commission** on each bag (PLATFORM_FEE_PERCENT now defaults to 20) **plus a yearly
  fee of 25 000 ₸**; **the first 50 stores approved get their first year free**. All in .env:
  `PLATFORM_FEE_PERCENT`, `YEARLY_FEE_TENGE`, `FOUNDING_PARTNERS`, `FOUNDING_FREE_MONTHS` (src/lib/fees.ts).
- Store fields: `foundingNumber`, `feeFreeUntil`, `feePaidUntil`; `MembershipPayment` rows. Approving a
  store for the first time calls `claimFoundingPlace` (src/lib/founding.ts): next number + free year
  while places are left. `npm run fees:founding` gives places to stores approved before this existed
  (already run on dev.db: №1–17, 33 left). A fresh database at launch starts at №1.
- Yearly fees are paid **outside the app** for now (transfer/Kaspi): admin → "Взносы" (/admin/fees)
  lists stores (due first), "Оплачено: +1 год" (confirm) extends `feePaidUntil` from whatever is already
  covered, records the payment and logs `fee.paid`. Nobody is hidden automatically when unpaid.
- Stores see their status on the Earnings page and a reminder on the dashboard when it's due. The
  platform report shows yearly fees received and how many stores owe. "Для заведений" shows the
  commission, fee and "places left" (banner + FAQ).
- Tests: tests/e2e/fees.spec.ts (55 tests in total; the last test fills all 50 places in test.db).

### Fixed bag prices (2026-10-03)
- Decision: like Too Good To Go, stores pick one of a few **fixed price levels**; the food inside must
  be worth at least **2× the price** (≥ 50% off). Settings in `src/lib/pricing.ts`, overridable in .env:
  `PRICE_LEVELS=990,1990,2990,3990` (tenge; chosen from Astana prices: pastries · a meal · dinner or
  groceries · sushi) and `VALUE_MULTIPLIER=2`; restart after changing. Review every 6–12 months.
- Bag form: price cards ("1 490 ₸ · ценность от 2 980 ₸") instead of "usual value" / "your price"
  inputs. `saveBag` accepts only a level (`levelFor`) and sets `originalPrice` = level value itself, so
  stores can't inflate the value. Editing older bags starts on `nearestLevel`.
- `npm run prices:apply` moves upcoming bags and all regular bags to the nearest level (run after
  changing the levels; already run on dev.db). Paid orders keep Order.totalPrice. The demo-stores
  script snaps to levels too.
- "Для заведений" FAQ explains the levels. Tests: tests/e2e/pricing.spec.ts (50 tests in total).

### Doodle icons instead of emoji (2026-10-03)
- `src/components/Doodle.tsx`: hand-drawn style line icons (`<Doodle name="bell" />`, `filled` for full
  hearts/stars), using currentColor; thicker strokes at small sizes. Bag categories map to doodles via
  `CATEGORY_DOODLE` (src/lib/categories.ts; CATEGORY_EMOJI is gone).
- All on-screen emoji and icon glyphs (🔔 📍 🗺 📊 📞 ♡ ★ ✓ 🔁 ✎ ⬇ 🥡 🏪 🌱 📷 ☰ ✕, category emoji, line icons)
  were replaced; the texts in the dictionaries no longer start with emoji. Kept on purpose: emoji in
  push-notification titles and the browser-tab "🔔" (both are plain text only). `<option>`s can't hold
  icons, so the bag form's category list is text only.

### "For businesses" page and partner requests (2026-10-03)
- `/partners` (header link "Для заведений" for visitors and customers): benefits, 4 steps for stores,
  FAQ (the cost answer uses PLATFORM_FEE_PERCENT, else "terms when you join"), request form, and
  "Sign up right away" → `/signup?as=store` (store role preselected).
- Form → `submitPartnerRequest` (src/app/actions/partners.ts): validation, phone normalised, hidden
  "website" honeypot (bots get a fake success), 5 requests per IP per hour (rate-limit kind
  "partner"). Saved as `PartnerRequest` (NEW / CONTACTED / CLOSED).
- Admin: "Заявки заведений" section on /admin (tap-to-call phone, "Связались" / "Закрыть", logged
  as partner.contacted / partner.closed); NEW requests count in the "Админ (n)" badge.
- Homepage "Как это работает" now has two columns: customers and businesses (+ "Стать партнёром").
- Tests: tests/e2e/partners.spec.ts (47 tests in total).

### Demo stores for testers (2026-10-03)
- `npm run demo:stores` (scripts/add-demo-stores.ts) adds 10 approved stores (6 Almaty, 4 Astana:
  bakery, café, sushi, groceries + produce, vegan, pancakes, Kazakh cuisine, cakes, pizza, ramen),
  each with its own owner account (`…@example.com`, password `password123`) and **daily regular bags**,
  so there are always bags for today/tomorrow. Skips stores whose owner email exists; touches
  nothing else. Photos are Unsplash URLs; check they match before real use. Already run on dev.db.

### Background timer, reminders, favourite alerts (2026-10-03)
- `src/instrumentation.ts` → `src/lib/background.ts`: a timer inside the server, every minute
  (`BACKGROUND_EVERY_SECONDS`, tests use 2; `BACKGROUND_JOBS=off` disables; skipped during build;
  `unref()` so it never keeps a process alive). Runs housekeeping (expire unpaid orders, retry
  refunds, publish regular bags) and pickup reminders. Every job claims rows first (updateMany
  with a condition), so several servers never double-send.
- Pickup reminders (`src/lib/reminders.ts`): RESERVED orders whose pickup starts within 30 min
  (and started ≤15 min ago), ordered more than 10 min ago, `Order.reminderSentAt` null → push
  "⏰ Скоро выдача" (`notifyPickupSoon`).
- Favourite stores (`notifyFavoritesAboutBag` in push.ts): when a bag is created in the dashboard or
  published by a regular bag, customers who favourited the (approved) store and have push on get
  "❤️ Новый пакет", at most once per 12 h per store (`Favorite.notifiedAt`). The Favourites page has
  the 🔔 button.

### Admin tools (2026-10-03)
- /admin top links: 🔎 Поиск, 📊 Отчёты, 🗒 Журнал.
- `/admin/search?q=`: users (email, or name with case variants, since SQLite ignores case only for
  English letters), orders (pickup code), bags (searchText). Actions: block/unblock a user (with a
  reason), cancel+refund a reserved order, hide/unhide a bag.
- Blocking (`User.blockedAt/blockedReason`): sessions deleted, `getCurrentUser` treats them as logged
  out, login shows the reason (only after the right password). Admins can't be blocked. A blocked
  owner's stores become REJECTED with the reason; unblocking does not re-approve them.
- Hidden bags (`SurpriseBag.hiddenByAdminAt` + isActive false): the store sees "Скрыт администрацией",
  has no show button, and `toggleBagActive`/`toggleSchedule` leave it hidden.
- `AdminLog` (src/lib/admin-log.ts): every admin action (store approve/reject, refunds, report
  decisions, block/unblock, hide/unhide) with admin, details and time; `/admin/log` shows the last 200.
- Tests: notifications.spec.ts, admin-tools.spec.ts (43 tests in total).

### Platform report for the owner (2026-10-03)
- /admin → "📊 Отчёты" (`/admin/reports?period=week|month|last-month`), admins only.
  `src/lib/platform-report.ts` (reuses periodRange/platformFeePercent from earnings.ts; orders count
  on their pickup day). Shows: sales (paid, not refunded), commission (PLATFORM_FEE_PERCENT), owed to
  stores, refunds; daily sales bars; by city; orders (handed over, waiting, no-shows, cancelled by
  stores/customers, abandoned payments); bags rescued; growth (new/active/repeat customers, new/active/
  pending stores, complaints); a table of every store (bags, sales, commission, payout, no-shows,
  cancellations, complaints, rating).
- CSV: `/admin/reports/export?period=…` (same escaping as the stores' CSV).
- The test site runs with PLATFORM_FEE_PERCENT=10 (scripts/test-server.mjs) so tests check the
  commission maths. tests/e2e/report.spec.ts (35 tests in total).
- Not built: payout tracking (marking a store as paid), which needs real payments first.

### Opening hours picker (2026-10-03)
- Store form: "Указать часы работы" → a row per weekday (open checkbox + two time inputs, "use
  Monday's hours for every day"). Saved in `Store.openingHours` as JSON, 7 entries Monday-first,
  `["09:00","22:00"]` or null (closed); overnight like 18:00–02:00 allowed. `src/lib/hours.ts`
  (parse/serialize/format). The store page shows "Пн–Пт 09:00–21:00, Сб 09:00–18:00, Вс выходной"
  or "Ежедневно 09:00–22:00". Older free text still displays as is; the 4 demo stores in dev.db
  were converted.

### Map view on the homepage (2026-10-03)
- "☰ Список | 🗺 Карта" next to the tabs (`?view=map`). One pin per store (number = matching bags,
  grey "·" = none now), same filters as the list (search, city, category, labels). Popup: name,
  "N bags · from X ₸", link to the store page. Stores without a map point are counted below the map.
- `src/components/search/ResultsMap.tsx` (Leaflet, loaded only in the browser via
  ResultsMapLoader). Fits all pins (+ "near me" dot), or the chosen city. Caps: 2000 bags / 1000
  stores per map; at real scale, load pins for the visible area instead.
- OpenStreetMap tiles; switch to a tile provider (e.g. 2GIS) before heavy traffic.

### Impact counter (2026-10-03)
- My orders: "🌱 Ваш вклад" card (bags rescued, money saved vs. full price) once a customer has a
  COLLECTED order. `src/lib/impact.ts`. **No CO₂ figure on purpose** (the user decided, 2026-10-03):
  2,5 kg/bag was the FAO world average per kg of wasted food times an unknown bag weight.
  Add it back only with a sourced method (e.g. stores enter bag weight × a published factor).
- Homepage hero: "Уже спасено пакетов {n}" = all COLLECTED bags (shown when > 0).
- Tests: tests/e2e/impact.spec.ts (32 tests in total).

### Ratings and "report a problem" (2026-10-03)
- `Review` (1–5 stars + optional private comment, one per order, `storeId` copied for averages) and
  `ProblemReport` (kind QUALITY / NOT_AS_DESCRIBED / NO_FOOD / OTHER + text; status OPEN /
  REFUNDED / CLOSED; one per order). Rules in `src/lib/feedback.ts`: rate only COLLECTED orders;
  report COLLECTED, NO_SHOW, or RESERVED after pickup started; both for 7 days after pickup.
- My orders: `OrderFeedback` (stars, comment, report form). Actions in src/app/actions/feedback.ts.
- Public "★ 4.6 (12)" (`RatingBadge`, `publicRatings` in src/lib/ratings.ts) on bag cards, the store
  list, store and bag pages, only with ≥ 3 ratings. Comments are only shown to the store (dashboard
  "Отзывы покупателей") and admins; nothing public to moderate.
- Admin: "Жалобы" at the top of /admin. "Вернуть деньги" → `refundForReport` (cancels a still-reserved
  order, refunds; failed refunds are retried by housekeeping), or "Закрыть без возврата". The customer
  sees the outcome and gets a push. Open reports count in the header's "Админ (n)".
- Tests: tests/e2e/feedback.spec.ts (now 29 tests in total).

### Automated tests (Playwright) (2026-10-03)
- `npm test` runs 24 end-to-end tests in tests/e2e (see tests/e2e/README.md): customer ordering,
  payments, declines, refunds, oversell; store hand-over/cancel/no-show, earnings + CSV, sign-up →
  admin approval, one-off → regular bag; access control (other owners' bags/orders, pending stores,
  roles, login rate limit); homepage search/tabs/show more/languages/link previews.
- `scripts/test-server.mjs`: deletes and recreates **test.db** (`prisma migrate deploy` + seed),
  builds into `.next-test` (`NEXT_DIST_DIR`), serves on port 3100 with test payments. dev.db is
  never touched. Prisma refuses `migrate reset` when an AI agent runs it, so the script deletes
  only the test file instead.
- Tests create their own data via Prisma (`tests/e2e/helpers.ts`), one worker (shared SQLite).
- Uses the installed Chrome (`channel: "chrome"`), so no browser download.
- package.json is `"type": "module"` (Playwright needs it to load the generated Prisma client).
- Checked that the tests can fail: breaking the owner filter in earnings made a test fail. Note:
  breaking the refund alone does NOT fail anything, because housekeeping re-tries refunds for
  cancelled-but-paid orders on the next page load (by design).

### Cities, map & store list
- `Store.city` holds a code from `src/lib/cities.ts` (ALMATY, ASTANA; names in `dict.cities`,
  shown via `cityName`). Store form uses a select; `saveStore` rejects anything else. Existing
  free-text cities were converted by two migrations (SQLite `lower()` is ASCII-only, hence the
  second, Cyrillic one). To add a city: `CITIES` + `cities` in each dictionary.
- Store form map: `MapPicker` → `StoreMap` (Leaflet + react-leaflet, client-only via
  `next/dynamic`, OpenStreetMap tiles, CSS divIcon pin, neutral credit). Tapping/dragging sets
  lat/lng; a point picks its city (`cityAt`, 50 km); changing city clears an out-of-city pin.
  At scale switch tiles to a provider (2GIS is the local favourite; needs an API key).
- Address ↔ map (`src/lib/geocode.ts`, actions in `src/app/actions/geocode.ts`, owners only):
  OpenStreetMap Nominatim via our server (1 req/s, cached, identifying User-Agent — its policy
  forbids search-as-you-type). "Find on map" expands abbreviations (пр./ул./мкр…), searches inside
  the city's box and only accepts results whose city matches (same-named streets exist in Kaskelen
  etc.); otherwise asks to place the pin manually. Tapping the map suggests the street address
  (auto-fills an empty field). Live suggestions + better house data → 2GIS Suggest/Geocoder API
  at launch (needs a key; paid after a demo month).
- Homepage "All stores" lists every approved store in the city (search matches names), with
  "N bags on sale" / "Next bag …" / "No bags right now"; sorted by bags, then next bag, or distance.
- Her `~/.npm` cache has root-owned files (old `sudo`), so `npm install` fails with EACCES. She can
  fix it with `sudo chown -R 501:20 ~/.npm`; until then install with `--cache <some temp dir>`.

### Store pages, sold out & favourites
- `/stores/[id]`: store info, map link, regular bags with "Next bag" (`nextWindow` in
  src/lib/schedules.ts), available bags, and today's sold-out bags. Reachable even when everything
  is sold out; non-approved stores only for owner/admin.
- Homepage keeps today's sold-out bags in a greyed "Already sold out" section (same filters).
- `Favorite` (userId+storeId). `FavoriteButton` (customers only; logged out → login link) on store
  and bag pages; `/favorites` lists favourite stores with current bags or the next bag time.
  Header shows "Favourites" for customers. Notifying favourites about new bags = later (push).

### New-order alerts & regular bags
- Dashboard `NewOrderAlert` polls `/dashboard/updates` (owner-only JSON: newest paid order) every
  10 s → pop-up, `router.refresh()`, 🔔 in the tab title, optional Web-Audio chime (button; choice in
  localStorage). No email/push yet.
- `BagSchedule` = a regular bag (weekdays "1,…,7" ISO, start/end "HH:MM" Almaty, quantity per day).
  `publishScheduledBags()` (src/lib/schedules.ts) creates the SurpriseBag for today and tomorrow;
  `@@unique([scheduleId, scheduleDate])` prevents duplicates. Runs via `runHousekeeping()`
  (src/lib/housekeeping.ts), which replaced direct `paymentHousekeeping()` calls in pages.
- Editing a schedule deletes its upcoming, not-yet-ordered bags and re-publishes; pause hides them
  (ordered bags stay on sale); delete removes them and unlinks ordered ones (`untouchedUpcoming`).
- Photos can be shared by a schedule and its bags → always use `deleteUploadIfUnused`.
- `BagForm` has `mode`: "new" (Once/Regularly switch) · "bag" · "schedule".

### Store approval & admin
- `Store.status` PENDING → APPROVED / REJECTED (+ `rejectionReason`). New stores start PENDING; only
  APPROVED stores' bags reach the homepage, bag pages (owner/admin can preview) and `reserveBag`.
  Saving a REJECTED store's details puts it back to PENDING. Existing stores were set APPROVED by
  the migration.
- `/admin` (role ADMIN, `requireAdmin`): approve/reject/hide stores (reason required, owner sees it
  on the dashboard), and "cancel & refund" paid orders a store can't hand over (`adminCancelOrder`,
  no restock). Header shows "Admin (n)" with the pending count.
- Make an admin: sign up normally, then `npm run make-admin -- email` (refuses store-owner accounts;
  `--remove` reverts). Seed adds a demo admin `admin@example.com` (password123).
- Test gotcha: admin pages also contain the Log out form — pick forms by content, not position.

### Legal pages & consent
- `/privacy` and `/terms` render `src/content/legal/{ru,kk,en}.ts` (DRAFTS with `[placeholders]` for
  the ИП details and contact email; lawyer review needed; `LEGAL_IS_DRAFT` shows a draft note).
- Sign-up requires a consent checkbox; `User.consentAt/consentVersion` record it. `ConsentBanner`
  asks logged-in users without the current `LEGAL_VERSION` to agree (`acceptTerms`). Bump
  `LEGAL_VERSION` when the texts change meaningfully.
- `rich()` in `src/i18n/rich.tsx` puts links inside translated sentences (cases differ per language).
- The terms promise a full refund if a store can't hand over an order → admins can cancel+refund.

### Food labels
- `SurpriseBag.isHalal / isVegetarian / isVegan` + `allergens` (comma-separated codes from
  `ALLERGENS` in `src/lib/labels.ts`). Vegan ⇒ vegetarian (enforced in `saveBag`). Chips via
  `FoodLabels`; homepage filters `?halal=1&veg=1&vegan=1`; the bag page always shows an allergy note.
- Pickup windows may cross midnight (end before start = next day), max 12 hours.

### Location / search
- Customers: "Near me" = browser geolocation → `?near=lat,lng` (3 decimals) → sorted by km.
- Owners set store coordinates with "use my current location" (setup form, dashboard banner, or the
  store edit page `/dashboard/stores/[id]/edit`, linked from the store names on the dashboard).
  No address geocoding.
- Filtering happens in JS after one query (fine at current scale; move to SQL when large).

### Security checklist used everywhere
Ownership checks inside every owner action (`store: { ownerId: user.id }`), server-side validation
of every field, prices/amounts computed on the server, no user-supplied URLs rendered by `next/image`.

---

### Installable app (PWA)
- Option 1 of 3 she chose (PWA now; a store app via Capacitor or a native app later). Manifest in
  `src/app/manifest.ts` (localized description), icons generated by `npm run icons`
  (`scripts/generate-icons.mjs`, uses local Chrome; rerun after a rebrand), `appleWebApp` + `viewport`
  (white theme colour, `viewportFit: "cover"`) in `src/app/layout.tsx`, safe-area padding on header/footer.
- `public/sw.js`: network-only for pages, falls back to `public/offline.html` (static, trilingual,
  icon drawn inline). **Bump `CACHE` in sw.js when changing it.** Registered only in production
  (`ServiceWorkerRegistration`). `/sw.js` is served with no-cache headers; site-wide security headers
  live in `next.config.ts`.
- `InstallHint` (homepage only): tip for iPhone/iPad Safari users, dismissal stored in localStorage.
- Tested in headless Chrome: no manifest/installability errors, service worker controls the page,
  offline page shown when the server is killed with `kill -9` (a graceful stop keeps serving open
  keep-alive connections and fools the test), iPhone tip shows/dismisses, not shown on Android.
- Customer push: only "store can't hand over" so far; "pickup starts soon" reminders are next.

### Demo link (current way to show the app)
- `npm run demo` (`scripts/demo.mjs`): `next build` + `next start -p 3001` with `DEMO=true`,
  `PAYMENT_PROVIDER=test`, `ALLOW_TEST_PAYMENTS=true`, then a Cloudflare quick tunnel
  (`~/.local/bin/cloudflared`, official signed/notarized binary) → random `*.trycloudflare.com`
  HTTPS link. `DEMO=true` shows a demo banner (`footer.demo` text), adds noindex meta and a
  disallow-all `robots.txt`. Verified through the tunnel: private files (.env, dev.db, code, .git)
  all 404; login/order/pay work; session cookie is Secure.
- She runs it herself in her own terminal so she controls when the link is open.

## 7. How things were tested (no test suite in the repo yet)

- `npx tsc --noEmit` + `npx eslint src prisma` before every commit.
- End-to-end scripts (Node `fetch`) that submit the **real forms the way a no-JS browser does**:
  fetch the page, copy the form's hidden `$ACTION_*` inputs, add fields, POST with `redirect: "manual"`,
  carry the `session` cookie. Used for auth, reservations (incl. 6 parallel orders for the last bag),
  dashboard ownership, i18n pages in all 3 locales, and all payment paths.
- Headless Chrome via the DevTools protocol (`--remote-debugging-port`) for screenshots, geolocation
  override, and file uploads (`DOM.setFileInputFiles`). Check `document.documentElement.scrollWidth`
  for horizontal overflow at 375 px.
- Gotcha: the first `<form>` on many pages is the **language switcher**, and a hidden **Log out**
  submit button exists in the mobile menu — select forms/buttons precisely in scripts.
- Clean up test users/bags/uploads afterwards (they were). Those scripts were not saved to the repo;
  turning them into a real test suite (e.g. Playwright) would be valuable.

---

## 8. Known gaps / TODO

Fixed on 2026-10-02: store editing, login rate limiting, password reset, refund retries,
abandoned-upload clean-up, and a first production build (`npm run build` passes; `next start`
smoke-tested).

**Future direction (the owner's idea, 2026-10-03, not now):** once there are iOS/Android apps, the website
could stop showing stores for ordering and become a front door: mission, impact, "For businesses",
FAQ, app download links. Keep on the web anyway: the store dashboard, admin, and bag/store pages for
shared links (open the app if installed, else show the bag with download buttons). Until there is an
app, the website (installable PWA) stays the full ordering experience.

All "must-haves" are done (2026-10-03). Next candidates: UI improvements (ask the user which screens first).

**Open at the end of 2026-10-02:**
- **Push on her own devices is not confirmed yet.** As of the end of the session, `PushSubscription` was
  still empty: "🔔 Notifications on this device" never finished on her laptop (as danchik@mail.ru) or
  phone. Ask which browser and the exact red message the toggle now shows (Brave/Arc block push
  by default; iPhone needs the Home Screen app). Then test with "Проверить" (Test).
- Homepage tabs/search/pagination done 2026-10-03; a list/map toggle is still to do.
- Customer push so far only covers "store can't hand over"; "pickup starts soon" is the natural next one.
- Possible goodwill voucher after a store cancels (she said "offer smth idk"); needs a voucher system.

Still open:
- **Not deployed.** SQLite file + local `uploads/` folder only.
- **Email**: no provider connected (reset links print to the terminal). Connect one (e.g. Resend)
  in `src/lib/mailer.ts` before launch, and set `APP_URL`.
- **Real payments**: needs her ИП, a live HTTPS site, a Kaspi Pay contract (Kaspi's API also requires
  an IPSec VPN tunnel from the server) and/or Halyk ePay (use its hosted payment page to avoid PCI DSS).
  Then add a provider in `src/lib/payments/` + a webhook route calling `confirmPayment`/`failPayment`
  (verify signatures!). With `PAYMENT_PROVIDER=test` in production, ordering fails with a plain
  500 error by design (no stock is held).
- Background timer runs every minute inside the server (see "Background timer"). Upload clean-up
  still runs during uploads.
- **Store notifications:** push for new orders is built (see "Push notifications for stores").
  Still to do from the staff-app idea: She prefers a **staff app** approach (like Too Good To Go's store app): staff
  install the app on a phone/tablet, get push notifications for new orders and a "pack N bags
  today" reminder before pickup, and confirm pickups there. Telegram bot was discussed as an
  alternative; cash-register (POS) integration only for big chains, much later. Needs the site
  deployed (push needs an always-on server with HTTPS).
- Features not built yet: email/SMS notifications, store time zones (all UTC+5), automated test
  suite (Playwright), earnings reports, link previews.
- Localized URLs for SEO (`/kk/…`) if search ranking matters.
- Kazakh strings for **payments**, **photos**, **password reset**, **store editing**, **rate
  limiting**, **push/test notification**, **sound button**, **Иә/Жоқ confirmations** and **store
  cancellation apology/reasons** were written by Claude and sent to her for review. Check for corrections.
- **Kazakh review happens once, at the end, before launch:** the user will go through all
  Kazakh text with a friend who is a professional Kazakh teacher. Write Kazakh in Kazakh (Turkic,
  verb-final) word order, not copied from the Russian.

## 9. Next step: deployment (researched, paused on 2026-10-02)

She paused deployment to **choose a new brand name** first ("FoodRescue" doesn't work well in
Kazakh/Russian). Don't deploy until she decides; then rename everywhere (logo, metadata, all three
dictionaries, emails, README) and put the name in one constant.

**Name candidates** (.kz free per `whois -h whois.nic.kz` on 2026-10-02; re-check before buying):
Jarty (жарты, "half"), Qalmasyn (қалмасын, "let nothing be left"), Keshki (кешкі, "evening"),
Tamaq Saqta, Obal Bolmasyn, Artyq As. Taken: obal, saqta, saqtau, artyq, dastarqan, kesh, obalemes.
Claude suggested Jarty or Qalmasyn and a trademark check at Kazpatent.

**Decisions already made:**
- First goal is a **demo site** (test payments, clearly marked), not a public launch: she has no ИП yet.
  For the demo set `ALLOW_TEST_PAYMENTS=true` and hide it from search engines (noindex).
- **Host on a VPS in Kazakhstan.** Kazakhstan's personal-data law (Law No. 94-V, Art. 12(2)) requires
  databases with personal data to be stored in Kazakhstan; .kz domains must also point to servers in
  Kazakhstan and use HTTPS; Kaspi's API needs a fixed IP for its VPN. So no Vercel/EU hosting.
  (Advise her to confirm the legal details with a lawyer/accountant when registering the ИП; the law
  was amended in Nov 2025.)
- VPS to rent (she buys it): PS.kz or Hoster.kz (Almaty/Astana), **Ubuntu 24.04 LTS, ≥2 GB RAM**,
  1–2 vCPU, 25 GB+ SSD, **public IPv4** (not IPv6-only), ~3 000 ₸/month. Domain from a Kazakh registrar.
- An SSH key was created on her Mac for this: `~/.ssh/foodrescue_ed25519` (public half
  `foodrescue_ed25519.pub`, to paste into the provider's order form). Never ask for passwords in chat;
  if needed she runs `ssh-copy-id -i ~/.ssh/foodrescue_ed25519.pub root@IP` herself.

**Planned setup on the VPS** (Claude does it over SSH, explaining each step):
1. Run `npm run build` locally first (it passes as of 2026-10-02).
2. Keep SQLite + the uploads folder on the VPS disk at first (persistent, simplest), but outside the
   app folder (e.g. `/srv/<app>/data`): make the upload folder configurable (currently
   `process.cwd()/uploads` in `src/lib/uploads.ts`) and point `DATABASE_URL` there.
3. Deploy by `rsync` from her Mac (no GitHub credentials on the server), then on the server:
   `npm ci`, `npx prisma migrate deploy`, `npm run build`, restart.
4. Run the app with systemd (auto-restart on crash/reboot), Caddy in front for automatic HTTPS
   (Let's Encrypt), a firewall allowing only SSH/80/443.
5. Daily backups of the database (`sqlite3 .backup`) and uploads, keeping ~2 weeks.
6. Production env: `NODE_ENV=production`, `DATABASE_URL`, `APP_URL`, `PAYMENT_PROVIDER=test` +
   `ALLOW_TEST_PAYMENTS=true` (demo only), later `EMAIL_PROVIDER`.
7. Later, at scale or for the real launch: Postgres, object storage for photos (a Kazakh provider,
   to respect data localization), real email, Kaspi/Halyk.
