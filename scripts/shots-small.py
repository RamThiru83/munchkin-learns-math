"""Crop each game picture to its content (4:3) and save small WebP files for the home page.
   python3 scripts/shots-small.py   (reads img/games/raw/*.png, writes img/games/<id>.webp and <id>-l.webp)"""
import glob, os
from PIL import Image, ImageChops

BG = (255, 248, 231)
for f in sorted(glob.glob('img/games/raw/*.png')):
    im = Image.open(f).convert('RGB')
    diff = ImageChops.difference(im, Image.new('RGB', im.size, BG)).convert('L').point(lambda v: 255 if v > 18 else 0)
    box = diff.getbbox() or (0, 0, im.width, im.height)
    pad = 28
    x0, y0, x1, y1 = max(0, box[0] - pad), max(0, box[1] - pad), min(im.width, box[2] + pad), min(im.height, box[3] + pad)
    w, h = x1 - x0, y1 - y0
    # widen to 4:3 around the centre, on the game's own background
    tw, th = max(w, h * 4 / 3), max(h, w * 3 / 4)
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    canvas = Image.new('RGB', (int(tw), int(th)), BG)
    canvas.paste(im.crop((x0, y0, x1, y1)), (int((tw - w) / 2), int((th - h) / 2)))
    name = os.path.basename(f)[:-4]
    canvas.resize((480, 360), Image.LANCZOS).save(f'img/games/{name}.webp', quality=82, method=6)
    canvas.resize((960, 720), Image.LANCZOS).save(f'img/games/{name}-l.webp', quality=80, method=6)
print('done', len(glob.glob('img/games/*.webp')))
