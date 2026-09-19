# Conoscenza Aperta - PRD

## Overview
Community mobile app (IT/EN) about personal & spiritual growth, quantum biophysics, meditation, oriental disciplines, naturopathy, psychology, integrative medicine, philosophy, nutrition, Somatognostica.

## Feature set
- **Auth**: phone (E.164) + password (bcrypt + JWT). IT/EN chosen at registration, changeable from Profilo → Lingua. Optional referral code.
- **12 categories** + Video + 13 seed articles + 3 seed audio/video + 15 videos imported from @SUMMAAUREA.
- **Home**: hero article + latest articles + **global search bar** across articles & media.
- **Library**: 2-col grid + horizontal category chips.
- **Media**: meditations & videos with kind filter + premium gating.
- **Article detail**: editorial reading, Telegram/WhatsApp share, heart favorite, **comments** section.
- **Media detail**: heart favorite, **in-app audio player** (expo-audio) for meditation MP3 with pause/resume/±15s + auto-complete tracking; external Linking for YouTube videos; **PDF completion certificate** (expo-print).
- **Favorites**: personal list at Profilo → Preferiti.
- **Paywall**: 3 plans (12m preselected), **coupon input** with live discount preview.
- **Messages inbox**: broadcast + personal.
- **Profile**: badges, language toggle, favorites, **referral card** (gold code + count + Share button), upgrade CTA, admin entry, logout.
- **Admin panel**: Statistiche, Articoli (manual + AI 60-line summarize), Video/Med. (**+ file upload** via Emergent Object Storage), YouTube import (RSS/Data API), Pubblicità (5-sec banner every 10 min), Sconti (coupons), Messaggi, Utenti, Ordini.
- **Push notifications**: SuprSend relay via `/api/register-push`; new article/media/message triggers backend `send_push_bg`. Frontend has module-scope handlers, Android channel, tap listener + cold-start check.
- **Referral Program**: every user gets a unique `referral_code` (admin's = `MAESTRO-2026`). Registration accepts optional `referral_code`; the referrer's `referral_count` increments. Profile shows the code and invited count + share.

## Integrations
- Emergent LLM key (GPT-4o-mini) for article AI summarization
- Emergent Object Storage for file uploads (verified working)
- Emergent Push (SuprSend) — delivery after native build + Firebase google-services.json for Android
- YouTube RSS (15 latest); Data API v3 optional via YOUTUBE_API_KEY

## Test credentials
See `/app/memory/test_credentials.md`
