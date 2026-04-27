# Development Plan: Multilingual Support (i18n)

## Vision

As a player, I want to play Spacewars: Ironstrike in my preferred language (German or English), so that the UI, labels, and messages feel natural and accessible. English remains the default and fallback. A language selector is available in the navigation.

## Resolved Decisions (Human Input)

1. **Locale persistence**: Cookie + DB column (`preferred_locale` on `users` table). The server needs the user's locale to generate messages (battles, harvests, builds) in the correct language. The `NEXT_LOCALE` cookie mirrors the DB value for fast client-side and middleware reads. On login, the DB value is written to the cookie. When the user switches language via the UI, both the cookie and the DB record are updated atomically.
2. **Translation terminology rules**:
   - `"Spacewars"` and `"Ironcore"` — **never translated**, always kept in English regardless of locale.
   - `"Iron"` → `"Eisen"` in German UI labels and messages.
   - `"Iron Horde"` → `"Eisenhorde"` in German.
   - Other game-specific proper nouns (weapon names, etc.) — translate naturally where German works without sounding awkward.
3. **Summarize feature**: Must be fully duplicated for German. All existing summarization test files must be doubled (one English set, one German set). See Goal 11.

---

## Technology Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript (strict mode)
- **i18n Library**: `next-intl` ^3.x
- **Locale storage**: Cookie (`NEXT_LOCALE`) mirroring a `preferred_locale` DB column on `users`
- **Translation files**: `src/locales/en.json` + `src/locales/de.json` (nested namespaces)
- **Email templates**: Separate locale support via translation helper
- **Canvas text**: Passed via injected string maps from React into game engine

---

## Project Structure after Implementation

- `src/locales/` — Translation files per language
  - `en.json` — English (default + fallback)
  - `de.json` — German
- `src/i18n/` — next-intl configuration
  - `request.ts` — Reads locale from cookie, provides request-scoped i18n
  - `routing.ts` — Defines supported locales and default
- `src/middleware.ts` — Locale detection + cookie injection (expands existing middleware)

---

## Locale Strategy

**Cookie + DB column** (not URL prefix):

- Avoids restructuring the App Router (`[locale]` folders) — no SEO need for locale URLs
- **`preferred_locale TEXT DEFAULT 'en'`** column on the `users` table — the authoritative source
- **`NEXT_LOCALE` cookie** — mirrors the DB value; read by Next.js middleware and `src/i18n/request.ts` for fast locale resolution on every request without a DB lookup
- **Sync on login**: login/session establishment reads `user.preferredLocale` from DB and sets the cookie
- **Sync on language switch**: `/api/set-locale` writes to both the cookie and the DB (if authenticated)
- **Default locale**: `en` — new users get `'en'`; any missing `de.json` key falls back to English
- **Server-side message generation** uses `user.preferredLocale` (from DB/UserCache) to generate battle, harvest, and build messages in the user's language

---

## Goals

### Goal 1: Infrastructure Setup

**Description**: Install and configure `next-intl` with cookie-based locale detection, English default, and German as first translation target. Also adds `preferred_locale` to the DB and wires locale sync into the login and language-switch flows.

**Inputs**: `package.json`, `next.config.ts`, `src/app/layout.tsx`, `src/middleware.ts` (if exists, otherwise create)
**Outputs**: Working locale detection with fallback; `NextIntlClientProvider` in layout; `preferred_locale` persisted in DB

#### Task 1.1: Install `next-intl` dependency

**Action**: Add `next-intl` to `dependencies` in `package.json` via `npm install next-intl`
**Files**:

- `package.json` — new dependency
- `package-lock.json` — updated

---

#### Task 1.2: Create locale routing configuration

**Action**: Create `src/i18n/routing.ts` defining supported locales (`en`, `de`) and default locale (`en`).
Use `defineRouting` from `next-intl/routing` with `localeDetection: false` (cookie-based, not URL-prefix).

**Files**:

- `src/i18n/routing.ts` — new file

---

#### Task 1.3: Create `getRequestConfig` for server-side i18n

**Action**: Create `src/i18n/request.ts` that reads the locale from the `NEXT_LOCALE` cookie (via `next/headers`) and loads the corresponding JSON message file. Falls back to `en` if cookie is absent or locale is unsupported.

**Files**:

- `src/i18n/request.ts` — new file

---

#### Task 1.4: Register i18n plugin in `next.config.ts`

**Action**: Wrap the existing PWA-wrapped config with `createNextIntlPlugin` from `next-intl/plugin`. Point it to `src/i18n/request.ts`.

**Files**:

- `next.config.ts` — wrap config with `createNextIntlPlugin('./src/i18n/request.ts')`

**Note**: `createNextIntlPlugin` composes with the existing PWA plugin. Chain them correctly: `createNextIntlPlugin(withPWA(...))` or the reverse depending on next-intl docs at implementation time.

---

#### Task 1.5: Create middleware for locale detection and cookie setting

**Action**: Create (or update) `src/middleware.ts`. Use `next-intl`'s `createMiddleware` (from `next-intl/middleware`) configured with supported locales. Set `localePrefix: 'never'` so URLs remain unchanged. The middleware reads `Accept-Language` header on first visit and sets the `NEXT_LOCALE` cookie accordingly; subsequent requests use the cookie.

**Files**:

- `src/middleware.ts` — new or updated

**Note**: Check if the project already has a middleware file (for iron-session or other purposes). If so, compose the two middlewares.

---

#### Task 1.6: Wrap layout with `NextIntlClientProvider`

**Action**: Update `src/app/layout.tsx` to:

1. Import `getLocale` and `getMessages` from `next-intl/server`
2. Wrap `<body>` contents with `<NextIntlClientProvider messages={messages}>`
3. Set `<html lang={locale}>` dynamically instead of hard-coded `"en"`

**Files**:

- `src/app/layout.tsx` — import locale, set dynamic lang, add provider

---

#### Task 1.7: Add `preferred_locale` column to `users` table

