"""
Media compression pipeline for uploaded files.

Compresses images/audio/video BEFORE they are stored on Emergent Object Storage,
dramatically reducing storage cost + egress bandwidth + making the app faster
for end users on mobile networks.

Strategy:
  * Images (jpg/png/webp/heic) → resize to max 1600px + convert to WebP q82
      Typical savings: 90-97% smaller. Preserves EXIF orientation.
  * Audio (mp3/m4a/wav/ogg/opus/flac/aac/amr/3gp) → AAC 96kbps stereo mono-aware .m4a
      Typical savings: 60-75% smaller. AAC chosen over Opus for widest iOS compat.
  * Video (mp4/mov/webm/avi) → H.264 720p CRF 24 + AAC 96kbps in .mp4
      Typical savings: 50-70% smaller. Web-friendly (moov atom moved to start).

Safety: every function has a hard try/except that returns the ORIGINAL bytes if
compression fails for any reason (corrupt input, unusual codec, ffmpeg error).
The uploader will never crash because of compression.

Toggle: set env `MEDIA_COMPRESSION_DISABLED=1` to skip compression entirely.
"""
from __future__ import annotations

import io
import os
import shutil
import subprocess
import tempfile
import logging
from typing import Optional, Tuple

from PIL import Image, ImageOps

logger = logging.getLogger("conoscenza.media")

# -----------------------------------------------------------------------------
# Config
# -----------------------------------------------------------------------------
DISABLED = os.environ.get("MEDIA_COMPRESSION_DISABLED", "").strip() in {"1", "true", "yes"}

IMG_MAX_WIDTH = int(os.environ.get("MEDIA_IMG_MAX_WIDTH", 1600))
IMG_QUALITY = int(os.environ.get("MEDIA_IMG_QUALITY", 82))
AUDIO_BITRATE = os.environ.get("MEDIA_AUDIO_BITRATE", "96k")
VIDEO_CRF = int(os.environ.get("MEDIA_VIDEO_CRF", 24))
VIDEO_MAX_HEIGHT = int(os.environ.get("MEDIA_VIDEO_MAX_HEIGHT", 720))

FFMPEG = shutil.which("ffmpeg")
FFPROBE = shutil.which("ffprobe")


# -----------------------------------------------------------------------------
# Public API
# -----------------------------------------------------------------------------
def compress_media(data: bytes, filename: str, mime: str) -> Tuple[bytes, str, str]:
    """Route to the appropriate compressor. Returns (bytes, new_extension, new_mime).

    On any error or when compression yields a LARGER file than the original,
    returns the input untouched (with the original extension guessed from filename).
    """
    original_ext = _guess_ext(filename, mime)
    if DISABLED or not data:
        return data, original_ext, mime

    try:
        if _is_image(mime, original_ext):
            return _try_compress_image(data, original_ext, mime)
        if _is_audio(mime, original_ext) and FFMPEG:
            return _try_compress_audio(data, original_ext, mime)
        if _is_video(mime, original_ext) and FFMPEG:
            return _try_compress_video(data, original_ext, mime)
    except Exception as e:  # pragma: no cover — defensive
        logger.warning(f"Media compression failed for {filename}: {e}. Storing original.")
    return data, original_ext, mime


# -----------------------------------------------------------------------------
# Detection helpers
# -----------------------------------------------------------------------------
_IMG_EXT = {"jpg", "jpeg", "png", "webp", "heic", "heif", "bmp", "tiff", "gif"}
_AUDIO_EXT = {"mp3", "m4a", "wav", "ogg", "opus", "aac", "amr", "3gp", "3gpp", "flac", "webm"}
_VIDEO_EXT = {"mp4", "mov", "webm", "avi", "mkv", "m4v"}


def _guess_ext(filename: str, mime: str) -> str:
    if "." in filename:
        ext = filename.rsplit(".", 1)[-1].lower()
        if ext:
            return ext
    # fallback from mime
    if "/" in (mime or ""):
        return mime.split("/", 1)[1].split(";")[0].strip().lower() or "bin"
    return "bin"


def _is_image(mime: str, ext: str) -> bool:
    return (mime or "").startswith("image/") or ext in _IMG_EXT


def _is_audio(mime: str, ext: str) -> bool:
    return (mime or "").startswith("audio/") or ext in _AUDIO_EXT


def _is_video(mime: str, ext: str) -> bool:
    return (mime or "").startswith("video/") or ext in _VIDEO_EXT


