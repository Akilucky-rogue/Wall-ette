#!/usr/bin/env python3
"""
Wall·ette's wordmark as a vector, traced from the approved artwork, so it
stays sharp at any size (as scripts/brand-icons.mjs does for the icon).

- Wordmark: assets/brand/wordmark.webp (the brand kit's logo, 933 x 176) is
  traced with potrace at 4x. The letters use currentColor, so the app's light
  and dark themes colour them; the dot is a true circle in brand sage (class
  wm-dot, which dark themes lighten).
- The mascot poses are no longer traced: scripts/mascot/build.py draws them
  as clean vector art. --pose still traces one from its artwork (enlarged 6x,
  smoothed, snapped to its palette, traced with vtracer) for comparison.
- With --site, the website's larger scenes are traced the same way to
  site/public/img/mascot-<scene>.svg.

Writes assets/brand/wordmark.svg.

Needs: pip install pillow numpy potracer vtracer
Usage: python3 scripts/brand-trace.py
       python3 scripts/brand-trace.py --pose <pose> <out.svg>
       python3 scripts/brand-trace.py --site [scene ...]
"""
import io
import os
import re
import sys

import numpy as np
from PIL import Image, ImageFilter
import potrace
import vtracer

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BRAND = os.path.join(ROOT, 'assets', 'brand')
SCALE = 4

NUM = re.compile(r'-?\d*\.?\d+(?:e-?\d+)?')


def compact(d):
    """An absolute path (M, L, C, Z, as potrace and vtracer write them) as
    relative commands, one decimal: about a third smaller."""
    out, x, y, sx, sy = [], 0.0, 0.0, 0.0, 0.0
    fmt = lambda v: re.sub(r'^(-?)0\.', r'\1.', f'{v:.1f}'.rstrip('0').rstrip('.')) if abs(v) >= 0.05 else '0'
    def join(vals):
        txt = ''
        for v in vals:
            t = fmt(v)
            if t.startswith('-') or not txt:
                txt += t
            else:
                txt += ' ' + t
        return txt.replace(' -', '-')
    for cmd, args in re.findall(r'([MLCZmlcz])([^MLCZmlcz]*)', d):
        n = [float(v) for v in NUM.findall(args)]
        if cmd == 'M':
            for i in range(0, len(n), 2):
                nx, ny = round(n[i], 1), round(n[i + 1], 1)
                out.append(('m' if out else 'M') + (join([nx - x, ny - y]) if out else join([nx, ny])))
                x, y = nx, ny
            sx, sy = x, y
        elif cmd == 'L':
            for i in range(0, len(n), 2):
                nx, ny = round(n[i], 1), round(n[i + 1], 1)
                out.append('l' + join([nx - x, ny - y]))
                x, y = nx, ny
        elif cmd == 'C':
            for i in range(0, len(n), 6):
                a, b, c, e, g, h = (round(v, 1) for v in n[i:i + 6])
                out.append('c' + join([a - x, b - y, c - x, e - y, g - x, h - y]))
                x, y = g, h
        elif cmd in 'Zz':
            out.append('z')
            x, y = sx, sy
        else:
            return d  # already relative: leave it
    return ''.join(out)


def svg_path(curves, scale):
    """potrace curves as one SVG path, in the source image's units."""
    f = lambda v: f'{v / scale:.1f}'.rstrip('0').rstrip('.')
    out = []
    for curve in curves:
        s = curve.start_point
        out.append(f'M{f(s.x)} {f(s.y)}')
        for seg in curve.segments:
            if seg.is_corner:
                c, e = seg.c, seg.end_point
                out.append(f'L{f(c.x)} {f(c.y)}L{f(e.x)} {f(e.y)}')
            else:
                a, b, e = seg.c1, seg.c2, seg.end_point
                out.append(f'C{f(a.x)} {f(a.y)} {f(b.x)} {f(b.y)} {f(e.x)} {f(e.y)}')
        out.append('Z')
    return ''.join(out)


def wordmark():
    src = Image.open(os.path.join(BRAND, 'wordmark.webp')).convert('RGBA')
    w, h = src.size
    big = src.resize((w * SCALE, h * SCALE), Image.LANCZOS)
    a = np.asarray(big).astype(np.float32)
    rgb, alpha = a[..., :3], a[..., 3] / 255.0
    # Sage dot: clearly green; ink: everything else that's opaque.
    green = (rgb[..., 1] > rgb[..., 0] + 8) & (rgb[..., 1] > rgb[..., 2] + 30)
    solid = alpha > 0.5
    ink = solid & ~green
    dot = solid & green
    # potracer traces where the bitmap is False.
    ink_curves = potrace.Bitmap(~ink).trace(turdsize=200, alphamax=1.0, opticurve=True, opttolerance=0.2)
    ys, xs = np.nonzero(dot)
    cx, cy = xs.mean() / SCALE, ys.mean() / SCALE
    r = np.sqrt(dot.sum() / np.pi) / SCALE
    sage = '#{:02X}{:02X}{:02X}'.format(*[int(v) for v in np.median(rgb[dot], axis=0)])
    svg = (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}">'
        f'<path fill="currentColor" d="{compact(svg_path(ink_curves, SCALE))}"/>'
        f'<circle class="wm-dot" cx="{cx:.1f}" cy="{cy:.1f}" r="{r:.1f}" fill="{sage}"/>'
        '</svg>\n'
    )
    open(os.path.join(BRAND, 'wordmark.svg'), 'w').write(svg)
    print(f'wordmark.svg: {len(svg) // 1024} KB, dot {sage} r={r:.1f}')