**Action**: Follow the "Adding New User Fields Pattern" from `doc/learnings.md` to add `preferred_locale TEXT DEFAULT 'en'` to the users table.

1. `src/lib/server/schema.ts` — add `preferred_locale TEXT DEFAULT 'en' NOT NULL` to `CREATE_USERS_TABLE`; increment `SCHEMA_VERSION`
2. `src/lib/server/migrations.ts` — add migration: `ALTER TABLE users ADD COLUMN IF NOT EXISTS preferred_locale TEXT DEFAULT 'en' NOT NULL`
3. `src/lib/server/user/user.ts` — add `preferredLocale: string = 'en'` as a class field initialisation (NOT a constructor parameter — see learnings note on constructor stability)
4. `src/lib/server/user/userRepo.ts` — update `UserRow` interface (add `preferred_locale`), `userFromRow()` (set `user.preferredLocale = row.preferred_locale ?? 'en'`), and `saveUserToDb()` UPDATE query (add `preferred_locale = $N`; adjust WHERE clause param number accordingly)

**Supported locale values**: `'en'`, `'de'`. Validated on write; defaults to `'en'` on read if null/unknown.

**Files**:

- `src/lib/server/schema.ts`
- `src/lib/server/migrations.ts`
- `src/lib/server/user/user.ts`
- `src/lib/server/user/userRepo.ts`

---

#### Task 1.8: Sync locale between cookie and DB

**Action**: Two-directional sync:

**On login** (`src/app/api/login/route.ts` or session establishment):

- After successful authentication, read `user.preferredLocale` from the user record (already in UserCache)
- Set the `NEXT_LOCALE` cookie to the DB value — so the user's stored preference is restored on any device

**On language switch** (`src/app/api/set-locale/route.ts`, Task 7.2):

- If the request has an active session (authenticated user), also update `user.preferredLocale` in DB via `UserCache` write-through
- Set cookie as before

**On registration** (`src/app/api/register/route.ts`):

- Read `Accept-Language` header; if `de` is preferred, set `preferred_locale = 'de'` on the new user record
- Set `NEXT_LOCALE` cookie accordingly

**Files**:

- `src/app/api/login/route.ts` — read locale from DB user, set cookie on login response
- `src/app/api/set-locale/route.ts` — also persist to DB when authenticated (updated in Task 7.2)
- `src/app/api/register/route.ts` — detect locale from Accept-Language, store in new user

**Status**: ✅ COMPLETED
**Implementation Summary**: All Goal 1 infrastructure tasks implemented — next-intl installed, routing/request config created, next.config.ts updated, middleware created, layout wrapped with NextIntlClientProvider, preferred_locale added to DB schema/migrations/User/userRepo, and login/register routes updated to sync locale cookie.
**Files Modified/Created**:
- `package.json` / `package-lock.json` — added next-intl dependency
- `src/i18n/routing.ts` — defineRouting with locales ['en','de'], defaultLocale 'en', localePrefix 'never'
- `src/i18n/request.ts` — getRequestConfig reading NEXT_LOCALE cookie, loading JSON messages
- `src/locales/en.json` — placeholder English messages
- `src/locales/de.json` — placeholder German messages
- `next.config.ts` — wrapped with createNextIntlPlugin chained with withPWA
- `src/middleware.ts` — new file using next-intl createMiddleware
- `src/app/layout.tsx` — async layout with getLocale/getMessages, NextIntlClientProvider
- `src/lib/server/schema.ts` — added preferred_locale column, MIGRATE_ADD_PREFERRED_LOCALE, SCHEMA_VERSION 17
- `src/lib/server/migrations.ts` — added applyPreferredLocaleMigration, called from applyTechMigrations
- `src/lib/server/user/user.ts` — added preferredLocale: string = 'en' class field
- `src/lib/server/user/userRepo.ts` — updated UserRow, userFromRow, saveUserToDb for preferred_locale
- `src/app/api/login/route.ts` — sets NEXT_LOCALE cookie from user.preferredLocale on login (fixed: secure flag + corrected comment)
- `src/app/api/register/route.ts` — reads Accept-Language, sets preferredLocale on new user, sets NEXT_LOCALE cookie (fixed: secure flag + corrected comment)
- `src/__tests__/helpers/apiTestHelpers.ts` — added `additionalHeaders` param to `createRequest` helper
- `src/__tests__/integration/api/auth-api.test.ts` — added 3 locale cookie integration tests
**Deviations from Plan**: Task 1.2 used `localePrefix: 'never'` as specified; Task 1.4 chained withNextIntl(withPWA()(config)) which is the correct order per next-intl docs.
**Arc42 Updates**: None required
**Test Results**: ✅ All 8 auth-api tests passing, build successful, no linting errors

**Review Status**: ✅ APPROVED
**Reviewer**: Medicus
**Review Notes**: All three previously flagged issues were correctly resolved: secure flag added to NEXT_LOCALE cookie in both login and register routes (environment-conditional), httpOnly comment accurately describes client-side readability requirement, and 3 meaningful integration tests added covering login locale sync, German detect-on-register, and English default. `additionalHeaders` param is a clean backward-compatible extension. Implementation correctly handles the two-step DB write on registration (createUser default + update via user.save()). No code duplication, no design concerns.

---

### Goal 2: Translation File Structure

**Description**: Define the structure and content of translation files for English (source of truth) and German. All ~485 UI strings are organized into namespaces by feature area.

**Inputs**: Audit results from all UI files (see research report)
**Outputs**: `src/locales/en.json`, `src/locales/de.json`

#### Task 2.1: Design translation file namespace structure

**Action**: Use a flat namespace per feature area. Suggested structure:

```
{
  "common": { ... },         // shared strings: "Loading...", "Retry", "Cancel", "Save", "Error"
  "nav": { ... },            // navigation labels and shortcuts
  "auth": { ... },           // login, register, forgot-password, validation messages
  "home": { ... },           // home page: notifications, progress, defense, bonuses
  "research": { ... },       // research page
  "factory": { ... },        // factory page: build queue, weapons, defense
  "profile": { ... },        // profile page: battle history, password change
  "ship": { ... },           // ship config, inventory, bridge
  "starbase": { ... },       // starbase buy/sell
  "game": { ... },           // game canvas controls, announce messages, teleport modal
  "statistics": { ... },     // leaderboard, statistics panel
  "admin": { ... },          // admin panel (low priority, Phase 2)
  "email": { ... }           // email template strings (server-side usage)
}
```

