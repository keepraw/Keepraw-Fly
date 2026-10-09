"""Offline asset preparation; runtime never downloads geographic imagery.
Usage: python scripts/generate-globe-textures.py path/to/NASA-source.jpg
Requires Pillow. Source checksum and usage terms: globe-texture.source.json.
"""
import hashlib
import sys
from pathlib import Path
from PIL import Image

source = Path(sys.argv[1])
expected = "4f4240673a3a1b173d61b92ca4b07bac5fd17059ea5f725ba6da5a9c5386b7ba"
if hashlib.sha256(source.read_bytes()).hexdigest() != expected:
    raise SystemExit("Source checksum mismatch")
image = Image.open(source).convert("RGB")
target = Path(__file__).resolve().parents[1] / "apps/web/src/globe/assets"
target.mkdir(parents=True, exist_ok=True)
for width in [2048, 4096]:
    path = target / f"earth-{width}.webp"
    image.resize((width, width // 2), Image.Resampling.LANCZOS).save(path, "WEBP", quality=90, method=6)
    print(f"{path.name}: {path.stat().st_size} bytes")
