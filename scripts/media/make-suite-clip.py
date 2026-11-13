#!/usr/bin/env python3
"""Short vertical clip of the Clover suite, recorded from the real homepage.

  npm run dev                                  (in another terminal, port 3000)
  python3 scripts/media/make-suite-clip.py     writes public/media/social/clover-suite-{fr,en}.mp4

The homepage's Clover suite row (nine apps, each with its moving mini screen)
is recorded with Playwright on a phone-sized page while it scrolls slowly,
then the TAKATAK end card from make-clips.py is laid on top at the end.
1080x1920, 14 s, silent (platforms autoplay muted). Needs Playwright,
ffmpeg, Pillow and the Inter fonts, like make-clips.py.
"""

import importlib.util
import json
import os
import subprocess
import sys
import tempfile

ROOT = os.getcwd()
BASE = os.environ.get("SITE_URL", "http://localhost:3000/")
DUR = 14
END_AT = 11

spec = importlib.util.spec_from_file_location("make_clips", os.path.join(ROOT, "scripts/media/make-clips.py"))
mc = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mc)

RECORD_JS = r"""
const { chromium } = require('playwright');
(async () => {
  const [,, url, lang, dir] = process.argv;
  const b = await chromium.launch();
  const ctx = await b.newContext({
    viewport: { width: 540, height: 960 }, deviceScaleFactor: 2, locale: lang === 'fr' ? 'fr-CA' : 'en-CA',
    recordVideo: { dir, size: { width: 540, height: 960 } },
  });
  await ctx.addInitScript((l) => {
    try {
      localStorage.setItem('takatak.lang', l);
      localStorage.setItem('takatak.lang.chosen', '1');
      localStorage.setItem('takatak.promo.invite.seen', String(Date.now()));
    } catch {}
  }, lang);
  const p = await ctx.newPage();
  await p.goto(url, { waitUntil: 'networkidle', timeout: 180000 });
  // Hide what floats over the page (dialogs, the plan dock, the chat button, the dev badge).
  await p.addStyleTag({ content: '[role=dialog],nextjs-portal,.fixed{display:none!important}' });
  const top = await p.evaluate(() => {
    const t = [...document.querySelectorAll('p')].find((e) => /^(La suite Clover|The Clover suite)$/.test(e.textContent.trim()));
    t.scrollIntoView({ block: 'start' });
    window.scrollBy(0, -90);
    return window.scrollY;
  });
  await p.waitForTimeout(1200);
  // Slow scroll through the nine apps, then hold.
  const steps = 160;
  for (let i = 0; i <= steps; i++) {
    await p.evaluate(([y]) => window.scrollTo(0, y), [top + (i / steps) * 1100]);
    await p.waitForTimeout(55);
  }
  await p.waitForTimeout(3500);
  const v = p.video();
  await ctx.close();
  console.log(await v.path());
  await b.close();
})();
"""


def record(lang, tmp):
    js = os.path.join(tmp, "record.cjs")
    with open(js, "w", encoding="utf8") as f:
        f.write(RECORD_JS)
    out = subprocess.run(["node", js, BASE, lang, tmp], check=True, capture_output=True, text=True, cwd=ROOT)
    return out.stdout.strip().splitlines()[-1]


def compose(raw, lang, end, out, tmp):
    w, h = 1080, 1920
    end_png = os.path.join(tmp, f"end-{lang}.png")
    mc.end_layer(w, h, end[lang]).save(end_png)
    graph = ";".join(
        [
            # skip the page load, keep DUR seconds
            f"[0:v]trim=start=1.6:duration={DUR},setpts=PTS-STARTPTS,scale={w}:{h}:flags=lanczos,fps={mc.FPS},format=rgba[bg]",
            f"[1:v]format=rgba,fade=t=in:st={END_AT}:d=0.35:alpha=1[e]",
            f"[bg][e]overlay=x=0:y='{mc.ease(END_AT, 0.7, 520)}':eval=frame,format=yuv420p[out]",
        ]
    )
    mc.run(
        [
            "-i", raw, "-loop", "1", "-t", str(DUR), "-i", end_png,
            "-filter_complex", graph, "-map", "[out]", "-t", str(DUR), "-r", str(mc.FPS),
            "-c:v", "libx264", "-preset", "medium", "-crf", "24", "-movflags", "+faststart", "-an", out,
        ]
    )


def main():
    config = json.load(open(os.path.join(ROOT, "scripts/media/clip-copy.json"), encoding="utf8"))
    end = {
        "fr": {**config["end"]["fr"], "title": "La suite Clover"},
        "en": {**config["end"]["en"], "title": "The Clover suite"},
    }
    langs = sys.argv[1:] or ["fr", "en"]
    social = os.path.join(ROOT, "public/media/social")
    os.makedirs(social, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        for lang in langs:
            raw = record(lang, tmp)
            out = os.path.join(social, f"clover-suite-{lang}.mp4")
            compose(raw, lang, end, out, tmp)
            print("wrote", os.path.relpath(out, ROOT))


if __name__ == "__main__":
    main()
