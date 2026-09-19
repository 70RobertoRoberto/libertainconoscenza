# Conoscenza Aperta - PRD

## Overview
Community mobile app (IT/EN) about personal & spiritual growth, quantum biophysics, meditation, oriental disciplines, naturopathy, psychology, integrative medicine, philosophy, nutrition, Somatognostica.

## Users
- **Free**: browse non-premium articles, meditations, videos across 12 categories
- **Premium**: 3/6/12 month plans (€300/€500/€900), coupon discounts supported
- **Admin (owner)**: manages content, users, messages, ads, coupons, YouTube import; sees stats

## Features implemented
- **Auth**: phone (E.164) + password (bcrypt + JWT). Language chosen at registration (IT/EN, changeable from Profile → Lingua).
- **12 categories** + **Video**, preloaded with 13 divulgative articles + 3 seed audio/video + 15 YouTube videos.
- **Home / Library / Media** browsing with category chips and premium gating.
- **Article detail**: editorial reading view + Telegram/WhatsApp share + heart favorite button.
- **Media detail**: opens media URL via Linking (external YT/MP3 or backend-hosted /api/files/...) + heart favorite button.
- **Favorites**: heart toggle on any article/media, personal list at Profilo → Preferiti.
- **Paywall**: 3 plans (12m preselected "Miglior valore"), coupon input with live discount preview and struck-through prices.
- **Messages inbox**: broadcast + personal messages from admin, mark as read.
- **Profile**: name, phone, badges, language toggle, upgrade CTA, admin panel entry, favorites entry, logout.
- **Admin panel** (in-app, also web):
  - Statistiche: users/premium/articles/media/views + 14-day daily views bar chart + top articles/media.
  - Articoli: manual create OR AI summarize from URL (GPT-4o-mini, up to 60 lines).
  - Video/Meditazioni: manual create + **file upload** (Emergent Object Storage) via `expo-document-picker`.
  - YouTube: import last 15 videos from any channel URL via RSS (full archive via Data API v3 when `YOUTUBE_API_KEY` is set).
  - Pubblicità (Ads): banner overlays shown for 5 seconds every 10 minutes of usage.
  - **Sconti (Coupons)**: create promo codes (percent_off, max_uses, optional expiry); usage tracked.
  - Messaggi: broadcast or personal (triggers push notification).
  - Utenti / Ordini: user list; activate pending subscription orders.
- **Push notifications**: Emergent-managed (SuprSend relay).
  - `_layout.tsx` has module-scope handlers, Android channel, tap listener + cold-start check.
  - Device token registered via `/api/register-push` after login / on app open.
  - Backend fires push on new article, new media, new message (fire-and-forget, non-blocking).

## Bilingual (i18n)
- Italian & English via `src/i18n.ts`, chosen at registration, switchable from Profile.

## Integrations
- **Emergent LLM key**: GPT-4o-mini via `emergentintegrations` for article summarization.
- **Emergent Object Storage**: verified working in preview; used for admin uploads.
- **Emergent Push (SuprSend)**: `/api/register-push` + `send_push_bg` helper; delivery requires deployed build.
- **Stripe test key**: `sk_test_emergent` (pending-order pattern until production key added).
- **YouTube RSS**: no API key needed for last 15 videos per channel.

## Tech stack
- **Frontend**: Expo SDK 57, expo-router, React Query, expo-notifications, expo-document-picker, expo-file-system, expo-linear-gradient, expo-secure-store.
- **Backend**: FastAPI + Motor + bcrypt + PyJWT + httpx + requests + emergentintegrations.
- **Storage**: MongoDB (users, articles, media, messages, views, orders, ads, favorites, coupons, uploads).
- **Theme**: dark editorial luxury (deep forest #0A0F0D + gold #D4AF37) from `src/theme.ts`.

## Seeded content
- 13 Italian articles across all categories.
- 3 seed media items (2 SoundHelix MP3 meditations, 1 YouTube).
- 15 YouTube videos imported from @SUMMAAUREA channel.
- Admin: +393331234567 / Admin2026!

## Test credentials
See `/app/memory/test_credentials.md`

## Known limitations
- Real Stripe checkout flow deferred (pending-order pattern).
- YouTube Data API v3 not connected (user opted to skip); RSS limit = 15 videos per channel.
- Push notifications require deployed build + Firebase `google-services.json` for Android.
- Direct file uploads work in preview but rely on Emergent Object Storage credits.
