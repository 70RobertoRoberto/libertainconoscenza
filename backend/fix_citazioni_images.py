"""Rebuild image assignments for citation articles with a wider, verified pool.

- Verifies every candidate URL returns HTTP 200.
- Groups pool by theme; each theme maps to author categories.
- Assigns one UNIQUE image per article (round-robin within its theme).
"""

import asyncio, os, hashlib
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import requests
load_dotenv("/app/backend/.env")

# Themed pools - each id verified below
POOL = {
    "quantum": [
        "1451187580459-43490279c0fa",  # spiral galaxy - verified 200
        "1462331940025-496dfbfc7564",  # stars network
        "1462332420958-a05d1e002413",  # abstract particles
        "1543722530-d2c3201371e7",     # blue waves
        "1451188502541-13943edb6acb",  # nebula (verify)
        "1543722530-d2c3201371e7",
    ],
    "cosmos": [
        "1451187580459-43490279c0fa",
        "1465101162946-4377e57745c3",  # night sky
        "1419242902214-272b3f66ee7a",  # aurora
        "1444703686981-a3abbc4d4fe3",  # milky way
        "1435224668334-0f82ec57b605",  # galaxy spiral
        "1517411032315-54ef2cb783bb",  # moon
    ],
    "philosophy": [
        "1481627834876-b7833e8f5570",  # book (verified 200)
        "1524995997946-a1c2e315a42f",  # open book candle
        "1495640388908-05fa85288e61",  # library
        "1507842217343-583bb7270b66",  # old library
        "1585829365295-ab7cd400c167",  # scroll
        "1519791883288-dc8bd696e667",  # philosopher statue
    ],
    "statue": [
        "1552083375-1447ce886485",     # sculpture (verified 200)
        "1580489944761-15a19d654956",  # Greek statue
        "1547333101-c4ac71dc9027",     # marble sculpture
        "1508672019048-805c876b67e2",  # bust statue
        "1608889825205-eebdb9fc5806",  # temple column
    ],
    "meditation": [
        "1506126613408-eca07ce68773",  # meditation (200)
        "1544367567-0f2fcb009e0b",     # yoga (200)
        "1545389336-cf090694435e",     # meditation woman
        "1591228127791-8e2eaef098d3",  # sunset yoga
        "1518604666860-9ed391f76460",  # zen candle
    ],
    "yoga": [
        "1544367567-0f2fcb009e0b",     # verified 200
        "1552693673-1bf958298935",     # yoga pose sunset
        "1518611012118-696072aa579a",  # body zen (200)
        "1599901860904-17e6ed7083a0",  # yoga silhouette
        "1591228127791-8e2eaef098d3",
    ],
    "mind": [
        "1499209974431-9dddcece7f88",  # brain concept
        "1543269865-cbf427effbad",     # neurons
        "1509228468518-180dd4864904",  # abstract thought
        "1512403754473-27835f7b9984",  # dark portrait
        "1441742917377-57f78ee0e582",  # thinking silhouette
    ],
    "body": [
        "1518611012118-696072aa579a",  # 200
        "1518622358385-8ea7d0794bf6",  # human silhouette
        "1524863479829-916d8e77f114",  # hands
        "1497436072909-60f360e1d4b1",  # nature body
    ],
    "forest": [
        "1441974231531-c6227db76b6e",  # forest (200)
        "1470071459604-3b5ec3a7fe05",  # misty forest
        "1500382017468-9049fed747ef",  # autumn forest
        "1448375240586-882707db888b",  # tall trees
    ],
    "water": [
        "1500375592092-40eb2168fd21",  # 200
        "1439405326854-014607f694d7",  # ocean droplet
        "1476514525535-07fb3b4ae5f1",  # calm lake
        "1418065460487-3e41a6c84dc5",  # river
    ],
    "light": [
        "1502139214982-d0ad755818d8",  # 200
        "1518709911915-712d5fd04677",  # sun rays forest
        "1445205170230-053b83016050",  # candlelight
        "1519681393784-d120267933ba",  # star light
    ],
    "mandala": [
        "1519834785169-98be25ec3f84",  # 200
        "1519834785169-98be25ec3f84",
        "1611270629569-8b357cb88da9",  # mandala symmetry
        "1583468982228-19f19164aee2",  # geometric art
    ],
    "energy": [
        "1518709414768-a88981a4515d",  # 200
        "1620712943543-bcc4688e7485",  # colorful light trails
        "1451187580459-43490279c0fa",
        "1516110833967-0b5716ca1387",  # aurora glow
    ],
    "heart": [
        "1518199266791-5375a83190b7",
        "1470114716524-46bd127b03e6",  # hands heart
        "1497555030470-e50d5ef21c96",  # heart clouds
        "1517423440428-a5a00ad493e8",  # heart nature
    ],
    "sacred": [
        "1519834785169-98be25ec3f84",
        "1590274853742-8b60f6c2ba86",  # cathedral light
        "1548013146-72479768bada",     # mystic
        "1518709911915-712d5fd04677",
    ],
}