**Files**:

- `src/locales/en.json` — full English translation file (~485 strings + email ~20)
- `src/locales/de.json` — full German translation file

---

#### Task 2.2: Populate `en.json` (source of truth)

**Action**: Extract all user-visible strings from each file listed in the audit report into `en.json` under the appropriate namespace. Key naming convention: `camelCase` keys matching the semantic meaning (e.g., `"ironLabel"`, `"buildButton"`, `"loadingEllipsis"`).

Include all strings from:

- Navigation: `"home"`, `"game"`, `"factory"`, …, `"logout"`, shortcut panel strings
- Auth: all labels, placeholders, buttons, all validation and error messages shown in UI
- Home page: all section headings, row labels, battle banner strings, button labels, state messages
- Research page: all table headers, card labels, buttons, states
- Factory page: all table headers, card labels, queue section, buttons
- Profile page: all headings, battle outcome labels, password dialog
- Ship page: all status messages (especially ✅/❌ messages), section headings, sort buttons, drag-drop labels
- Starbase page: all labels and messages
- Game page: all control panel labels, announce texts, teleport modal strings
- Statistics/Leaderboard: all headings, category labels, stat row labels, states
- Canvas strings: `"Ship"`, `"NPC Ship"`, `"Enemy Ship"`, `"Starbase"`, `"Asteroid"`, `"Ship Wreck"`, `"Escape Pod"`, `"Collectible"`, `"Space Object"`, `"Speed"`, `"Angle"`, `"Distance"`, `"Level"`, `"Action: tap again to dock"`

**Files**:

- `src/locales/en.json` — complete

---

#### Task 2.3: Populate `de.json` (German translation)

**Action**: Translate all keys from `en.json` into German. Follow these translation rules (resolved by human):

| Rule                      | English                     | German           |
| ------------------------- | --------------------------- | ---------------- |
| Never translate           | `Spacewars`                 | `Spacewars`      |
| Never translate           | `Ironcore`                  | `Ironcore`       |
| Always translate          | `Iron` (as a resource noun) | `Eisen`          |
| Always translate          | `Iron Horde`                | `Eisenhorde`     |
| Translate naturally       | `Starbase`                  | `Sternenbasis`   |
| Translate naturally       | `Escape Pod`                | `Rettungskapsel` |
| Translate naturally       | `Shipwreck`                 | `Schiffswrack`   |
| Keep as-is (proper names) | weapon names, NPC names     | unchanged        |

- Use `{variable}` interpolation placeholders unchanged (e.g., `"Sold for {amount} Iron!"` → `"Für {amount} Eisen verkauft!"`)
- Maintain identical key structure as `en.json`

**Files**:

- `src/locales/de.json` — complete German translation

**Status**: ✅ COMPLETED
**Implementation Summary**: Audited all 19 source files listed in the task, extracted all user-visible strings, and populated complete `en.json` and `de.json` files with 12 namespaces (common, nav, auth, home, research, factory, profile, ship, starbase, game, statistics, email). All German translations follow the rules: Iron→Eisen, Starbase→Sternenbasis, Escape Pod→Rettungskapsel, Shipwreck→Schiffswrack, weapon names unchanged.
**Files Modified/Created**:
- `src/locales/en.json` — complete English source of truth (~200 keys across 12 namespaces)
- `src/locales/de.json` — complete German translation (identical key structure)
**Deviations from Plan**: No `admin` namespace added (admin page not in scope of current audit per task list; can be added in a future phase). Canvas tooltip strings added under `game` namespace as specified. `commanderStats` nested under `ship` namespace for clean grouping.
**Arc42 Updates**: None required
**Test Results**: ✅ All 1690 tests passing, no linting errors

**Review Status**: ⚠️ NEEDS REVISION
**Reviewer**: Medicus
**Issues Found**:
1. **Missing strings in `home` namespace** — The following user-visible strings from `HomePageClient.tsx` are absent from `en.json`/`de.json`:
   - Notification action buttons: `"🔄 Refresh"`, `"Refreshing..."`, `"📊 Summarize"`, `"Summarizing..."`, `"Mark All as Read"`, `"Marking..."`
   - Empty state: `"No new messages"`
   - Defense table states: `"Loading defense values..."`, `"Error: {error}"`, `"No defense systems built yet"`, `"No defense data available"`
   - Tech table states: `"Loading tech counts..."`, `"No tech data available"`
2. **Missing strings in `game` namespace** — Two strings from `GamePageClient.tsx` are absent:
   - `"enter coordinates"` (teleport button inside the panel)
   - `"click mode"` (teleport toggle label)
3. **`ship.bridgeSlots` not translated in `de.json`** — Value is `"Bridge Slots"` in both EN and DE. The plan rule only exempts weapon names and NPC names; "Bridge Slots" is a UI feature name that should be translated (e.g., `"Brückenplätze"` or `"Brücken-Slots"`), consistent with how `bridgeHeading` was translated to `"Brücke"` and `bridgeDragHint` to German.
**Required Changes**:
- Add the 13 missing `home` namespace keys to **both** `en.json` and `de.json` with appropriate German translations.
- Add the 2 missing `game` namespace keys (`teleportEnterCoordinates`, `teleportClickMode`) to both files.
- Translate `ship.bridgeSlots` in `de.json` to `"Brückenplätze"` (or `"Brücken-Slots"` if the compound form is preferred).
- Ensure both files remain structurally identical after the additions.

