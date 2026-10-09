"""Build the offline relief texture from Natural Earth's SR_50M GeoTIFF.

Usage: python scripts/generate-map-relief.py /path/to/SR_50M.tif
Requires Pillow. Source and license are recorded in map-relief.source.json.
The raster remains geographic (360 x 180 degrees); the client projects it
with the same Equal Earth projection used by routes and airport coordinates.
"""

import sys
from pathlib import Path

from PIL import Image, ImageEnhance

source = Image.open(sys.argv[1]).convert("L")
texture = source.resize((4096, 2048), Image.Resampling.LANCZOS)
texture = ImageEnhance.Contrast(texture).enhance(1.35)
target = Path(__file__).resolve().parents[1] / "apps/web/src/assets/map-relief.webp"
target.parent.mkdir(parents=True, exist_ok=True)
texture.save(target, "WEBP", quality=88, method=6)
print(f"{target.name}: {target.stat().st_size:,} bytes")
