"""
Emergent-managed Resend integration.

Public helper: `send_email(to, subject, html, reply_to=None)`.

If EMERGENT_EMAIL_KEY is missing or empty (typical during preview before the
first deploy), the function LOGS the payload and returns None WITHOUT raising —
so ticket/order/certificate flows never break when email is not yet provisioned.

Also exposes helpers to render the templates used across the app.
"""
from __future__ import annotations

import os
import re
import ipaddress
import logging
import httpx
from html import escape
from html.parser import HTMLParser
from urllib.parse import urlparse
from typing import Optional

from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)

EMAIL_BASE_URL = "https://integrations.emergentagent.com"
EMAIL_KEY = os.environ.get("EMERGENT_EMAIL_KEY") or ""
EMAIL_FROM_NAME = os.environ.get("EMAIL_FROM_NAME") or "Libertà in Conoscenza"
EMAIL_REPLY_TO = os.environ.get("EMAIL_REPLY_TO") or ""

# ----------------------------------------------------------------------------
# Safety gate (from Emergent Resend playbook)
# ----------------------------------------------------------------------------
_SHORTENERS = ("bit.ly", "tinyurl.com", "t.co", "is.gd", "cutt.ly", "goo.gl", "rebrand.ly")
_CRED_ASK = (
    "reply with your password", "reply with the code", "send your password", "cvv",
    "send us your password", "enter your password below", "confirm your card number",
    "your full card number", "seed phrase", "recovery phrase", "verify your card",
    "social security number", "confirm your bank details",
)
_HOSTISH = re.compile(r"\b(?:https?://)?((?:[a-z0-9-]+\.)+[a-z]{2,})", re.I)


def _host_ok(host: str) -> bool:
    if not host or "xn--" in host:
        return False
    try:
        ipaddress.ip_address(host)
        return False
    except ValueError:
        pass
    return not any(host == s or host.endswith("." + s) for s in _SHORTENERS)


def _same_site(shown: str, real: str) -> bool:
    return shown == real or real.endswith("." + shown) or shown.endswith("." + real)


class _EmailScan(HTMLParser):
    def __init__(self):
        super().__init__()
        self.tags, self.urls, self.anchors = set(), [], []
        self._href, self._text = None, []

    def handle_starttag(self, tag, attrs):
        self.tags.add(tag.lower())
        self.urls += [v for k, v in attrs if k.lower() in ("href", "src") and v]
        if tag.lower() == "a":
            self._href = dict((k.lower(), v) for k, v in attrs).get("href")
            self._text = []

    def handle_data(self, data):
        if self._href is not None:
            self._text.append(data)

    def handle_endtag(self, tag):
        if tag.lower() == "a" and self._href is not None:
            self.anchors.append((self._href, "".join(self._text)))
            self._href, self._text = None, []


def _assert_safe_email(subject: str, html: str) -> None:
    scan = _EmailScan()
    scan.feed(html)
    if scan.tags & {"form", "input", "textarea", "select"}:
        raise ValueError("No forms or input fields in email (G2)")
    body = f"{subject}\n{html}".lower()
    for p in _CRED_ASK:
        if p in body:
            raise ValueError(f"Email asks the recipient for credentials: {p!r} (G2)")
    for url in scan.urls:
        low = url.strip().lower()
        if low.startswith(("mailto:", "tel:", "cid:", "#")):
            continue
        if not low.startswith("https://"):
            raise ValueError(f"Email links/assets must be absolute https: {url!r} (G3)")
        host = urlparse(low).hostname or ""
        if not _host_ok(host) or urlparse(low).username is not None:
            raise ValueError(f"Shortened, numeric-host or credential-bearing URL: {url!r} (G3)")
    for href, text in scan.anchors:
        real = urlparse(href.strip().lower()).hostname or ""
        if not real:
            continue
        for m in _HOSTISH.finditer(text):
            if not _same_site(m.group(1).lower(), real):
                raise ValueError(f"Anchor text {m.group(1)!r} ≠ real link host {real!r} (G3)")


