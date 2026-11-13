#!/usr/bin/env python3
"""Short TAKATAK clips from the licensed photos, with ffmpeg and Pillow.

  python3 scripts/media/make-clips.py                 every clip
  python3 scripts/media/make-clips.py website local   some clips

Writes, for each clip in scripts/media/clip-copy.json:
  public/media/videos/<key>.mp4            6 s seamless loop, 1280x720, no text (the site adds its own)
  public/media/social/<key>-fr.mp4         7 s vertical 1080x1920 for Reels, Shorts, TikTok (French)
  public/media/social/<key>-en.mp4         same in English
and registers the loops in src/lib/website/media-manifest.json.

Needs: ffmpeg, Pillow, the Inter fonts (fonts-inter). Silent on purpose: social
platforms autoplay muted; a voice-over can be laid on later (docs/media/FICHES_VIDEO.md).
"""

import json
import os
import subprocess
import sys
import tempfile

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.getcwd()
FONTS = "/usr/share/fonts/opentype/inter"
BLUE = (21, 101, 216, 255)  # BRAND.md "brand blue on light"
INK = (11, 13, 18, 255)
FPS = 30


def font(name, size):
    return ImageFont.truetype(os.path.join(FONTS, name), size)


def wrap(draw, text, fnt, width):
    words, lines, line = text.split(), [], ""
    for w in words:
        test = f"{line} {w}".strip()
        if draw.textlength(test, font=fnt) <= width:
            line = test
        else:
            lines.append(line)
            line = w
    if line:
        lines.append(line)
    return lines


def crop_to(photo, w, h, focus_x, scale):
    """Crop the photo to w:h around focus_x, sized scale times the frame (zoom headroom)."""
    im = Image.open(photo).convert("RGB")
    target = w / h
    iw, ih = im.size
    if iw / ih > target:
        cw = int(ih * target)
        left = int(min(max(focus_x * iw - cw / 2, 0), iw - cw))
        im = im.crop((left, 0, left + cw, ih))
    else:
        ch = int(iw / target)
        top = int((ih - ch) / 2)
        im = im.crop((0, top, iw, top + ch))
    return im.resize((int(w * scale), int(h * scale)), Image.LANCZOS)


def layer(w, h):
    return Image.new("RGBA", (w, h), (0, 0, 0, 0))


def base_layer(w, h):
    """Gradient for legibility + small wordmark."""
    im = layer(w, h)
    grad = Image.new("L", (1, h))
    for y in range(h):
        top = max(0, 1 - y / (h * 0.22)) * 120
        bottom = max(0, (y - h * 0.42) / (h * 0.58)) ** 1.4 * 235
        grad.putpixel((0, y), int(min(255, top + bottom)))
    shade = Image.new("RGBA", (w, h), (0, 0, 0, 255))
    shade.putalpha(grad.resize((w, h)))
    im = Image.alpha_composite(im, shade)
    d = ImageDraw.Draw(im)
    d.text((72, 92), "T A K A T A K", font=font("Inter-Bold.otf", 34), fill=(255, 255, 255, 235))
    return im


def headline_layer(w, h, label, title):
    im = layer(w, h)
    d = ImageDraw.Draw(im)
    big = font("InterDisplay-Bold.otf", 92)
    lines = wrap(d, title, big, w - 144)
    line_h = 100
    y = h - 420 - line_h * len(lines)
    d.text((72, y - 70), label.upper(), font=font("Inter-SemiBold.otf", 30), fill=(170, 205, 255, 255))
    for i, line in enumerate(lines):
        d.text((72, y + i * line_h), line, font=big, fill=(255, 255, 255, 255))
    return im


