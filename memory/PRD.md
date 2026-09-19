# Conoscenza Aperta - PRD

## Overview
Community mobile app (IT/EN) about personal & spiritual growth, quantum biophysics, meditation, oriental disciplines, naturopathy, psychology, integrative medicine, philosophy, nutrition, Somatognostica.

## Users
- **Free**: browse non-premium articles, meditations, videos across 12 categories
- **Premium**: 3/6/12 month plans (€300/€500/€900)
- **Admin (owner)**: manages content, users, messages, ads, and sees stats

## Features implemented
- **Auth**: phone (E.164) + password (bcrypt + JWT). Language chosen at registration (IT/EN, changeable from Profile → Lingua).
- **12 categories** + **Video**, preloaded with 13 divulgative articles + 3 seed audio/video.
- **Home feed**: hero article + latest articles.
- **Library**: 2-column grid + horizontal category chips.
- **Media**: meditations & videos with kind filter; premium gating on backend.
- **Article detail**: editorial reading view + Telegram/WhatsApp share (Linking).
- **Media detail**: opens media URL via Linking (SoundHelix MP3 or YouTube link).
- **Paywall**: 3 plans, 12m preselected with "Miglior valore" badge, creates a pending order.
- **Messages inbox**: broadcast + personal messages, mark as read.
- **Profile**: name, phone, badges, language toggle, upgrade CTA, admin panel entry, logout.
- **Admin panel** (in-app, also web):
  - Statistiche: users/premium/articles/media/views + 14-day daily views bar chart + top articles/media.
  - Articoli: manual create OR AI summarize from URL (GPT-4o-mini, up to 60 lines); delete.
  - Video/Meditazioni: create with URL + thumbnail + duration + premium; delete.
  - **YouTube**: import last 15 videos from any YouTube channel URL (parses channel externalId → RSS feed); duplicate media_url skipped.
  - **Pubblicità (Ads)**: create banner ads (image + caption + optional click URL), toggle active, delete. Ads shown to users as 5-second overlay every 10 minutes of app usage (`AdOverlay` in `_layout.tsx`).
  - Messaggi: broadcast or personal.
  - Utenti: list all users with subscription status.
  - Ordini: activate pending subscription orders.

## Bilingual (i18n)
- Italian & English strings via `src/i18n.ts`.
- Language chosen at registration (default IT); switchable anytime from Profilo → Lingua.
- Persisted in SecureStore (native) / localStorage (web).

## Integrations
- **Emergent LLM key**: GPT-4o-mini via `emergentintegrations` for article summarization.
- **Stripe test key**: `sk_test_emergent` (pending-order pattern until production key added).
- **Push tokens endpoint**: `/api/me/push-token` scaffolded (native flow deferred to deployed build).
- **YouTube channel RSS**: no API key needed, parses public feed for last 15 videos.

## Tech stack
- **Frontend**: Expo SDK 57, expo-router, React Query, react-native-safe-area-context, expo-linear-gradient, expo-secure-store, expo-notifications/device/document-picker/file-system (installed for future push + upload flows).
- **Backend**: FastAPI + Motor + bcrypt + PyJWT + emergentintegrations + httpx + requests.
- **Storage**: MongoDB (users, articles, media, messages, views, orders, ads, favorites (scaffolded), coupons (scaffolded)).
- **Theme**: dark editorial luxury (deep forest #0A0F0D + gold #D4AF37) from `src/theme.ts`.

## Seeded content
- 13 Italian articles across all categories.
- 3 seed media items (2 meditation MP3 via SoundHelix, 1 YouTube video).
- 15 YouTube videos imported from @SUMMAAUREA channel.
- Admin: +393331234567 / Admin2026!

## Test credentials
See `/app/memory/test_credentials.md`

## Known limitations / next steps
- Real Stripe checkout flow (currently pending-order pattern).
- Direct push send from admin panel (endpoint scaffolded; requires native build for delivery).
- Direct file upload for admin media (endpoints prepared, UI to be wired).
- Favorites & coupons endpoints designed but UI not yet exposed.
- YouTube import limited to last 15 videos per channel (RSS limitation); full backlog needs YouTube Data API v3 key.
