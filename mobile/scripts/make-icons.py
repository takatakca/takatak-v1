# Builds the app icons from the OFFICIAL TAKATAK mark already used by takatak.ca (public/icons/*.png).
# Never a redrawn copy (BRAND.md): the files are only resized and placed on the brand navy.
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parents[2]
out = Path(__file__).resolve().parents[1] / 'assets'
NAVY = (6, 13, 31, 255)
mark = Image.open(root / 'public/icons/icon-maskable-512.png').convert('RGBA')

def save(img, name):
    img.save(out / name)
    print('wrote', name, img.size)

# iOS / store icon: full square, no transparency.
save(Image.alpha_composite(Image.new('RGBA', (1024, 1024), NAVY), mark.resize((1024, 1024), Image.LANCZOS)).convert('RGB'), 'icon.png')
# Android adaptive: the maskable mark already keeps the circle inside the safe zone.
save(mark.resize((1024, 1024), Image.LANCZOS), 'adaptive-foreground.png')
save(Image.new('RGBA', (1024, 1024), NAVY), 'adaptive-background.png')
mono = mark.resize((1024, 1024), Image.LANCZOS).convert('L').point(lambda v: 255 if v > 150 else 0)
save(Image.merge('RGBA', (mono, mono, mono, mono)), 'adaptive-monochrome.png')
# Splash and in-app logo: the official 512 icon (round mark on navy).
save(Image.open(root / 'public/icons/icon-512.png').convert('RGBA'), 'splash-icon.png')
save(Image.open(root / 'public/icons/icon-512.png').convert('RGBA').resize((256, 256), Image.LANCZOS), 'logo-mark.png')
save(Image.open(root / 'public/icons/icon-512.png').convert('RGBA').resize((48, 48), Image.LANCZOS), 'favicon.png')