def chip_layer(w, h, text):
    im = layer(w, h)
    d = ImageDraw.Draw(im)
    f = font("Inter-SemiBold.otf", 34)
    tw = d.textlength(text, font=f)
    x, y, ph, pw = 72, h - 330, 78, int(tw + 100)
    shadow = layer(w, h)
    ImageDraw.Draw(shadow).rounded_rectangle((x, y + 10, x + pw, y + ph + 10), radius=ph // 2, fill=(0, 0, 0, 110))
    im = Image.alpha_composite(im, shadow.filter(ImageFilter.GaussianBlur(14)))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((x, y, x + pw, y + ph), radius=ph // 2, fill=(255, 255, 255, 240))
    d.ellipse((x + 32, y + ph / 2 - 8, x + 48, y + ph / 2 + 8), fill=(16, 185, 129, 255))
    d.text((x + 66, y + ph / 2), text, font=f, fill=INK, anchor="lm")
    return im


def end_layer(w, h, end):
    im = layer(w, h)
    d = ImageDraw.Draw(im)
    top = int(h * 0.6)
    d.rounded_rectangle((0, top, w, h + 80), radius=64, fill=BLUE)
    d.text((72, top + 110), end["title"], font=font("InterDisplay-Bold.otf", 88), fill=(255, 255, 255, 255))
    d.text((72, top + 230), end["url"], font=font("InterDisplay-Medium.otf", 56), fill=(220, 233, 255, 255))
    f = font("Inter-SemiBold.otf", 40)
    label = f"{end['cta']}  →"
    tw = d.textlength(label, font=f)
    bx, by, bh = 72, top + 360, 104
    d.rounded_rectangle((bx, by, bx + tw + 112, by + bh), radius=bh // 2, fill=(255, 255, 255, 255))
    d.text((bx + 56, by + bh / 2), label, font=f, fill=INK, anchor="lm")
    return im


def ease(st, d, dist):
    """Overlay y offset: slides up `dist` px between st and st+d (cubic ease-out)."""
    p = f"min(1,max(0,(t-{st})/{d}))"
    return f"{dist}*pow(1-{p},3)"


def run(args):
    subprocess.run(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", *args], check=True)


def make_vertical(clip, lang, end, out, tmp):
    w, h, dur = 1080, 1920, 7
    frames = dur * FPS
    bg = os.path.join(tmp, f"{clip['key']}-v-bg.png")
    crop_to(os.path.join(ROOT, clip["photo"]), w, h, clip["focusX"], 1.6).save(bg)
    paths = {}
    for name, im in {
        "base": base_layer(w, h),
        "head": headline_layer(w, h, clip["label"][lang], clip["title"][lang]),
        "chip": chip_layer(w, h, clip["chip"][lang]),
        "end": end_layer(w, h, end[lang]),
    }.items():
        paths[name] = os.path.join(tmp, f"{clip['key']}-{lang}-{name}.png")
        im.save(paths[name])
    zoom = f"zoompan=z='1+0.12*on/{frames}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d={frames}:s={w}x{h}:fps={FPS}"
    graph = ";".join(
        [
            f"[0:v]{zoom},format=rgba[bg]",
            "[bg][1:v]overlay=0:0[a]",
            f"[2:v]format=rgba,fade=t=in:st=0.35:d=0.6:alpha=1,fade=t=out:st=4.1:d=0.4:alpha=1[h]",
            f"[a][h]overlay=x=0:y='{ease(0.35, 0.7, 70)}':eval=frame[b]",
            f"[3:v]format=rgba,fade=t=in:st=1.1:d=0.5:alpha=1,fade=t=out:st=4.1:d=0.4:alpha=1[c]",
            f"[b][c]overlay=x=0:y='{ease(1.1, 0.6, 40)}':eval=frame[d]",
            f"[4:v]format=rgba,fade=t=in:st=4.3:d=0.35:alpha=1[e]",
            f"[d][e]overlay=x=0:y='{ease(4.3, 0.7, 520)}':eval=frame,format=yuv420p[out]",
        ]
    )
    run(
        [
            "-i", bg,
            *sum((["-loop", "1", "-t", str(dur), "-i", paths[k]] for k in ("base", "head", "chip", "end")), []),
            "-filter_complex", graph, "-map", "[out]", "-t", str(dur), "-r", str(FPS),
            "-c:v", "libx264", "-preset", "medium", "-crf", "23", "-movflags", "+faststart", "-an", out,
        ]
    )


def make_loop(clip, out, tmp):
    """3 s slow push-in, then the same in reverse: a 6 s loop with no jump."""
    w, h, half = 1280, 720, 3
    frames = half * FPS
    bg = os.path.join(tmp, f"{clip['key']}-l-bg.png")
    crop_to(os.path.join(ROOT, clip["photo"]), w, h, clip["focusX"], 1.6).save(bg)
    zoom = f"zoompan=z='1+0.07*on/{frames}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d={frames}:s={w}x{h}:fps={FPS}"
    graph = f"[0:v]{zoom},format=yuv420p,split[a][b];[b]reverse[r];[a][r]concat=n=2:v=1:a=0[out]"
    run(
        [
            "-i", bg, "-filter_complex", graph, "-map", "[out]",
            "-c:v", "libx264", "-preset", "medium", "-crf", "27", "-movflags", "+faststart", "-an", out,
        ]
    )


def main():
    config = json.load(open(os.path.join(ROOT, "scripts/media/clip-copy.json"), encoding="utf8"))
    wanted = set(sys.argv[1:])
    clips = [c for c in config["clips"] if not wanted or c["key"] in wanted]
    videos = os.path.join(ROOT, "public/media/videos")
    social = os.path.join(ROOT, "public/media/social")
    os.makedirs(videos, exist_ok=True)
    os.makedirs(social, exist_ok=True)
    manifest_path = os.path.join(ROOT, "src/lib/website/media-manifest.json")
    manifest = json.load(open(manifest_path, encoding="utf8"))
    with tempfile.TemporaryDirectory() as tmp:
        for clip in clips:
            key = clip["key"]
            make_loop(clip, os.path.join(videos, f"{key}.mp4"), tmp)
            manifest["videos"][key] = f"/media/videos/{key}.mp4"
            for lang in ("fr", "en"):
                make_vertical(clip, lang, config["end"], os.path.join(social, f"{key}-{lang}.mp4"), tmp)
            print(f"{key}: loop + fr + en")
    manifest["videos"] = dict(sorted(manifest["videos"].items()))
    with open(manifest_path, "w", encoding="utf8") as fh:
        json.dump(manifest, fh, indent=2, ensure_ascii=False)
        fh.write("\n")


if __name__ == "__main__":
    main()