# ----------------------------------------------------------------------------
# Send helper
# ----------------------------------------------------------------------------
async def send_email(*, to: str, subject: str, html: str, reply_to: Optional[str] = None) -> Optional[str]:
    if not to or "@" not in to:
        logger.warning(f"send_email skipped: invalid recipient {to!r}")
        return None
    _assert_safe_email(subject, html)
    # Preview / dev fallback — never break app flows if key is missing
    if not EMAIL_KEY or EMAIL_KEY.startswith("placeholder"):
        logger.info(f"[EMAIL DEV] to={to} subject={subject!r} (key not set, skipping actual send)")
        return None
    payload = {
        "to": [to],
        "subject": subject,
        "html": html,
        "from_name": EMAIL_FROM_NAME,
    }
    rt = reply_to or EMAIL_REPLY_TO
    if rt:
        payload["contact_email"] = rt
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{EMAIL_BASE_URL}/api/v1/email/send",
                headers={"X-Email-Key": EMAIL_KEY},
                json=payload,
            )
        resp.raise_for_status()
        return resp.json().get("id")
    except httpx.HTTPStatusError as e:
        logger.error(f"Email send failed: {e.response.status_code} {e.response.text}")
        return None
    except Exception as e:
        logger.error(f"Email send error: {e}")
        return None


# ----------------------------------------------------------------------------
# Templates (server-side, never accept caller HTML)
# ----------------------------------------------------------------------------
_APP_NAME = "Libertà in Conoscenza"
_BRAND_COLOR = "#c9a24f"
_FOOTER = (
    f'<p style="font-size:11px;color:#888;margin-top:24px;line-height:1.5">'
    f'Email inviata da {escape(_APP_NAME)} — Istituto di Bioenergia, Via Bilianusaldu snc, '
    f'07021 Arzachena (SS), P.IVA 02862510902. '
    f'Non chiediamo mai password, codici di accesso o dati di pagamento via email.'
    f'</p>'
)


def _wrap(inner: str) -> str:
    return (
        f'<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0e1512">'
        f'<tr><td align="center" style="padding:24px">'
        f'<table role="presentation" width="600" cellspacing="0" cellpadding="0" '
        f'style="max-width:600px;width:100%;background:#151E1A;border:1px solid #222D28;border-radius:12px">'
        f'<tr><td style="padding:24px;font-family:Georgia,serif;color:#F0F0EA;line-height:1.55">'
        f'<h1 style="margin:0 0 12px 0;color:{_BRAND_COLOR};font-size:20px">{escape(_APP_NAME)}</h1>'
        f'{inner}'
        f'{_FOOTER}'
        f'</td></tr></table></td></tr></table>'
    )


def render_ticket_created(user_name: str, ticket_no: str, subject: str, message: str) -> tuple[str, str]:
    subj = f"[{ticket_no}] Ho ricevuto la tua richiesta di assistenza"
    body = _wrap(
        f'<p>Ciao <strong>{escape(user_name or "utente")}</strong>,</p>'
        f'<p>Grazie per averci scritto. La tua richiesta è stata registrata con il numero '
        f'<strong style="color:{_BRAND_COLOR}">#{escape(ticket_no)}</strong>.</p>'
        f'<p style="margin-top:16px"><strong>Oggetto:</strong> {escape(subject)}</p>'
        f'<p style="background:#0e1512;border:1px solid #222D28;border-radius:8px;padding:12px;'
        f'font-size:13px;color:#B8B8AE;white-space:pre-line">{escape(message)}</p>'
        f'<p>Ti risponderemo il prima possibile. Puoi consultare lo stato della richiesta nella sezione '
        f'<em>Assistenza</em> del tuo profilo nell&#39;app.</p>'
    )
    return subj, body


def render_ticket_admin_reply(user_name: str, ticket_no: str, subject: str, reply_text: str) -> tuple[str, str]:
    subj = f"[{ticket_no}] Nuova risposta dall'assistenza"
    body = _wrap(
        f'<p>Ciao <strong>{escape(user_name or "utente")}</strong>,</p>'
        f'<p>Abbiamo pubblicato una nuova risposta alla tua richiesta '
        f'<strong style="color:{_BRAND_COLOR}">#{escape(ticket_no)}</strong> '
        f'&ldquo;{escape(subject)}&rdquo;.</p>'
        f'<p style="background:#0e1512;border:1px solid #222D28;border-radius:8px;padding:12px;'
        f'font-size:13px;color:#B8B8AE;white-space:pre-line">{escape(reply_text)}</p>'
        f'<p>Apri l&#39;app nella sezione <em>Assistenza</em> per leggere la risposta completa e continuare la conversazione.</p>'
    )
    return subj, body


