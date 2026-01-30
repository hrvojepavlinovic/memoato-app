#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw


def _tight_bbox_rgba(img: Image.Image) -> tuple[int, int, int, int] | None:
    if img.mode != "RGBA":
        img = img.convert("RGBA")
    alpha = img.getchannel("A")
    return alpha.getbbox()


def _make_square_icon(
    src_rgba: Image.Image,
    size: int,
    background: tuple[int, int, int, int],
    padding_ratio: float,
) -> Image.Image:
    bbox = _tight_bbox_rgba(src_rgba)
    if bbox is None:
        raise RuntimeError("Source image appears to be fully transparent.")

    cropped = src_rgba.crop(bbox)

    target_inner = max(1, int(round(size * (1.0 - padding_ratio * 2.0))))
    scaled = cropped.copy()
    scaled.thumbnail((target_inner, target_inner), Image.LANCZOS)

    canvas = Image.new("RGBA", (size, size), background)
    x = (size - scaled.width) // 2
    y = (size - scaled.height) // 2
    canvas.alpha_composite(scaled, (x, y))
    return canvas

def _make_maskable_icon(
    src_rgba: Image.Image,
    size: int,
    background: tuple[int, int, int, int],
    padding_ratio: float,
) -> Image.Image:
    bbox = _tight_bbox_rgba(src_rgba)
    if bbox is None:
        raise RuntimeError("Source image appears to be fully transparent.")

    cropped = src_rgba.crop(bbox)
    target_inner = max(1, int(round(size * (1.0 - padding_ratio * 2.0))))
    scaled = cropped.copy()
    scaled.thumbnail((target_inner, target_inner), Image.LANCZOS)

    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(canvas)
    radius = size // 2
    draw.ellipse([(0, 0), (size, size)], fill=background)
    x = (size - scaled.width) // 2
    y = (size - scaled.height) // 2
    canvas.alpha_composite(scaled, (x, y))
    return canvas


def main() -> None:
    repo_root = Path(__file__).resolve().parents[1]
    public_dir = repo_root / "public"
    src_path = public_dir / "logo.png"
    if not src_path.exists():
        raise SystemExit(f"Missing source logo: {src_path}")

    src = Image.open(src_path).convert("RGBA")

    # Dark background to preserve contrast on browser/tab UIs.
    bg = (10, 10, 10, 255)  # #0A0A0A

    icon_16 = _make_square_icon(src, 16, bg, padding_ratio=0.12)
    icon_32 = _make_square_icon(src, 32, bg, padding_ratio=0.12)
    icon_180 = _make_square_icon(src, 180, bg, padding_ratio=0.10)
    icon_192 = _make_square_icon(src, 192, bg, padding_ratio=0.10)
    icon_512 = _make_square_icon(src, 512, bg, padding_ratio=0.10)
    icon_maskable = _make_maskable_icon(src, 512, bg, padding_ratio=0.14)

    # Save PNGs via PIL so headers/metadata are correct.
    icon_16.save(public_dir / "favicon-16x16.png", format="PNG", optimize=True)
    icon_32.save(public_dir / "favicon-32x32.png", format="PNG", optimize=True)
    icon_180.save(public_dir / "apple-touch-icon.png", format="PNG", optimize=True)
    icon_192.save(public_dir / "android-chrome-192x192.png", format="PNG", optimize=True)
    icon_512.save(public_dir / "android-chrome-512x512.png", format="PNG", optimize=True)
    icon_maskable.save(public_dir / "android-chrome-maskable-512x512.png", format="PNG", optimize=True)

    # Keep `public/favicon.ico` as-is (browser caching is aggressive and it's useful
    # to manage it manually).

    print("Generated:")
    print(f"- {public_dir / 'favicon-16x16.png'}")
    print(f"- {public_dir / 'favicon-32x32.png'}")
    print(f"- {public_dir / 'apple-touch-icon.png'}")
    print(f"- {public_dir / 'android-chrome-192x192.png'}")
    print(f"- {public_dir / 'android-chrome-512x512.png'}")
    print(f"- {public_dir / 'android-chrome-maskable-512x512.png'}")


if __name__ == "__main__":
    main()
