"""Generate the app icon, tray icon, and offline demo album artwork.

Run from the project root:
    python scripts/generate-assets.py
"""

from __future__ import annotations

import math
import os
import random

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.path.join(ROOT, "assets")
BUILD = os.path.join(ROOT, "build")
DEMO = os.path.join(ASSETS, "demo")

GREEN = (30, 215, 96)
BLACK = (7, 12, 9)


def ensure_dirs() -> None:
    for directory in (ASSETS, BUILD, DEMO):
        os.makedirs(directory, exist_ok=True)


def vertical_gradient(size: tuple[int, int], top: tuple[int, int, int], bottom: tuple[int, int, int]) -> Image.Image:
    width, height = size
    image = Image.new("RGB", size)
    draw = ImageDraw.Draw(image)
    for y in range(height):
        t = y / max(1, height - 1)
        color = tuple(round(top[i] + (bottom[i] - top[i]) * t) for i in range(3))
        draw.line([(0, y), (width, y)], fill=color)
    return image


def add_glow(base: Image.Image, ellipse: tuple[int, int, int, int], color: tuple[int, int, int, int], blur: int) -> None:
    layer = Image.new("RGBA", base.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    draw.ellipse(ellipse, fill=color)
    layer = layer.filter(ImageFilter.GaussianBlur(blur))
    base.alpha_composite(layer)


def add_rings(base: Image.Image, center: tuple[int, int], radii: list[int], color: tuple[int, int, int, int]) -> None:
    layer = Image.new("RGBA", base.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    for radius in radii:
        draw.ellipse(
            (center[0] - radius, center[1] - radius, center[0] + radius, center[1] + radius),
            outline=color,
            width=2,
        )
    layer = layer.filter(ImageFilter.GaussianBlur(0.7))
    base.alpha_composite(layer)


def add_noise(base: Image.Image, amount: float = 0.035) -> None:
    noise = Image.effect_noise(base.size, 18).convert("RGB")
    grained = Image.blend(base.convert("RGB"), noise, amount)
    base.paste(grained)


def add_vignette(base: Image.Image, strength: float = 0.55) -> None:
    width, height = base.size
    mask = Image.new("L", base.size, 0)
    draw = ImageDraw.Draw(mask)
    draw.ellipse(
        (-width * 0.3, -height * 0.3, width * 1.3, height * 1.3),
        fill=255,
    )
    mask = mask.filter(ImageFilter.GaussianBlur(110))
    black = Image.new("RGB", base.size, (0, 0, 0))
    darkened = Image.composite(base.convert("RGB"), black, mask)
    base.paste(Image.blend(base.convert("RGB"), darkened, strength))


def load_font(name: str, size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    candidates = [
        os.path.join(os.environ.get("WINDIR", r"C:\Windows"), "Fonts", name),
        os.path.join(os.environ.get("WINDIR", r"C:\Windows"), "Fonts", "segoeuib.ttf"),
    ]
    for candidate in candidates:
        try:
            if os.path.exists(candidate):
                return ImageFont.truetype(candidate, size)
        except OSError:
            continue
    return ImageFont.load_default()


def add_cover_text(base: Image.Image, artist: str, album: str) -> None:
    width, height = base.size
    draw = ImageDraw.Draw(base, "RGBA")
    small = load_font("segoeuib.ttf", 17)
    large = load_font("segoeuib.ttf", 31)
    draw.text((46, 42), artist.upper(), font=small, fill=(255, 255, 255, 170))
    draw.text((46, height - 84), album.upper(), font=large, fill=(255, 255, 255, 225))


def make_cover_one() -> Image.Image:
    size = (640, 640)
    image = vertical_gradient(size, (3, 31, 25), (8, 91, 66)).convert("RGBA")
    add_glow(image, (260, 70, 820, 630), (30, 215, 96, 170), 95)
    add_glow(image, (-160, 380, 330, 870), (0, 123, 143, 150), 110)
    add_rings(image, (470, 210), [92, 146, 200, 254], (170, 255, 210, 55))
    add_cover_text(image, "Nova Hart", "Afterglow")
    add_noise(image, 0.028)
    add_vignette(image, 0.4)
    return image.convert("RGB")


def make_cover_two() -> Image.Image:
    size = (640, 640)
    image = vertical_gradient(size, (7, 7, 30), (54, 24, 108)).convert("RGBA")
    add_glow(image, (240, 80, 760, 600), (147, 112, 255, 155), 100)
    add_glow(image, (-120, 300, 300, 760), (255, 82, 138, 90), 110)
    add_rings(image, (360, 330), [150, 215, 280], (214, 205, 255, 50))

    layer = Image.new("RGBA", size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    for index, y in enumerate(range(392, 520, 14)):
        alpha = 150 - index * 12
        draw.line([(0, y), (640, y)], fill=(170, 150, 255, max(25, alpha)), width=2)
    layer = layer.filter(ImageFilter.GaussianBlur(1.4))
    image.alpha_composite(layer)

    add_cover_text(image, "The Satellites", "Night Signals")
    add_noise(image, 0.034)
    add_vignette(image, 0.48)
    return image.convert("RGB")


def make_cover_three() -> Image.Image:
    size = (640, 640)
    image = vertical_gradient(size, (32, 11, 6), (247, 129, 65)).convert("RGBA")
    add_glow(image, (280, -80, 760, 430), (255, 226, 167, 235), 38)
    add_glow(image, (-160, 350, 360, 860), (255, 94, 82, 135), 100)
    add_glow(image, (350, 390, 850, 850), (255, 183, 92, 120), 90)

    layer = Image.new("RGBA", size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    for y in range(424, 470, 5):
        draw.line([(0, y), (640, y)], fill=(255, 231, 196, 20), width=1)
    image.alpha_composite(layer)

    add_cover_text(image, "Mira Vale", "City Lights")
    add_noise(image, 0.03)
    add_vignette(image, 0.36)
    return image.convert("RGB")


def rounded_mask(size: tuple[int, int], radius: int) -> Image.Image:
    mask = Image.new("L", size, 0)
    draw = ImageDraw.Draw(mask)
    draw.rounded_rectangle((0, 0, size[0] - 1, size[1] - 1), radius=radius, fill=255)
    return mask


def make_icon() -> Image.Image:
    size = 512
    image = Image.new("RGBA", (size, size), (0, 0, 0, 0))

    square = vertical_gradient((452, 452), (45, 231, 117), (9, 146, 68)).convert("RGBA")
    highlight = Image.new("RGBA", (452, 452), (0, 0, 0, 0))
    draw = ImageDraw.Draw(highlight)
    draw.ellipse((-120, -190, 520, 250), fill=(255, 255, 255, 34))
    highlight = highlight.filter(ImageFilter.GaussianBlur(30))
    square.alpha_composite(highlight)

    mask = rounded_mask((452, 452), 112)
    image.paste(square, (30, 30), mask)

    # A bold play triangle is still legible at 16 px in the Windows tray.
    draw = ImageDraw.Draw(image)
    draw.polygon(
        [(198, 148), (198, 364), (372, 256)],
        fill=(5, 13, 9, 255),
    )

    return image


def make_tray_icon() -> Image.Image:
    size = 64
    image = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    draw.ellipse((3, 3, size - 3, size - 3), fill=GREEN + (255,))
    draw.polygon(
        [(25, 18), (25, 46), (48, 32)],
        fill=(5, 13, 9, 255),
    )
    return image


def main() -> None:
    ensure_dirs()
    random.seed(7)

    covers = [make_cover_one(), make_cover_two(), make_cover_three()]
    for index, cover in enumerate(covers, start=1):
        cover.save(os.path.join(DEMO, f"cover-{index}.png"), optimize=True)

    icon = make_icon()
    icon.save(os.path.join(ASSETS, "icon.png"))
    icon.resize((256, 256), Image.Resampling.LANCZOS).save(
        os.path.join(BUILD, "icon.ico"),
        format="ICO",
        sizes=[(256, 256), (128, 128), (64, 64), (48, 48), (32, 32), (16, 16)],
    )

    tray_icon = make_tray_icon()
    tray_icon.save(os.path.join(ASSETS, "tray.png"))

    print("Generated icon.png, tray.png, build/icon.ico, and demo cover art.")


if __name__ == "__main__":
    main()