def render_order_receipt(user_name: str, plan_label: str, amount_eur: int, order_no: str, expires_iso: str | None = None) -> tuple[str, str]:
    subj = f"Ricevuta ordine {order_no} — {plan_label}"
    ex_line = ""
    if expires_iso:
        try:
            from datetime import datetime
            d = datetime.fromisoformat(expires_iso.replace("Z", "+00:00"))
            ex_line = f'<p><strong>Valido fino al:</strong> {d.strftime("%d/%m/%Y")}</p>'
        except Exception:
            pass
    body = _wrap(
        f'<p>Ciao <strong>{escape(user_name or "utente")}</strong>,</p>'
        f'<p>Grazie! Il tuo ordine è stato registrato correttamente.</p>'
        f'<table role="presentation" width="100%" style="margin:16px 0"><tr>'
        f'<td style="padding:8px 0"><strong>Numero ordine:</strong></td>'
        f'<td align="right" style="color:{_BRAND_COLOR}">#{escape(order_no)}</td></tr>'
        f'<tr><td style="padding:8px 0"><strong>Piano:</strong></td>'
        f'<td align="right">{escape(plan_label)}</td></tr>'
        f'<tr><td style="padding:8px 0"><strong>Importo:</strong></td>'
        f'<td align="right">€ {amount_eur}</td></tr></table>'
        f'{ex_line}'
        f'<p style="font-size:13px;color:#B8B8AE">Il tuo accesso Premium è ora attivo. '
        f'Se hai domande sulla fatturazione, puoi rispondere direttamente a questa email.</p>'
    )
    return subj, body


def render_certificate_issued(user_name: str, course_title: str, score_percent: int) -> tuple[str, str]:
    subj = f"🏆 Complimenti! Hai conseguito il certificato — {course_title}"
    body = _wrap(
        f'<p>Ciao <strong>{escape(user_name or "utente")}</strong>,</p>'
        f'<p>Ottimo lavoro! Hai superato l&#39;esame finale del corso '
        f'<strong>{escape(course_title)}</strong> con un punteggio di '
        f'<strong style="color:{_BRAND_COLOR}">{int(score_percent)}%</strong>.</p>'
        f'<p>Il tuo attestato è disponibile nella sezione <em>I miei Certificati</em> del tuo profilo nell&#39;app, '
        f'da dove puoi anche scaricarlo in formato PDF.</p>'
        f'<p style="font-size:12px;color:#B8B8AE;margin-top:16px">'
        f'L&#39;attestato è un documento privato: attesta il superamento dell&#39;esame ma non ha valore '
        f'di qualifica professionale regionale.'
        f'</p>'
    )
    return subj, body


def render_subscription_reminder(user_name: str, expires_iso: str, days_left: int) -> tuple[str, str]:
    subj = f"Il tuo abbonamento scade tra {days_left} giorni"
    from datetime import datetime
    try:
        d = datetime.fromisoformat(expires_iso.replace("Z", "+00:00")).strftime("%d/%m/%Y")
    except Exception:
        d = expires_iso
    body = _wrap(
        f'<p>Ciao <strong>{escape(user_name or "utente")}</strong>,</p>'
        f'<p>Ti ricordiamo che il tuo abbonamento annuale scadrà il '
        f'<strong style="color:{_BRAND_COLOR}">{escape(d)}</strong> (fra {days_left} giorni).</p>'
        f'<p>Il rinnovo automatico è attivo: nulla da fare da parte tua. '
        f'Se preferisci disdirlo, apri l&#39;app e vai su <em>Profilo → Abbonamento Premium → Disdici rinnovo automatico</em>.</p>'
        f'<p style="font-size:12px;color:#B8B8AE">Puoi disdire fino a 24 ore prima della scadenza; il tuo accesso Premium resterà attivo fino al giorno indicato.</p>'
    )
    return subj, body