**Re-Review Status**: ✅ APPROVED
**Reviewer**: Medicus
**Review Notes**: All 3 required fixes confirmed. 13 home namespace keys added (using descriptive names: `refreshButton`, `refreshingButton`, `summarizeButton`, `summarizingButton`, `markAllAsReadButton`, `markingButton`, `noNewMessages`, `loadingDefenseValues`, `errorDefenseValues`, `noDefenseSystems`, `noDefenseData`, `loadingTechCounts`, `noTechData`). 2 game keys added (`teleportEnterCoordinates`, `teleportClickMode`). `ship.bridgeSlots` correctly translated to "Brückenplätze" in de.json. Both files confirmed at 325 keys with perfect structural parity, identical interpolation placeholders (`{error}` preserved), and valid JSON.

---

### Goal 3: Migrate UI Components — Phase 1 (Core / High Impact)

**Description**: Replace hard-coded strings in the most frequently visited pages with `useTranslations()` or `getTranslations()` hooks.

**Quality Requirements**: Each migrated file must compile with `tsc --noEmit`. Existing tests must still pass.

#### Task 3.1: Migrate `src/components/Navigation/Navigation.tsx`

**Action**: Use `useTranslations('nav')` hook. Replace all navigation link labels, shortcut-panel button labels, tooltip strings, and status messages (research progress, error states).

**Files**:

- `src/components/Navigation/Navigation.tsx`

---

#### Task 3.2: Migrate `src/components/StatusHeader/StatusHeader.tsx`

**Action**: Use `useTranslations('nav')` (or `'common'`). Replace `"Iron:"` and `"Level:"` labels. Pass locale to `amount.toLocaleString(locale)`.

**Files**:

- `src/components/StatusHeader/StatusHeader.tsx`

---

#### Task 3.3: Migrate `src/components/LoginPageComponent.tsx`

**Action**: Use `useTranslations('auth')`. Replace all headings, tab labels, input labels, placeholders, button text, validation error messages, success messages, and query-param banner strings.

**Files**:

- `src/components/LoginPageComponent.tsx`

---

#### Task 3.4: Migrate `src/app/home/HomePageClient.tsx`

**Action**: Use `useTranslations('home')`. Replace all section headings, table row labels, battle banner strings, button text, state messages. Dynamic strings (e.g., `"Show N more"`) use interpolation with `t('showMore', { count: n })`.

**Files**:

- `src/app/home/HomePageClient.tsx`

---

#### Task 3.5: Migrate `src/app/research/ResearchPageClient.tsx` and `src/components/Research/ResearchCardOverlay.tsx`

**Action**: Use `useTranslations('research')`. Replace all headings, table headers, card labels, button text, state messages.

**Files**:

- `src/app/research/ResearchPageClient.tsx`
- `src/components/Research/ResearchCardOverlay.tsx`

---

#### Task 3.6: Migrate `src/app/factory/FactoryPageClient.tsx`

**Action**: Use `useTranslations('factory')`. Replace all section headings, table headers, card labels, buttons (including dynamic `"Build N"`), queue messages, cheat button. Pass locale for `.toLocaleString()` calls on Iron cost amounts.

**Files**:

- `src/app/factory/FactoryPageClient.tsx`

---

### Goal 4: Migrate UI Components — Phase 2 (Secondary Pages)

#### Task 4.1: Migrate `src/app/profile/ProfilePageClient.tsx`

**Action**: Use `useTranslations('profile')`. Replace battle outcome labels, section headings, password dialog labels, validation messages, button text. Update `new Date(...).toLocaleString()` to pass locale.

**Files**:

- `src/app/profile/ProfilePageClient.tsx`

---

#### Task 4.2: Migrate Ship page components

**Action**: Use `useTranslations('ship')` in each file. Replace all ✅/❌ status messages, section headings, drag-drop instructions, bridge locked message, sort button labels, item detail panel labels.

**Files**:

- `src/app/ship/ShipPageClient.tsx`
- `src/components/Inventory/InventorySection.tsx`
- `src/components/Inventory/BridgeSection.tsx`
- `src/components/Inventory/ItemDetailsPanel.tsx`
- `src/components/Inventory/SortControls.tsx`

---

#### Task 4.3: Migrate `src/app/starbase/StarbasePageClient.tsx` and `src/components/Starbase/CommanderCard.tsx`

**Action**: Use `useTranslations('starbase')`. Replace all labels, buttons, state messages. Pass locale for `.toLocaleString()` on price.

**Files**:

- `src/app/starbase/StarbasePageClient.tsx`
- `src/components/Starbase/CommanderCard.tsx`

---

#### Task 4.4: Migrate `src/app/game/GamePageClient.tsx`

**Action**: Use `useTranslations('game')`. Replace control panel labels, teleport modal strings, button text, loading/error states. Announce text strings (passed into canvas engine) must be fetched here and injected as a string map into the game engine.

**Files**:

- `src/app/game/GamePageClient.tsx`

---

#### Task 4.5: Migrate Statistics and Leaderboard components

**Action**: Use `useTranslations('statistics')`. Replace all headings, category/row labels, state messages, player count string.

**Files**:

- `src/components/Statistics/StatisticsPanel.tsx`
- `src/components/Statistics/Leaderboard.tsx`

---

### Goal 5: Canvas Text Localization

**Description**: The game canvas draws text directly via `ctx.fillText()`. Canvas renderers are pure TypeScript classes (no React), so they cannot use `useTranslations()` directly. Instead, translated strings must be injected from the React layer into the renderer.

#### Task 5.1: Define `CanvasStrings` interface and default English values

**Action**: Create `src/lib/client/game/canvasStrings.ts` with a typed `CanvasStrings` interface containing all translatable canvas strings (object type labels, stat labels from `TooltipRenderer.ts`). Export English default values.

**Files**:

- `src/lib/client/game/canvasStrings.ts` — new file

**Canvas strings to include** (from `TooltipRenderer.ts`):

- Object type labels: `"Ship"`, `"NPC Ship"`, `"Enemy Ship"`, `"Starbase"`, `"Asteroid"`, `"Ship Wreck"`, `"Escape Pod"`, `"Collectible"`, `"Space Object"`
- HUD stat labels: `"Speed"`, `"Angle"`, `"Distance"`, `"Level"`, `"Action_tapToDock"` (`"Action: tap again to dock"`)

