"""Shared constants used across the app."""
APP_NAME = "conoscenza-aperta"

CATEGORIES = [
    "Crescita personale",
    "Spirituale",
    "Fisica quantistica",
    "Meditazione",
    "Discipline orientali",
    "Naturopatia",
    "Psicologia",
    "Medicina Integrata",
    "Filosofia",
    "Nutrizione",
    "Somatognostica",
    "Coscienza",
    "Tradizioni Esoteriche",
    "Guarigione Energetica",
    "Video",
]

# Meditation-specific subcategories (alphabetical). Used when kind == "meditation".
MEDITATION_CATEGORIES = [
    "Amore e Gioia",
    "Armonizzazione e Radicamento",
    "Autostima",
    "Calma e Serenità",
    "Concentrazione e Attenzione",
    "Natura",
    "Perdono",
    "Presenza e Ascolto Interiore",
    "Ricarica energetica",
    "Rilassamento",
    "Risveglio Dell'Anima",
    "Sonno",
]

VIDEO_CATEGORIES = [
    "Fisica Quantistica",
    "Psicologia e Neuroscienze",
    "Coscienza e Spiritualità",
    "Medicina Complementare",
    "Somatognostica",
    "Discipline Naturali e Orientali",
]

VIDEO_CATEGORY_SLUGS = {
    "Fisica Quantistica": "fisica-quantistica",
    "Psicologia e Neuroscienze": "psicologia-neuroscienze",
    "Coscienza e Spiritualità": "coscienza-spiritualita",
    "Medicina Complementare": "medicina-complementare",
    "Somatognostica": "somatognostica",
    "Discipline Naturali e Orientali": "discipline-naturali-orientali",
}

PLANS = {
    "12m": {"days": 365, "months": 12, "price_eur": 12, "label": "12 Mesi"},
}

TRIAL_DAYS = 15

ALLOWED_MIME = {
    # Audio (broad support for phone recorders: m4a, amr, 3gpp, opus, flac, etc.)
    "audio/mpeg", "audio/mp3",
    "audio/mp4", "audio/x-m4a", "audio/m4a",
    "audio/wav", "audio/x-wav", "audio/wave",
    "audio/ogg", "audio/opus",
    "audio/aac", "audio/x-aac",
    "audio/amr", "audio/3gpp", "audio/3gpp2",
    "audio/flac", "audio/x-flac",
    "audio/webm",
    "application/octet-stream",  # some phones send generic mime for recordings
    # Video
    "video/mp4", "video/quicktime", "video/webm", "video/3gpp",
    # Images
    "image/jpeg", "image/png", "image/webp",
}
