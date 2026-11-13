"""Render Backline's Road Case PNG brand assets.

Usage: python brand/backline/render_assets.py [--chromium PATH]

Renders og.png, social-banner.png, social-square.png, apple-touch-icon.png,
avatar.png and favicon.ico into frontend/public/brand/backline from the SVG
mark and the self-hosted fonts, using Playwright's Chromium. Run it after
changing the mark, the fonts or the palette, and commit the outputs.
"""

import argparse
import base64
import hashlib
import json
import pathlib
import struct

from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parents[2]
OUT = ROOT / 'frontend/public/brand/backline'
FONTS = OUT / 'fonts'

CASE = '#161719'
INK = '#ece8dd'
MUTED = '#a9a499'
HARDWARE = '#c8c3b6'
TAPE = '#efe6c8'
AMBER = '#f2b51c'

MARK = (OUT / 'mark-light.svg').read_text()


def font(name: str) -> str:
    data = base64.b64encode((FONTS / name).read_bytes()).decode()
    return f'data:font/woff2;base64,{data}'

FAVICON = (OUT / 'favicon.svg').read_text()

BASE = f"""
@font-face {{ font-family: D; src: url('{font('Barlow-Condensed-800.woff2')}'); font-weight: 800; }}
@font-face {{ font-family: S; src: url('{font('IBM-Plex-Sans.woff2')}'); font-weight: 400 600; }}
@font-face {{ font-family: M; src: url('{font('IBM-Plex-Mono-600.woff2')}'); font-weight: 600; }}
* {{ box-sizing: border-box; margin: 0; }}
html, body {{ width: 100%; height: 100%; }}
body {{ background: {CASE}; color: {INK}; font-family: S, sans-serif;
  background-image: repeating-linear-gradient(45deg, rgb(255 255 255 / .025) 0 2px, transparent 2px 8px); }}
.frame {{ position: absolute; inset: 28px; pointer-events: none; --c: {HARDWARE};
  background:
    linear-gradient(var(--c), var(--c)) left top / 44px 8px no-repeat,
    linear-gradient(var(--c), var(--c)) left top / 8px 44px no-repeat,
    linear-gradient(var(--c), var(--c)) right top / 44px 8px no-repeat,
    linear-gradient(var(--c), var(--c)) right top / 8px 44px no-repeat,
    linear-gradient(var(--c), var(--c)) left bottom / 44px 8px no-repeat,
    linear-gradient(var(--c), var(--c)) left bottom / 8px 44px no-repeat,
    linear-gradient(var(--c), var(--c)) right bottom / 44px 8px no-repeat,
    linear-gradient(var(--c), var(--c)) right bottom / 8px 44px no-repeat; }}
.word {{ font: 800 1em/1 D, sans-serif; letter-spacing: .08em; text-transform: uppercase; }}
.line {{ font: 800 1em/.95 D, sans-serif; text-transform: uppercase; }}
.tape {{ display: inline-block; background: {TAPE}; color: #1c1d1f; font: 600 1em/1 M, monospace;
  letter-spacing: .06em; text-transform: uppercase; padding: .5em .8em .45em; transform: rotate(-1deg);
  clip-path: polygon(0 4%, 3% 0, 97% 6%, 100% 0, 99% 100%, 96% 94%, 2% 100%, 0 92%); }}
.amber {{ color: {AMBER}; }}
.muted {{ color: {MUTED}; }}
svg {{ display: block; width: 100%; height: auto; }}
"""

PAGES = {
    'og.png': (1200, 630, f"""
<div class="frame"></div>
<div style="position:absolute;left:96px;top:96px;display:flex;align-items:center;gap:22px;font-size:44px">
  <div style="width:80px">{MARK}</div><span class="word">Backline</span></div>
<div style="position:absolute;left:96px;top:236px;font-size:22px"><span class="tape">Discord bot + dashboard</span></div>
<div class="line" style="position:absolute;left:96px;top:300px;font-size:104px;width:980px">The gear behind<br>your community.</div>
<div class="muted" style="position:absolute;left:96px;bottom:84px;font-size:26px">23 modules. Each one muted until you bring it up.</div>
"""),
    'social-banner.png': (1500, 500, f"""
<div class="frame"></div>
<div style="position:absolute;left:110px;top:50%;transform:translateY(-50%);display:flex;align-items:center;gap:56px">
  <div style="width:220px">{MARK}</div>
  <div><div class="word" style="font-size:112px">Backline</div>
  <div class="line" style="font-size:46px;margin-top:22px">The gear behind <span class="amber">your community.</span></div></div></div>
"""),
    'social-square.png': (1080, 1080, f"""
<div class="frame" style="inset:44px"></div>
<div style="position:absolute;inset:0;display:grid;place-content:center;justify-items:center;gap:56px">
  <div style="width:420px">{MARK}</div><div class="word" style="font-size:150px">Backline</div></div>
"""),
    'apple-touch-icon.png': (180, 180, f"""
<div style="position:absolute;inset:0;display:grid;place-items:center"><div style="width:128px">{MARK}</div></div>
"""),
    'avatar.png': (512, 512, f"""
<div style="position:absolute;inset:0;display:grid;place-items:center"><div style="width:360px">{MARK}</div></div>
"""),
}


def ico_from_png(png: bytes, size: int) -> bytes:
    header = struct.pack('<HHH', 0, 1, 1)
    entry = struct.pack('<BBBBHHII', size, size, 0, 0, 1, 32, len(png), 22)
    return header + entry + png


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('--chromium', help='Chromium or chrome-headless-shell executable')
    args = parser.parse_args()
    outputs = {}
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=args.chromium, args=['--no-sandbox'])
        for name, (w, h, body) in PAGES.items():
            page = browser.new_page(viewport={'width': w, 'height': h})
            page.set_content(f'<!doctype html><style>{BASE}</style><body>{body}</body>')
            page.evaluate('document.fonts.ready.then(() => [...document.fonts].filter(f => f.status === "loaded").length)')
            page.wait_for_timeout(100)
            (OUT / name).write_bytes(page.screenshot())
            outputs[name] = OUT / name
            page.close()
        page = browser.new_page(viewport={'width': 32, 'height': 32})
        page.set_content(f'<!doctype html><style>html,body{{margin:0;background:transparent}}</style>{FAVICON}')
        png = page.screenshot(omit_background=True)
        ico = ROOT / 'frontend/public/favicon.ico'
        ico.write_bytes(ico_from_png(png, 32))
        outputs['favicon.ico'] = ico
        browser.close()

    receipt = {
        'direction': 'Road Case',
        'generator': 'brand/backline/render_assets.py',
        'sources': ['frontend/public/brand/backline/mark-light.svg', 'frontend/public/brand/backline/favicon.svg', 'frontend/public/brand/backline/fonts/'],
        'files': [
            {'path': str(path.relative_to(ROOT)), 'sha256': hashlib.sha256(path.read_bytes()).hexdigest(), 'bytes': path.stat().st_size}
            for path in outputs.values()
        ],
    }
    (ROOT / 'brand/backline/source-provenance.json').write_text(json.dumps(receipt, indent=2) + '\n')
    social = OUT / 'social-banner.png'
    (ROOT / 'brand/backline/social-banner.png').write_bytes(social.read_bytes())


if __name__ == '__main__':
    main()