---

#### Task 5.2: Thread `CanvasStrings` through Game and TooltipRenderer

**Action**: Update `src/lib/client/game/Game.ts` (or relevant game engine entry point) to accept a `canvasStrings` parameter. Pass it through to `TooltipRenderer`. Replace hard-coded English strings in `TooltipRenderer.ts` with lookup from the passed map.

**Files**:

- `src/lib/client/game/Game.ts` — add canvasStrings parameter
- `src/lib/client/renderers/TooltipRenderer.ts` — use injected strings map

---

#### Task 5.3: Inject translated canvas strings from `GamePageClient`

**Action**: In `GamePageClient.tsx`, use `useTranslations('game')` to build the `CanvasStrings` object and pass it when constructing/updating the `Game` instance. Re-inject on locale change.

**Files**:

- `src/app/game/GamePageClient.tsx` — build and inject CanvasStrings

---

### Goal 6: Number and Date Formatting

**Description**: Replace hard-coded `'en-US'` locale string formatting with locale-aware formatting throughout the app.

#### Task 6.1: Update `src/shared/numberFormat.ts`

**Action**: Add an optional `locale` parameter to `formatNumber(value, locale?)`. Default to `'en-US'` for backward compatibility. Replace internal `.toLocaleString('en-US')` calls with `.toLocaleString(locale)`.

**Files**:

- `src/shared/numberFormat.ts`

---

#### Task 6.2: Update `src/lib/client/services/messagesService.ts`

**Action**: Replace hard-coded `'en-US'` in `toLocaleTimeString('en-US', ...)` and `toLocaleDateString('en-US', ...)` with the active locale from a locale context or parameter.

**Files**:

- `src/lib/client/services/messagesService.ts`

---

#### Task 6.3: Audit and fix remaining `toLocaleString()` calls

**Action**: Pass the active locale explicitly in all remaining `toLocaleString()` calls across:

- `src/components/StatusHeader/StatusHeader.tsx`
- `src/components/Statistics/StatisticsPanel.tsx`
- `src/components/Statistics/Leaderboard.tsx`
- `src/app/factory/FactoryPageClient.tsx`
- `src/app/starbase/StarbasePageClient.tsx`
- `src/components/Starbase/CommanderCard.tsx`
- `src/app/profile/ProfilePageClient.tsx`
- `src/app/admin/page.tsx`

Use `useLocale()` hook (from `next-intl`) to get the current locale in client components.

**Files**: All listed above

---

### Goal 7: Language Selector UI

**Description**: Users must be able to switch the application language. The selected locale is stored in the `NEXT_LOCALE` cookie and takes effect immediately via a full navigation reload.

#### Task 7.1: Create `LocaleSwitcher` component

**Action**: Create `src/components/Navigation/LocaleSwitcher.tsx`. Renders as a small toggle/dropdown with `"EN"` and `"DE"` options. On selection, it sets the `NEXT_LOCALE` cookie via a `POST /api/set-locale` route and calls `router.refresh()` to re-render with new translations.

**Files**:

- `src/components/Navigation/LocaleSwitcher.tsx` — new file

---

#### Task 7.2: Create `/api/set-locale` route

**Action**: Create `src/app/api/set-locale/route.ts`. Accepts `{ locale: string }` POST body. Validates locale is in `['en', 'de']`.

1. Sets `NEXT_LOCALE` cookie (HttpOnly: false — must be readable by middleware, path `/`, SameSite: Lax)
2. If session is authenticated (via iron-session), also updates `user.preferredLocale` in DB via `UserCache` and saves
3. Returns `{ ok: true }`

Both cookie and DB update happen atomically within the same request. If the user is unauthenticated (e.g., on login page), only the cookie is set.

**Files**:

- `src/app/api/set-locale/route.ts` — new file

---

#### Task 7.3: Add `LocaleSwitcher` to Navigation

**Action**: Import and render `LocaleSwitcher` in `src/components/Navigation/Navigation.tsx` (visible in both desktop and mobile nav).

**Files**:

- `src/components/Navigation/Navigation.tsx`

---

### Goal 8: Email Templates Localization

**Description**: Email templates (verification, password reset) should be sent in the user's preferred language if their locale is known.

**Note**: This is lower priority since email locale requires knowing the user's preference at send time. The locale preference is not currently stored on the user model.

#### Task 8.1: Extract email strings to locale files

**Action**: Add an `email` namespace to both `en.json` and `de.json` with all strings from `src/lib/server/email/emailTemplates.ts` (subjects, headings, body text, button labels, footer, fallback text).

**Files**:

- `src/locales/en.json` — add `email` namespace
- `src/locales/de.json` — add `email` namespace

---

#### Task 8.2: Create server-side string resolver for email templates

**Action**: Create `src/lib/server/email/emailLocale.ts` with a `getEmailStrings(locale: string)` function that loads and returns the `email` namespace from the corresponding JSON locale file. Falls back to `en` if locale file or key is missing.

**Files**:

- `src/lib/server/email/emailLocale.ts` — new file

---

#### Task 8.3: Update `emailTemplates.ts` to accept locale

**Action**: Update `buildVerificationEmail` and `buildPasswordResetEmail` in `src/lib/server/email/emailTemplates.ts` to accept an optional `locale: string` parameter. Use `getEmailStrings(locale)` to retrieve strings.

**Files**:

- `src/lib/server/email/emailTemplates.ts`

**Note**: The calling API routes currently do not have access to the user's locale preference. For now, default to `'en'` unless the user's `Accept-Language` header is read from the request context. A full solution would require storing the user's locale in the DB (see Open Questions).

---

### Goal 9: API Error Messages

**Description**: Server-side API errors (~55 strings) are returned to the client as English text and often displayed directly. Full translation is complex because error messages originate on the server.

**Decision**: Keep API errors in English for Phase 1. Client-side validation messages (login/register/password) are already covered in Goal 3 (auth namespace). Technical server errors (`'Not authenticated'`, `'Internal server error'`, etc.) can remain English.

