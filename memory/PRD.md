# Conoscenza Aperta - PRD

## Overview
Community mobile app (IT/EN) about personal & spiritual growth, quantum biophysics, meditation, oriental disciplines, naturopathy, psychology, integrative medicine, philosophy, nutrition, Somatognostica.

## Feature set
- **Auth**: phone (E.164) + password (bcrypt + JWT). IT/EN chosen at registration, changeable from Profilo → Lingua. Optional referral code.
- **12 categories** + Video + 13 seed articles + 3 seed audio/video + 15 videos imported from @SUMMAAUREA.
- **Home**: hero article + latest articles + **global search bar** across articles & media.
- **Library**: 2-col grid + horizontal category chips.
- **Media**: meditations & videos with kind filter + premium gating. Meditation categories (10, alphabetical): Amore e Gioia, Armonizzazione e Radicamento, Calma e Serenità, Concentrazione e Attenzione, Natura e Armonia, Perdono e Valore di Sè, Presenza e Ascolto Interiore, Ricarica energetica, Rilassamento e Sonno, Risveglio Dell'Anima.
- **Article detail**: editorial reading, Telegram/WhatsApp share, heart favorite, **comments** section.
- **Media detail**: heart favorite, **in-app audio player** (expo-audio) for meditation MP3 with pause/resume/±15s + auto-complete tracking; external Linking for YouTube videos; **PDF completion certificate** (expo-print).
- **Favorites**: personal list at Profilo → Preferiti.
- **Paywall**: 3 plans (12m preselected), **coupon input** with live discount preview.
- **Messages inbox**: broadcast + personal.
- **Profile**: badges, language toggle, favorites, **referral card** (gold code + count + Share button), upgrade CTA, admin entry, logout.
- **Admin panel**: Statistiche, Articoli (manual + AI 60-line summarize), Video/Med. (**+ file upload** via Emergent Object Storage, streaming upload via expo-file-system con progress bar), YouTube import (RSS/Data API), Pubblicità (5-sec banner every 10 min), Sconti (coupons), Messaggi, Utenti, Ordini.
- **Push notifications**: SuprSend relay via `/api/register-push`; new article/media/message triggers backend `send_push_bg`. Frontend has module-scope handlers, Android channel, tap listener + cold-start check.
- **Referral Program**: every user gets a unique `referral_code` (admin's = `MAESTRO-2026`). Registration accepts optional `referral_code`; the referrer's `referral_count` increments. Profile shows the code and invited count + share.
- **Subscription lifecycle emails (cron)**: daily APScheduler job at 09:00 Europe/Rome checks all users and:
  - 7 days before expiry (auto_renew=true) → email "il tuo abbonamento si rinnoverà tra 7 giorni"
  - 1 day before expiry (auto_renew=true) → email "domani si rinnova"
  - Expiry day + auto_renew=true → mock renewal (+12 months) + "grazie per aver rinnovato"
  - Expiry day + auto_renew=false → downgrade to free + purge_at = now+6mo + "grazie per il tempo insieme, dati salvati 6 mesi"
  - Purge job: after 6 months of non-renewal → wipes course progress (enrollments, quiz_attempts, certificates, favorites, completions, comments, views). Idempotent via `subscription.reminders_sent` map. Admin can trigger manually via `POST /api/admin/subscriptions/run-daily-job`.
- **Quiz — Pool casuale + lockout 15gg**: opzionale sul quiz di ogni corso. Admin carica un pool ampio (es. 15 domande) e imposta `questions_per_attempt` (es. 8) + `min_different_between_attempts` (es. 2). Ad ogni tentativo il sistema estrae randomicamente N domande dal pool, garantendo che almeno M siano diverse dal tentativo precedente. Nuovo endpoint `POST /courses/{id}/quiz-view/start-attempt` prepara l'estrazione persistente (page reload safe). Dopo 3 tentativi falliti scatta un lockout configurabile (default 15gg): l'utente vede una card "Ripassa il corso, riprova il {data}". Al termine del lockout riparte un ciclo pulito di 3 tentativi. Retrocompatibile: quiz senza pool config → funzionano come prima.
- **Quiz — Messaggio di buon auspicio al superamento**: admin può inserire un `success_wish_message` (max 1000 caratteri) sul quiz. Quando l'utente supera il quiz, il messaggio viene mostrato in una card decorativa (Georgia italic + glyph 🌱) tra il feedback band e il CTA certificato.
- **Media compression pipeline (upload)**: nuovo modulo `media_processor.py` invocato in `POST /api/admin/upload`. Ogni file caricato viene ricompresso prima di essere salvato su Emergent Object Storage:
  - Immagini (jpg/png/heic/…) → WebP q82, resize a max 1600px width (tipicamente -80/-95% peso)
  - Audio (mp3/wav/ogg/opus/…) → AAC 96kbps in .m4a (tipicamente -70/-90% peso)
  - Video (mp4/mov/webm/…) → H.264 720p CRF 24 + AAC 96k con `+faststart` (tipicamente -50/-70% peso)
  - Safe by design: se la compressione fallisce (input corrotto, codec strano, ffmpeg errore, o esito > originale) il file originale viene salvato. Toggle via env `MEDIA_COMPRESSION_DISABLED=1`.
  - `db.uploads` ora salva anche `original_size` per confronto/statistiche future.
- **HTTP cache aggressiva sui media**: `GET /api/files/{path}` risponde con `Cache-Control: public, max-age=31536000, immutable` + `ETag` + `Accept-Ranges: bytes`. Sicuro perché i path contengono UUID e non mutano mai. Supporta 304 Not Modified su conditional GET. Riduce ~60-70% di egress bandwidth dopo il primo download per utente.
- **Stripe integration (Emergent proxy)**: pagamenti reali attivi via `emergentintegrations.payments.stripe.checkout.StripeCheckout`:
  - Nuovo modulo `stripe_service.py`
  - Endpoint `/api/payments/stripe/config`, `.../checkout/subscription`, `.../checkout/course`, `.../session/{id}`, `.../webhook`
  - Flusso: paywall → crea order pending → chiama Stripe Checkout → apre URL con `expo-web-browser` → utente paga con carta Visa/MC/Amex → torna a `/payment-success` → verifica sessione + fulfillment idempotente
  - Corsi Premium: `POST /api/payments/stripe/checkout/course` con `{course_id, coupon_code, email}` → crea `course_orders` pending → Stripe Checkout → fulfillment auto-enrolla l'utente al corso al successo
  - Nuove pagine: `/payment-success` (con polling della session status), `/payment-cancel`
  - Idempotenza via `db.stripe_events` (event_id unique) e stato `orders/course_orders`
  - Note: usiamo one-time Checkout Session; il rinnovo annuale è gestito dal nostro APScheduler cron (invia email "Rinnova ora" 7gg prima della scadenza con link a nuova Checkout). Quando l'utente collegherà il suo account Stripe personale con chiavi reali, si potrà switchare al vero flow Subscription API con carta salvata.
- **Landing Gated per link condivisi**: nuovo componente `src/GatedLanding.tsx` e endpoint pubblici `/api/public/{meditation,course,article}/{id}` (senza auth). Quando un utente non loggato apre un link condiviso a un contenuto, vede:
  - Titolo, immagine cover, categoria, durata, descrizione breve (marketing)
  - Se corso Premium: prezzo
  - Card CTA "Registrati gratis" + "Ho già un account · Accedi"
  - Zero content leak: audio/video/body articolo/capitoli non vengono mai serviti a utenti non autenticati.
  - Le pagine `/media/[id]`, `/course/[id]`, `/article/[id]` rilevano lo stato guest via `auth.hasToken()` e mostrano `GatedLanding` invece di chiamare l'API protetta.
- **Share button + Open Graph rich previews**:
  - Nuovo endpoint backend `GET /api/share/{meditation|course|article}/{id}` che serve HTML con meta tag `og:*` + `twitter:*` + Schema.org JSON-LD. Crawler-friendly (WhatsApp/Telegram/Facebook/Slack/iMessage) leggono i meta tag prima del redirect JS. Human visitor viene ridiretto alla pagina reale dell'app dopo ~150ms.
  - Nuovo componente frontend `src/ShareButton.tsx`. Su iOS/Android usa `Share.share()` nativo; su web usa `navigator.share` se disponibile, altrimenti apre un modal con WhatsApp, Telegram, Facebook, X/Twitter, Email + Copia link (via `expo-clipboard`).
  - Pulsante ↗ integrato nell'header di `/media/[id]`, `/course/[id]`, `/article/[id]` (accanto al preferito).
  - URL condivisi sono `/api/share/{type}/{id}` così i social ricevono il preview e i click reindirizzano alla vera app.

## Integrations
- Emergent LLM key (GPT-4o-mini) for article AI summarization
- Emergent Object Storage for file uploads (verified working)
- Emergent Push (SuprSend) — delivery after native build + Firebase google-services.json for Android
- YouTube RSS (15 latest); Data API v3 optional via YOUTUBE_API_KEY
- **Stripe** (Emergent proxy, test key) — subscription 12€/yr + premium course purchases; end-to-end tested 29/09/2026 (real payment `4242 4242 4242 4242` → order `ORD-1790648922` activated, receipt email delivered). Redirect URL now uses `APP_PUBLIC_URL` (bug fixed: previously fell back to localhost).
- **Resend** (Emergent managed) — order receipts + verification emails + subscription reminders (cron)

## Backend architecture
Refactored from 3495-line monolith `server.py` into **10 modules** (29/09/2026):
- `server.py` (266 lines): app init, startup/shutdown, wire routers
- `deps.py`: shared Mongo client, JWT, auth deps, password hashing, user shaping
- `constants.py`: CATEGORIES, MEDITATION_CATEGORIES, VIDEO_CATEGORIES, PLANS, ALLOWED_MIME
- `models.py`: all Pydantic request/response models
- `storage.py`: Emergent Object Storage init/put/get
- `push.py`: SuprSend push wrapper
- `serializers.py`: article/media/playlist serializers + OG HTML template
- `routes_auth.py` (9), `routes_users.py` (22), `routes_admin.py` (13), `routes_articles.py` (7), `routes_media.py` (23), `routes_payments.py` (12), `routes_share.py` (6)
- Plus existing `routes_courses.py`, `routes_support.py`
- Total: **135 endpoints** across 10 domains, factory pattern with shared deps

## Meditation categories (12)
Amore e Gioia, Armonizzazione e Radicamento, Autostima, Calma e Serenità, Concentrazione e Attenzione, Natura, Perdono, Presenza e Ascolto Interiore, Ricarica energetica, Rilassamento, Risveglio Dell'Anima, Sonno.
All with hero image on Object Storage + poetic description + "A cosa serve" bullets.

## Video categories (6, alphabetical)
Fisica Quantistica, Psicologia e Neuroscienze, Coscienza e Spiritualità, Medicina Complementare, Somatognostica (image: SSC — cardiocentric field), Discipline Naturali e Orientali. (Interviste rimossa 29/09/2026).

## Content
- Articles: 62 total (as of latest seed)
- Latest seed batch: 17 articles from genitorievoluti.it (Psicologia/Naturopatia/Crescita personale). Each ~1200-1650 words, LLM-rewritten with fresh titles, "Metodo Cosmo" → "Metodo Summa Aurea", themed Unsplash images. Script: `/app/backend/seed_genitori_articles.py`.

## Test credentials
See `/app/memory/test_credentials.md`