def palette(px, k):
    """k colours for a pose by k-means, plus any small accent (the gold
    button, sparkles) that k-means would merge into a bigger area."""
    pal = np.asarray(Image.fromarray(px.astype(np.uint8)[None]).quantize(colors=k, method=Image.Quantize.MEDIANCUT)
                     .getpalette()[:k * 3], dtype=np.float32).reshape(k, 3)
    for _ in range(15):
        lab = ((px[:, None, :] - pal[None]) ** 2).sum(-1).argmin(1)
        for i in range(k):
            if (lab == i).any():
                pal[i] = px[lab == i].mean(0)
    r, g, b = px[:, 0], px[:, 1], px[:, 2]
    gold = (r > 150) & (g > 100) & (b < 110) & (r - b > 70)
    if gold.sum() > 15:
        pal = np.vstack([pal, px[gold].mean(0)])
    return pal


def mascot(pose, k=12, up=6, sigma=1.6, asigma=1.8, length=40.0, speckle=60, src_path=None, out_path=None):
    """Enlarged and snapped to the pose's own palette, then every region's
    edge smoothed at once before tracing (1.6.1): each colour's mask is
    blurred by `sigma` source pixels and every pixel goes to the strongest,
    so the staircase of the small source becomes smooth curves (the
    outlines read clean at any size); `asigma` smooths the silhouette the
    same way. Details under about a pixel and a half go. Coordinates go back
    to the source's units, one decimal."""
    src = Image.open(src_path or os.path.join(BRAND, f'mascot-{pose}.webp')).convert('RGBA')
    a0 = np.asarray(src).astype(np.float32)
    pal = palette(a0[a0[..., 3] > 200][:, :3], k)
    big = src.resize((src.size[0] * up, src.size[1] * up), Image.LANCZOS)
    b = np.asarray(big.convert('RGB').filter(ImageFilter.GaussianBlur(up * 0.35))).astype(np.float32)
    hgt, wid = b.shape[:2]
    flat = b.reshape(-1, 3)
    lab = np.empty(flat.shape[0], dtype=np.uint8)
    for i in range(0, flat.shape[0], 400000):
        lab[i:i + 400000] = ((flat[i:i + 400000, None, :] - pal[None]) ** 2).sum(-1).argmin(1)
    lab = lab.reshape(hgt, wid)
    best = np.zeros((hgt, wid), np.float32)
    voted = np.zeros((hgt, wid), np.uint8)
    for j in range(len(pal)):
        m = Image.fromarray(((lab == j) * 255).astype(np.uint8), 'L').filter(ImageFilter.GaussianBlur(up * sigma))
        v = np.asarray(m).astype(np.float32)
        sel = v > best
        best[sel] = v[sel]
        voted[sel] = j
    alpha = np.asarray(big.getchannel('A').filter(ImageFilter.GaussianBlur(up * asigma))) > 128
    q = pal[voted].astype(np.uint8)
    img = Image.fromarray(np.dstack([q, (alpha * 255).astype(np.uint8)]), 'RGBA')
    buf = io.BytesIO()
    img.save(buf, format='PNG')
    svg = vtracer.convert_raw_image_to_svg(
        buf.getvalue(), img_format='png', colormode='color', hierarchical='stacked', mode='spline',
        filter_speckle=speckle, color_precision=8, layer_difference=1, corner_threshold=100,
        length_threshold=length, max_iterations=10, splice_threshold=50, path_precision=0,
    )
    num = lambda m: f'{float(m.group(0)) / up:.1f}'.rstrip('0').rstrip('.')
    fix = lambda m: m.group(1) + re.sub(r'-?\d+(?:\.\d+)?', num, m.group(2)) + m.group(3)
    body = re.search(r'<svg[^>]*>(.*)</svg>', svg, re.S).group(1)
    body = re.sub(r'(\b(?:d|transform)=")([^"]*)(")', fix, body)
    def flatten(m):
        d, fill, tx, ty = m.group(1), m.group(2), float(m.group(3) or 0), float(m.group(4) or 0)
        moved = re.sub(r'([MLC])([^MLCZ]*)', lambda c: c.group(1) + ' '.join(
            f'{float(v) + (tx if i % 2 == 0 else ty):.1f}' for i, v in enumerate(NUM.findall(c.group(2)))), d)
        return f'<path fill="{fill}" d="{compact(moved)}"/>'
    body = re.sub(r'<path d="([^"]*)" fill="([^"]*)"(?: transform="translate\(([-\d.]+),([-\d.]+)\)")?\s*/>', flatten, body)
    w, h = src.size
    out = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}">{body.strip()}</svg>\n'
    open(out_path or os.path.join(BRAND, f'mascot-{pose}.svg'), 'w').write(out)
    print(f'{os.path.basename(out_path or pose)}: {len(out) // 1024} KB, {out.count("<path")} shapes')


SITE_IMG = os.path.join(ROOT, 'site', 'public', 'img')
# The website's larger scenes (800 px tall), traced the same way.
SITE_SCENES = ['open-welcome', 'statement-review', 'gift-sharing', 'gentle-encourage']


if __name__ == '__main__':
    args = sys.argv[1:]
    if args[:1] == ['--site']:
        for scene in args[1:] or SITE_SCENES:
            mascot(scene, k=14, up=4, src_path=os.path.join(SITE_IMG, f'mascot-{scene}.webp'),
                   out_path=os.path.join(SITE_IMG, f'mascot-{scene}.svg'))
    elif args[:1] == ['--pose'] and len(args) == 3:
        mascot(args[1], out_path=args[2])
    else:
        wordmark()