**Action**: No changes to API error strings in Phase 1. Document as Phase 2 if needed.

---

### Goal 12: Server-Side Message Localization

**Description**: All game event messages stored in the database (battle rounds, victory/defeat, harvest, level-up, build completion) are currently hard-coded English strings generated server-side. Since the user's `preferred_locale` is now stored in the DB (Task 1.7), the server can generate messages in the user's language at event time.

**Prerequisite**: Goal 1 (Task 1.7 — `preferred_locale` DB column) must be complete.
**Coordination**: The exact German message format strings defined here must be mirrored exactly in the regex patterns in Task 11.1 (`getMessagePatterns('de')`).

#### Task 12.1: Create `getServerMessageStrings(locale)` helper

**Action**: Create `src/lib/server/messages/serverMessageStrings.ts`. This module exports a `getServerMessageStrings(locale: string)` function returning a typed object with all translatable message template strings for both locales.

Structure matches every message type generated by the four message-producing sources:

- Battle round messages (weapon fire, hits, misses)
- Battle outcome messages (victory, defeat, level-up)
- Harvest messages (asteroid, shipwreck, escape pod collection)
- Build completion messages

German terminology follows the translation rules: `Iron` → `Eisen`, weapon names unchanged, `Spacewars`/`Ironcore` unchanged, etc.

**Files**:

- `src/lib/server/messages/serverMessageStrings.ts` — new file

---

#### Task 12.2: Localize battle messages

**Action**: Update `src/lib/server/battle/battleScheduler.ts` and `src/lib/server/battle/battleService.ts` to use `getServerMessageStrings(locale)` when constructing messages.

- `battleScheduler.ts`: Look up the attacker's and defender's locale from their user records (available in the battle context) before constructing shot/hit/miss messages. Each user receives their message in their own locale.
- `battleService.ts`: Use each user's locale when generating victory/defeat/level-up messages.

**Note**: The attacker and defender may have different locales. Each message is addressed to one user (`P:` = player/attacker, `N:` = opponent/defender), so use the corresponding user's locale for each message.

**Files**:

- `src/lib/server/battle/battleScheduler.ts`
- `src/lib/server/battle/battleService.ts`

---

#### Task 12.3: Localize harvest messages

**Action**: Update `src/app/api/harvest/route.ts` to read the authenticated user's `preferredLocale` from the user record and use `getServerMessageStrings(locale)` when building harvest and escape pod messages.

**Files**:

- `src/app/api/harvest/route.ts`

---

#### Task 12.4: Localize build completion messages

**Action**: Update `src/lib/server/techs/TechService.ts` to read `user.preferredLocale` when generating the `'Build complete: {name}'` message.

**Files**:

- `src/lib/server/techs/TechService.ts`

---

#### Task 12.5: Update test coverage for localized server messages

**Action**: For each modified message-producing module, add test cases verifying German message output when `user.preferredLocale = 'de'`. Existing English tests must not be modified — only German cases added.

Specifically:

- Add German message assertions to existing battle outcome tests (or create a `*-de` parallel where batch-size warrants)
- Add German harvest message assertions
- Add German build completion message assertions

**Files**:

- Existing or new test files under `src/__tests__/integration/`

---

### Goal 11: German Message Summarization

**Description**: The message summarization feature (`/api/messages/summarize`) is purely algorithmic (regex-based string parsing + string building, **no AI/LLM**). It is deeply coupled to English:

1. **Output labels** — summary sections like `'📊 **Message Summary**'`, `'⚔️ **Battles:**'` etc. are hard-coded English strings in `MessageCache.summarizeMessages()`.
2. **Summary detection** — `parsePreviousSummary()` identifies previous summaries by checking for the literal string `'Message Summary'`. This will break if the output label changes for German.
3. **Input messages** — messages stored in DB are always generated in English (battle events, harvest, builds). The summarization PARSES these English strings via regex. For Phase 1, input messages stay English; only the summary **output** is translated.

**Scope of this Goal**: Add a `locale` parameter to the summarize flow so that the **summary report displayed to the user** is in their locale, while the **parsing regex** stays English (since stored messages are English regardless).

**Important**: All 5 existing summarization test files must be fully duplicated for German. No existing tests may be changed — only parallel German test files added.

#### Task 11.1: Add `locale` parameter to `summarizeMessages` + German parsing

**Action**: Update `summarizeMessages(context, userId, locale: string = 'en')` in `src/lib/server/messages/MessageCache.ts`.

**Output label localisation**:

- All summary output label strings (`'📊 **Message Summary**'`, `'⚔️ **Battles:**'`, `'💥 **Damage:**'`, etc.) move to a `getSummaryStrings(locale)` private helper returning the locale-specific label set.
- Pluralisation in German (e.g., `"1 Sieg"` vs `"2 Siege"`) handled with a simple locale-aware plural helper or inline ternary.

**Summary detection fix**:

- `parsePreviousSummary()` currently detects summaries via `summaryText.includes('Message Summary')` — change to use the `📊` emoji anchor as the sole primary identifier (`summaryText.includes('📊')`). This is locale-agnostic.

**German input message parsing**:

- Since messages are now generated in the user's stored locale (Goal 12), a German-locale user will have German-text messages. The parsing regex must support German patterns.
- Add a `getMessagePatterns(locale: string)` private helper that returns locale-specific regex patterns for each known message type (battle round, victory, defeat, collection, build).
- German patterns mirror the English ones but match German message strings generated by Goal 12.
- Example:
  - English battle pattern: `/P: ⚔️ Your \*\*(\w[^*]+)\*\* fired (\d+) shot/`
  - German battle pattern: `/P: ⚔️ Deine \*\*(\w[^*]+)\*\* hat (\d+) Schuss/` (must match whatever Goal 12 generates)
- **Contract**: Task 11.1 and Task 12.2 must agree on the exact German message format strings. Knight implementing both must coordinate these.

**Files**:

