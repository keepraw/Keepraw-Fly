"""Generate offline emission masks from NASA's 2016 Black Marble grayscale map.
Usage: python scripts/generate-globe-night-textures.py source.jpg
Requires Pillow. No generated/random city points, blur, or coordinate warping.
"""
import hashlib
import json
import sys
from pathlib import Path
from PIL import Image

source = Path(sys.argv[1])
expected = "3fbc8aae3529dc1ebfcf3aa9361bd3dfc11d19950a6af6d8ed2df61bd8b0134d"
if hashlib.sha256(source.read_bytes()).hexdigest() != expected:
    raise SystemExit("Source checksum mismatch")
image = Image.open(source).convert("L")
root = Path(__file__).resolve().parents[1]
target = root / "apps/web/src/globe/assets"
assets = []
for width in [2048, 4096]:
    path = target / f"night-{width}.webp"
    # Grayscale scientific visualization is treated as a non-color intensity map.
    # Lossless output retains dim cities without JPEG/WebP ringing around islands.
    image.resize((width, width // 2), Image.Resampling.LANCZOS).save(path, "WEBP", lossless=True, method=6)
    assets.append({"file": f"assets/{path.name}", "dimensions": [width, width // 2], "bytes": path.stat().st_size, "sha256": hashlib.sha256(path.read_bytes()).hexdigest()})
metadata = {
    "dataset": "NASA Earth at Night / Black Marble 2016, global grayscale composite (3 km)",
    "source": "https://assets.science.nasa.gov/content/dam/science/esd/eo/images/imagerecords/144000/144897/BlackMarble_2016_3km_gray.jpg",
    "documentation": "https://science.nasa.gov/earth/earth-observatory/earth-at-night/maps/",
    "usageTerms": "https://www.nasa.gov/nasa-brand-center/images-and-media/",
    "license": "NASA informational imagery usage guidelines; generally not subject to US copyright. Credit NASA, no implied endorsement.",
    "credit": "NASA Earth Observatory / Joshua Stevens; Suomi NPP VIIRS data from Miguel Roman, NASA GSFC",
    "sourceSha256": expected,
    "sourceDimensions": list(image.size),
    "sourceBytes": source.stat().st_size,
    "projection": "Equirectangular; longitude -180 to +180 left to right, latitude +90 to -90 top to bottom",
    "geographicBounds": [-180, -90, 180, 90],
    "purpose": "Geographically registered nighttime emission intensity; historical visual composite, not live lights or calibrated radiance",
    "processing": "Convert to grayscale, Lanczos downsample, lossless WebP; raw data texture (NoColorSpace), shader threshold removes low-level background",
    "assets": assets,
    "generator": "scripts/generate-globe-night-textures.py"
}
(root / "apps/web/src/globe/globe-night-texture.source.json").write_text(json.dumps(metadata, indent=2) + "\n", encoding="utf-8")
print(json.dumps(metadata))