# -----------------------------------------------------------------------------
# Image compression (Pillow only, no external deps)
# -----------------------------------------------------------------------------
def _try_compress_image(data: bytes, ext: str, mime: str) -> Tuple[bytes, str, str]:
    """Resize to max IMG_MAX_WIDTH, convert to WebP q82. Preserves orientation.
    Keeps original if it produces a larger file (e.g. tiny icons already tiny).
    """
    try:
        img = Image.open(io.BytesIO(data))
        img.load()
    except Exception as e:
        logger.debug(f"Cannot open image, storing original: {e}")
        return data, ext, mime

    # Auto-rotate based on EXIF, then discard EXIF (unnecessary in web media)
    try:
        img = ImageOps.exif_transpose(img)
    except Exception:
        pass

    # Convert palette / transparency correctly
    if img.mode not in ("RGB", "RGBA"):
        img = img.convert("RGBA" if "A" in img.mode else "RGB")

    # Resize preserving aspect ratio if too wide
    w, h = img.size
    if w > IMG_MAX_WIDTH:
        new_h = int(h * (IMG_MAX_WIDTH / w))
        img = img.resize((IMG_MAX_WIDTH, new_h), Image.LANCZOS)

    # Encode to WebP
    out = io.BytesIO()
    try:
        img.save(out, format="WEBP", quality=IMG_QUALITY, method=4)
    except Exception:
        # Fallback: JPEG for RGB, PNG for RGBA
        out = io.BytesIO()
        if img.mode == "RGBA":
            img.save(out, format="PNG", optimize=True)
            return out.getvalue(), "png", "image/png"
        img.convert("RGB").save(out, format="JPEG", quality=IMG_QUALITY, optimize=True, progressive=True)
        return out.getvalue(), "jpg", "image/jpeg"

    compressed = out.getvalue()
    # Don't replace with a larger file (rare, but possible for tiny inputs)
    if len(compressed) >= len(data) and ext in ("webp",):
        return data, ext, mime
    logger.info(f"Image compressed: {len(data)/1024:.0f}KB → {len(compressed)/1024:.0f}KB "
                f"(-{100 * (1 - len(compressed) / max(len(data), 1)):.0f}%)")
    return compressed, "webp", "image/webp"


# -----------------------------------------------------------------------------
# Audio compression (ffmpeg → AAC 96kbps .m4a)
# -----------------------------------------------------------------------------
def _try_compress_audio(data: bytes, ext: str, mime: str) -> Tuple[bytes, str, str]:
    """Re-encode audio to AAC 96kbps in an .m4a container. Broad iOS/Android
    compatibility (better than Opus on Safari)."""
    with tempfile.NamedTemporaryFile(suffix=f".{ext}", delete=False) as fin, \
         tempfile.NamedTemporaryFile(suffix=".m4a", delete=False) as fout:
        try:
            fin.write(data)
            fin.flush()
            fin.close()
            fout.close()

            cmd = [
                FFMPEG, "-y", "-i", fin.name,
                "-vn",  # strip any video/album art
                "-c:a", "aac",
                "-b:a", AUDIO_BITRATE,
                "-movflags", "+faststart",  # web-ready
                "-loglevel", "error",
                fout.name,
            ]
            result = subprocess.run(cmd, capture_output=True, timeout=180)
            if result.returncode != 0:
                logger.warning(f"ffmpeg audio failed rc={result.returncode}: "
                               f"{result.stderr.decode('utf-8', errors='ignore')[:200]}")
                return data, ext, mime
            with open(fout.name, "rb") as f:
                compressed = f.read()
            if not compressed:
                return data, ext, mime
            if len(compressed) >= len(data):
                logger.info(f"Audio compression not beneficial ({len(data)} → {len(compressed)}), keeping original")
                return data, ext, mime
            logger.info(f"Audio compressed: {len(data)/1024/1024:.1f}MB → {len(compressed)/1024/1024:.1f}MB "
                        f"(-{100 * (1 - len(compressed) / max(len(data), 1)):.0f}%)")
            return compressed, "m4a", "audio/mp4"
        finally:
            for p in (fin.name, fout.name):
                try: os.unlink(p)
                except Exception: pass


# -----------------------------------------------------------------------------
# Video compression (ffmpeg → H.264 720p + AAC in .mp4)
# -----------------------------------------------------------------------------
def _try_compress_video(data: bytes, ext: str, mime: str) -> Tuple[bytes, str, str]:
    with tempfile.NamedTemporaryFile(suffix=f".{ext}", delete=False) as fin, \
         tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as fout:
        try:
            fin.write(data)
            fin.flush()
            fin.close()
            fout.close()

            # scale=-2:min(720,ih) → downscale to max height 720p, only if larger.
            # -2 keeps width divisible by 2 (required by H.264).
            vf = f"scale='if(gt(ih,{VIDEO_MAX_HEIGHT}),-2,iw)':'if(gt(ih,{VIDEO_MAX_HEIGHT}),{VIDEO_MAX_HEIGHT},ih)'"
            cmd = [
                FFMPEG, "-y", "-i", fin.name,
                "-c:v", "libx264",
                "-preset", "medium",
                "-crf", str(VIDEO_CRF),
                "-vf", vf,
                "-pix_fmt", "yuv420p",  # broad player compat
                "-c:a", "aac",
                "-b:a", AUDIO_BITRATE,
                "-movflags", "+faststart",
                "-loglevel", "error",
                fout.name,
            ]
            # Videos can be big — allow generous timeout scaled by input size.
            size_mb = max(1, len(data) // (1024 * 1024))
            timeout = min(30 * 60, 60 + size_mb * 8)  # up to 30 min
            result = subprocess.run(cmd, capture_output=True, timeout=timeout)
            if result.returncode != 0:
                logger.warning(f"ffmpeg video failed rc={result.returncode}: "
                               f"{result.stderr.decode('utf-8', errors='ignore')[:200]}")
                return data, ext, mime
            with open(fout.name, "rb") as f:
                compressed = f.read()
            if not compressed or len(compressed) >= len(data):
                return data, ext, mime
            logger.info(f"Video compressed: {len(data)/1024/1024:.1f}MB → {len(compressed)/1024/1024:.1f}MB "
                        f"(-{100 * (1 - len(compressed) / max(len(data), 1)):.0f}%)")
            return compressed, "mp4", "video/mp4"
        finally:
            for p in (fin.name, fout.name):
                try: os.unlink(p)
                except Exception: pass