- `src/lib/server/messages/MessageCache.ts` — add locale param, `getSummaryStrings()`, `getMessagePatterns()`, fix summary detection

---

#### Task 11.2: Pass locale from summarize API route

**Action**: Update `src/app/api/messages/summarize/route.ts` to:

1. Read `user.preferredLocale` from the authenticated user record (via `UserCache`, already loaded for auth check). This is preferred over the cookie because server-generated messages were written using the DB locale — they must be parsed with the matching locale regex.
2. Validate the locale is in `['en', 'de']`, fall back to `'en'` otherwise.
3. Pass it to `MessageCache.getInstance().summarizeMessages(ctx, session.userId, locale)`.

**Note**: Using the DB locale (not cookie) guarantees that if a user's messages were generated in German, the summarizer will parse them with German patterns — even if the user's cookie was momentarily out of sync.

**Files**:

- `src/app/api/messages/summarize/route.ts`

---

#### Task 11.3: Update home page summarize UI fetch call

**Action**: The `fetch('/api/messages/summarize', ...)` call in `src/app/home/HomePageClient.tsx` currently sends no locale. Since locale is now read server-side from the cookie, **no change is needed to the fetch call itself**. Verify this is the case and document it. Update button strings `'Summarize'` / `'Summarizing...'` via `useTranslations('home')` (covered in Task 3.4, but call out explicitly here).

**Files**:

- `src/app/home/HomePageClient.tsx` — verify no client-side locale forwarding needed

---

#### Task 11.4: German summary string map

**Action**: Define the German summary label set. Proposed translations:

| English label                                                              | German label                                                                      |
| -------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `📊 **Message Summary**`                                                   | `📊 **Nachrichtenzusammenfassung**`                                               |
| `⚔️ **Battles:** {n} victory(ies), {n} defeat(s)`                          | `⚔️ **Kämpfe:** {n} Sieg(e), {n} Niederlage(n)`                                   |
| `💥 **Damage:** Dealt {n}, Received {n}`                                   | `💥 **Schaden:** Verursacht {n}, Erhalten {n}`                                    |
| `🎯 **Your Accuracy:** {n}/{n} hits ({n}%)`                                | `🎯 **Deine Trefferquote:** {n}/{n} Treffer ({n}%)`                               |
| `🛡️ **Enemy Accuracy:** {n}/{n} hits ({n}%)`                               | `🛡️ **Gegner-Trefferquote:** {n}/{n} Treffer ({n}%)`                              |
| `⛏️ **Collections:** {n} asteroid(s), {n} shipwreck(s), {n} escape pod(s)` | `⛏️ **Sammlungen:** {n} Asteroid(en), {n} Schiffswrack(s), {n} Rettungskapsel(n)` |
| `💎 **Iron Collected:** {n}`                                               | `💎 **Eisen gesammelt:** {n}`                                                     |
| `🏭 **Builds Completed:** {n} {name}(s)`                                   | `🏭 **Fertiggestellt:** {n} {name}(s)`                                            |
| `No messages to summarize.` (fallback)                                     | `Keine Nachrichten zum Zusammenfassen.`                                           |

These strings live inside `getSummaryStrings(locale)` in `MessageCache.ts` (not in `locales/en.json` since this is server-side logic).

**Files**:

- `src/lib/server/messages/MessageCache.ts` — `getSummaryStrings('de')` map

---

#### Task 11.5: Double all summarization test files for German

**Action**: Create a German-locale parallel for each of the 5 existing summarization test files. **Do not modify or delete the originals.** New test files test with `locale = 'de'` and assert German output strings.

| Original test file                                                                   | New German test file                                                                    |
| ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| `src/__tests__/integration/lib/MessageCache-summarization.test.ts`                   | `src/__tests__/integration/lib/MessageCache-summarization-de.test.ts`                   |
| `src/__tests__/integration/lib/MessageCache-summary-accumulation.test.ts`            | `src/__tests__/integration/lib/MessageCache-summary-accumulation-de.test.ts`            |
| `src/__tests__/integration/lib/MessageCache-build-summarization.test.ts`             | `src/__tests__/integration/lib/MessageCache-build-summarization-de.test.ts`             |
| `src/__tests__/integration/lib/MessageCache-collection-summarization.test.ts`        | `src/__tests__/integration/lib/MessageCache-collection-summarization-de.test.ts`        |
| `src/__tests__/integration/lib/MessageCache-persistence-after-summarization.test.ts` | `src/__tests__/integration/lib/MessageCache-persistence-after-summarization-de.test.ts` |

**Each German test file must**:

- Mirror every test case from the English original (same scenarios, same message inputs)
- Call `summarizeMessages(ctx, userId, 'de')` instead of `summarizeMessages(ctx, userId)` or `summarizeMessages(ctx, userId, 'en')`
- Assert German output strings (e.g., `'Nachrichtenzusammenfassung'` instead of `'Message Summary'`, `'Kämpfe'` instead of `'Battles'`, etc.)
- Assert that `parsePreviousSummary` correctly identifies German summary messages (previously accumulated summaries) using the `📊` emoji anchor
- Test accumulation across two German summarize calls (for the accumulation test file)
- All test naming must follow the project convention: `whatIsTested_scenario_expectedOutcome` in English (test names remain English even though input/output is German)

**Files** (5 new files):

- `src/__tests__/integration/lib/MessageCache-summarization-de.test.ts`
- `src/__tests__/integration/lib/MessageCache-summary-accumulation-de.test.ts`
- `src/__tests__/integration/lib/MessageCache-build-summarization-de.test.ts`
- `src/__tests__/integration/lib/MessageCache-collection-summarization-de.test.ts`
- `src/__tests__/integration/lib/MessageCache-persistence-after-summarization-de.test.ts`

**Quality Requirements**: All 10 summarization test files (5 English + 5 German) must pass. No changes to the original 5 files.

---

### Goal 10: Tests

**Description**: Add unit tests for i18n infrastructure and verify migrated components.

**Quality Requirements**: Existing tests must continue to pass. New tests verify locale detection and string resolution.

