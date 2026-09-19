# Conoscenza Aperta - PRD

## Overview
Community mobile app in Italian & English about personal & spiritual growth, quantum biophysics, meditation, oriental disciplines, naturopathy, psychology, integrative medicine, philosophy, nutrition, Somatognostica.

## Users
- **Free (default on install)**: browse non-premium articles, meditations, videos across 12 categories.
- **Premium subscribers**: 3/6/12 month plans (€300/€500/€900).
- **Admin (owner)**: single admin manages content, users, messages and sees stats.

## Features implemented
- **Auth**: phone (E.164) + password with bcrypt + JWT. Language chosen at registration (IT/EN).
- **12 categories** + **Video** category, all preloaded with 13 AI-style summaries from summaaurea.org, scienzebiofisiche.it, somatognostica.it.
- **Home feed**: hero article + latest articles list with cover images.
- **Library**: grid of articles, horizontal chip filter by category.
- **Media**: meditations & videos with kind chip filter; premium gating on backend.
- **Article detail**: editorial reading view with Telegram & WhatsApp share buttons (Linking).
- **Media detail**: opens external media URL (YouTube / mp3 / mp4).
- **Paywall**: 3 plans, 12m preselected with "Miglior valore" badge, creates a pending order.
- **Messages inbox**: user sees broadcast + personal messages; mark as read.
- **Profile**: name, phone, premium/admin badges, language toggle IT/EN, upgrade CTA, admin panel entry, logout.
- **Admin panel** (in-app for admin users, also renders on web):
  - Statistics dashboard: users/premium/articles/media/total-views counters + daily views bar chart (last 14 days) + top articles/media by views.
  - Article management: manual create OR AI summarize from URL (GPT-5.4-mini via Emergent LLM key), category picker, premium toggle, delete.
  - Media management: create meditation/video with URL + thumbnail + duration + premium, delete.
  - Messages: send broadcast or personal message to any user.
  - Users list: see all users with subscription status.
  - Orders: activate pending subscription orders manually.

## Bilingual (i18n)
- Italian & English strings for auth flow, tabs, paywall, profile, messages.
- Language chosen at registration (default IT); switch anytime from Profilo → Lingua.
- Stored in SecureStore (native) / localStorage (web).
- Category canonical names stay in Italian (with EN labels via CATEGORY_LABELS map for future frontend expansion).

## Integrations
- **Emergent LLM key**: GPT-4o-mini via `emergentintegrations` for admin article summarization.
- **Stripe test key**: available as `sk_test_emergent` for future real payment activation; current MVP records pending orders that admin activates manually.
- **Push tokens**: endpoint `/api/me/push-token` ready (client integration deferred until real device build).

## Tech stack
- **Frontend**: Expo SDK 57, expo-router, React Query, react-native-safe-area-context, expo-linear-gradient, expo-secure-store.
- **Backend**: FastAPI, Motor (async Mongo), bcrypt, PyJWT, emergentintegrations.
- **Storage**: MongoDB (users, articles, media, messages, views, orders).
- **Theme**: dark editorial luxury (deep forest #0A0F0D + gold #D4AF37 accents) from `src/theme.ts`, no purple/blue.

## Seeded content
- 13 divulgative articles across all categories (Italian).
- 3 media items (2 meditations audio, 1 YouTube video, 1 premium meditation).
- Admin pre-provisioned at +393331234567 / Admin2026!

## Known limitations / next steps
- Real Stripe checkout flow (currently pending-order pattern).
- Push notifications sending (requires native build & Emergent push key deploy).
- Full EN translation of category filter chips inside Library/Media screens (uses IT names).
- Direct file uploads to Object Storage (currently accepts external URLs).
