"""Generate custom images with Gemini Nano Banana for 6 specific citation articles,
upload each to Emergent Object Storage, and update the article's image_url.

Article title -> theme prompt mapping is defined below.
"""

import asyncio
import base64
import os
import re
import sys
import uuid
from datetime import datetime, timezone

import requests
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv("/app/backend/.env")

# Storage constants (mirroring server.py)
INTEGRATION_PROXY_URL = os.environ.get("INTEGRATION_PROXY_URL", "https://integrations.emergentagent.com")
STORAGE_URL = INTEGRATION_PROXY_URL.rstrip("/") + "/objstore/api/v1/storage"
EMERGENT_LLM_KEY = os.environ["EMERGENT_LLM_KEY"]
MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]

_storage_key = None


def init_storage() -> str:
    global _storage_key
    if _storage_key:
        return _storage_key
    r = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_LLM_KEY}, timeout=30)
    r.raise_for_status()
    _storage_key = r.json()["storage_key"]
    return _storage_key


def put_object(path: str, data: bytes, content_type: str) -> dict:
    global _storage_key
    key = init_storage()
    for attempt in range(2):
        r = requests.put(
            f"{STORAGE_URL}/objects/{path}",
            headers={"X-Storage-Key": key, "Content-Type": content_type},
            data=data,
            timeout=300,
        )
        if r.status_code == 503 and attempt == 0:
            _storage_key = None
            key = init_storage()
            continue
        r.raise_for_status()
        return r.json()
    raise RuntimeError("upload failed")


# --- Prompts and title matches ---
JOBS = [
    {
        "match": "architettura interiore della guarigione",
        "prompt": (
            "A serene image of meditation: a person sitting cross-legged in silent contemplation "
            "at sunrise, soft golden light around, subtle inner glow at heart center, "
            "minimalist and peaceful, warm cinematic tones, photorealistic, no text."
        ),
    },
    {
        "match": "eterno presente della",
        "prompt": (
            "A minimalist and elegant Taoist Yin-Yang (Tao) symbol at the center of the frame, "
            "hand-drawn black ink on soft warm paper background, subtle golden glow surrounding it, "
            "symbolic and sacred, no text, no faces, artistic mystical composition, photorealistic parchment texture."
        ),
    },
    {
        "match": "divino come danza evolutiva",
        "prompt": (
            "Breathtaking natural landscape at golden hour: a lush green valley with a winding river, "
            "wildflowers in the foreground, snow-capped mountains in the distance, dramatic sky with "
            "warm sunset light, cinematic, photorealistic, sense of sacred beauty of nature, no text, no people."
        ),
    },
    {
        "match": "dalla cellula allo spirito",
        "prompt": (
            "A luminous double helix of DNA glowing with divine light, spiraling upward through a dark cosmic "
            "background, bioluminescent blue-violet strands, particles of light floating around, "
            "sacred science aesthetic, photorealistic 3D render, no text."
        ),
    },
    {
        "match": "quando il sapere abbraccia il sentire",
        "prompt": (
            "A person in soft warm light holding an old leather-bound antique book pressed lovingly to their "
            "chest over the heart, eyes closed in gratitude, sepia and warm tones, cinematic depth of field, "
            "photorealistic, evocative and intimate, no text."
        ),
    },
    {
        "match": "incarnazione dell'essere",
        "prompt": (
            "A single beam of golden divine light descending vertically from a starry cosmic sky above onto a "
            "silhouetted human figure standing on the earth below, arms slightly open in reverence, "
            "misty landscape at dawn, sacred and cinematic, photorealistic, no text."
        ),
    },
    {
        "match": "architettura vivente dell'essere",
        "prompt": (
            "A scientific and mystical visualization of biophysics: a human silhouette in meditation pose "
            "overlaid with glowing energy fields, subtle chakra points, biofield light lines and quantum "
            "particle patterns radiating outward, dark cosmic background with violet-blue and gold hues, "
            "sacred science aesthetic, photorealistic 3D render, no text, no logos."
        ),
    },
    {
        "match": "quando l'intenzione diventa",
        "prompt": (
            "A geometrically perfect Dodecahedron (Platonic solid with 12 regular pentagonal faces) floating "
            "in space, luminous golden and translucent crystal edges, sacred geometry aesthetic, "
            "soft cosmic background with subtle stars, symbolic and elegant, photorealistic 3D render, "
            "no text, no logos."
        ),
    },
]

MODEL_ID = "gemini-2.5-flash-image-preview"
# fallback list — tried in order until one works
MODEL_CANDIDATES = [
    "gemini-2.5-flash-image-preview",
    "gemini-2.5-flash-image",
    "gemini-2.0-flash-preview-image-generation",
    "gemini-2.0-flash-exp-image-generation",
    "imagen-3.0-generate-001",
]


async def generate_image(prompt: str) -> bytes | None:
    from emergentintegrations.llm.chat import LlmChat, UserMessage
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=str(uuid.uuid4()),
        system_message="You are an image generation assistant. Produce a single high-quality image."
    ).with_model("gemini", MODEL_ID).with_params(modalities=["image", "text"])
    text, images = await chat.send_message_multimodal_response(UserMessage(text=prompt))
    if not images:
        print(f"    No image in response; text was: {text[:120] if text else '(none)'}")
        return None
    img = images[0]
    return base64.b64decode(img["data"])


def slug(text: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    return s[:60] or "img"


async def process(db, job: dict):
    match = job["match"]
    doc = await db.articles.find_one(
        {"source_url": {"$regex": "^citazioni-docx:"}, "title": {"$regex": match, "$options": "i"}},
        {"id": 1, "title": 1, "image_url": 1, "_id": 0},
    )
    if not doc:
        print(f"NO MATCH for: {match}")
        return False
    print(f"→ {doc['title']}")
    print(f"    Generating image (may take ~10-15s)...")
    try:
        img_bytes = await generate_image(job["prompt"])
    except Exception as e:
        print(f"    LLM error: {e}")
        return False
    if not img_bytes:
        return False
    path = f"citation-images/{slug(match)}-{uuid.uuid4().hex[:8]}.png"
    print(f"    Uploading to {path} ({len(img_bytes)} bytes)")
    put_object(path, img_bytes, "image/png")
    public_url = f"/api/files/{path}"
    await db.articles.update_one({"id": doc["id"]}, {"$set": {"image_url": public_url}})
    print(f"    ✔ Updated image_url = {public_url}\n")
    return True


async def main():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    ok = 0
    for j in JOBS:
        try:
            if await process(db, j):
                ok += 1
        except Exception as e:
            print(f"  Job error: {e}")
    print(f"Done: {ok}/{len(JOBS)}")


if __name__ == "__main__":
    asyncio.run(main())