#### Task 10.1: Test locale resolution logic

**Action**: Write unit tests for `src/i18n/request.ts` — verify it returns `'en'` when cookie is absent, returns valid locale when cookie is set, falls back to `'en'` for unknown locale values.

**Files**:

- `src/__tests__/unit/i18n/request.test.ts` — new file

---

#### Task 10.2: Test `set-locale` API route

**Action**: Write unit tests for the `POST /api/set-locale` route — verify valid locales are accepted, invalid locales are rejected, cookie is set correctly.

**Files**:

- `src/__tests__/unit/api/set-locale.test.ts` — new file

---

#### Task 10.3: Test `LocaleSwitcher` component

**Action**: Write UI tests for `LocaleSwitcher` — verify it renders EN/DE options, calls the API on selection, triggers refresh.

**Files**:

- `src/__tests__/ui/LocaleSwitcher.test.tsx` — new file

---

#### Task 10.4: Test email locale resolution

**Action**: Write unit tests for `getEmailStrings()` — verify English fallback when locale is `'en'` or unknown, German strings returned for `'de'`.

**Files**:

- `src/__tests__/unit/email/emailLocale.test.ts` — new file

---

## Dependencies

- `next-intl` ^3.x — primary i18n library (install via `npm install next-intl`)

---

## Arc42 Documentation Updates

**Proposed Changes**:

1. **Section 5 (Building Block View)**: Add `i18n Layer` as a cross-cutting concern — describe the `next-intl` provider, locale cookie, and translation file structure.
2. **Section 9 (Architecture Decisions)**: Document the decision to use cookie-based locale (not URL-prefix) and why it fits a login-gated game better.

---

## Architecture Notes

- **No App Router restructuring**: Cookie-based locale avoids moving all pages into `[locale]/` subdirectory. This is intentional for this project.
- **Server + Client components**: `next-intl` transparently supports both. Use `useTranslations()` in Client Components and `getTranslations()` in Server Components/API routes.
- **Canvas isolation**: Canvas renderers are pure TypeScript and cannot import React hooks. The string injection pattern (Goal 5) cleanly separates concerns without coupling the renderer to the i18n library.
- **Fallback strategy**: `next-intl` supports message fallback — if a German key is missing, it falls through to English. This prevents white-label bugs during incremental rollout.
- **Email locale**: Email is sent server-side; storing user locale preference in DB is deferred (see Open Questions). For now, email remains English.
- **Admin page**: Treating admin strings (Goal ~70 strings) as Phase 2 / out of scope for initial delivery. Admin is developer-only.

---

## Implementation Phases

| Phase       | Goals                           | Priority                                                               |
| ----------- | ------------------------------- | ---------------------------------------------------------------------- |
| **Phase 1** | Goals 1 (incl. 1.7+1.8), 2–3, 7 | Must-have: infrastructure + DB locale + core pages + language switcher |
| **Phase 2** | Goals 4–6                       | Should-have: secondary pages + formatting                              |
| **Phase 3** | Goals 8, 10                     | Nice-to-have: email + i18n infrastructure tests                        |
| **Phase 4** | Goals 12, then 11               | Server-side message localization first, then German summarization      |

**Phase 4 ordering**: Goal 12 must be done before Goal 11. The German regex patterns in `getMessagePatterns('de')` (Task 11.1) are derived from the German message templates defined in `getServerMessageStrings('de')` (Task 12.1). Implementing Goal 12 first ensures those templates exist for Goal 11 to mirror.

---

## Agent Decisions

- **Cookie + DB locale confirmed by human**: Cookie-only was the original decision but user requested DB storage so the server can generate messages in the user's language. The cookie mirrors the DB and is synced bi-directionally via login and `/api/set-locale`. The `[locale]` URL-prefix approach (requiring `src/app/[locale]/` restructure) is still rejected.
- **`next-intl` chosen over `react-i18next`**: Native Next.js App Router support, first-class server component support, TypeScript autocomplete for message keys, simpler setup.
- **Fallback to English**: Any missing `de.json` key silently renders its English equivalent instead of throwing. This allows incremental translation delivery.
- **Canvas strings injected, not imported**: Renderers cannot use React hooks. Injecting strings as a typed map from the React layer keeps renderers portable and testable.
- **API errors remain English (Phase 1)**: Server error messages require either a separate localization system for server code or error code-based client translation. Deferred to avoid over-engineering Phase 1.
- **Admin page deferred (Phase 2)**: Admin is a developer-only page; translating it is low ROI.
- **Email locale deferred**: Requires storing user language preference in the DB (`users` table). Not in scope for Phase 1 — using the "Adding New User Fields Pattern" from `doc/learnings.md` when implemented.
- **Summarize labels are server-side, not in `locales/*.json`**: The summary output labels live inside `MessageCache.ts` in a `getSummaryStrings(locale)` helper, not in the client-side translation JSON files. This is because `MessageCache` runs server-side and loading JSON locale files directly is simpler than wiring `next-intl`'s server-side getTranslations into a cache singleton.
- **Summary detection migrated from text-match to emoji anchor**: Changing `parsePreviousSummary` to use `📊` as the primary identifier (instead of `'Message Summary'`) makes it locale-agnostic without adding a hidden marker. This is the minimal change needed.
- **Input messages are locale-aware**: Because `preferred_locale` is now stored in the DB, the server CAN look up the user's locale at message-generation time. Goal 12 adds this capability to all four message-producing modules. This eliminates the technical debt of English-only messages.
- **Summarizer reads locale from DB, not cookie**: The summarize API route uses `user.preferredLocale` (from UserCache) rather than the `NEXT_LOCALE` cookie to ensure the parser uses the same locale that was active when messages were generated.

---

## Open Questions

_No open questions remain. All decisions resolved — see **Resolved Decisions** section above._

---

## Technical Debt Added

- **Battle messages per-user locale**: Each battle participant can have a different locale. The battle scheduler sends individual messages to each combatant using their locale. This is handled correctly in Goal 12. No residual debt.