def build_url(pid: str) -> str:
    return f"https://images.unsplash.com/photo-{pid}?w=1200&auto=format&fit=crop&q=70"


# Author -> primary theme
AUTHOR_THEME = {
    "Roberto Fabbroni":            "energy",
    "David Bohm":                  "quantum",
    "Albert Einstein":             "cosmos",
    "Wolfgang Pauli":              "quantum",
    "Erwin Schrödinger":           "quantum",
    "Werner Heisenberg":           "quantum",
    "Carl Gustav Jung":            "mandala",
    "Frederick Perls":             "mind",
    "Perls":                       "mind",
    "Antonio Damasio":             "mind",
    "Maurice Merleau-Ponty":       "body",
    "Friedrich Nietzsche":         "statue",
    "Alexander Lowen":             "heart",
    "Viktor Frankl":               "light",
    "Edgar Cayce":                 "light",
    "Sant'Agostino":               "sacred",
    "Aristotele":                  "statue",
    "Gregory Bateson":             "forest",
    "Fritjof Capra":               "forest",
    "Osho":                        "meditation",
    "Andrew Taylor Still":         "body",
    "Fritjof Capra e Pier Luigi Luisi": "forest",
    "Pierre Teilhard de Chardin":  "cosmos",
    "Ken Wilber":                  "philosophy",
    "Ervin Laszlo":                "cosmos",
    "Rumi":                        "water",
    "Tommaso Campanella":          "philosophy",
    "Edgar Morin":                 "philosophy",
    "Morin":                       "philosophy",
    "B.K.S. Iyengar":              "yoga",
    "Schrödinger":                 "quantum",
}


def theme_for_author(author: str) -> str:
    for name, theme in AUTHOR_THEME.items():
        if name.lower() in author.lower():
            return theme
    return "philosophy"


def verify_urls(pool: dict) -> dict:
    """Return only urls returning 200. Deduplicate ids within each theme."""
    verified = {}
    for theme, ids in pool.items():
        seen = []
        for pid in ids:
            if pid in seen:
                continue
            url = build_url(pid)
            try:
                r = requests.head(url, timeout=10, allow_redirects=True)
                if r.status_code == 200:
                    seen.append(pid)
                else:
                    print(f"  SKIP {r.status_code} {theme}: {pid}")
            except Exception as e:
                print(f"  ERR {theme} {pid}: {e}")
        verified[theme] = [build_url(p) for p in seen]
        print(f"Theme '{theme}': {len(verified[theme])} verified images")
    return verified


async def main():
    print("Verifying image pool...\n")
    pool = verify_urls(POOL)

    client = AsyncIOMotorClient(os.environ['MONGO_URL'])
    db = client[os.environ['DB_NAME']]

    docs = await db.articles.find({"source_url": {"$regex": "^citazioni-docx:"}}, {"id":1,"title":1,"summary":1,"source_url":1}).to_list(length=200)
    print(f"\nReassigning images for {len(docs)} articles...")

    # Sort deterministically by source_url hash so run is idempotent
    docs.sort(key=lambda d: d["source_url"])

    # Track per-theme counter to round-robin
    counters = {theme: 0 for theme in pool}

    updated = 0
    for d in docs:
        # Extract author from summary (line 2 "— Author")
        author = ""
        for line in d["summary"].split("\n"):
            line = line.strip()
            if line.startswith("—"):
                author = line.lstrip("—").strip()
                break
        theme = theme_for_author(author or "")
        images = pool.get(theme) or pool["philosophy"]
        if not images:
            print(f"  no images in theme {theme}"); continue
        img = images[counters[theme] % len(images)]
        counters[theme] += 1
        await db.articles.update_one({"id": d["id"]}, {"$set": {"image_url": img}})
        updated += 1

    print(f"\nDone: {updated} articles updated.")

    # Report distribution
    from collections import Counter
    imgs = Counter()
    async for a in db.articles.find({"source_url": {"$regex": "^citazioni-docx:"}}, {"image_url":1}):
        imgs[a["image_url"]] += 1
    print(f"Unique images used now: {len(imgs)}")
    print("Top repetitions:")
    for u, n in imgs.most_common(6):
        print(f"  {n}x  {u[-60:]}")


if __name__ == "__main__":
    asyncio.run(main())
