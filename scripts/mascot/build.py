#!/usr/bin/env python3
"""Draws Wall·ette's mascot poses as clean vector art (1.6.1).

Tracing the small approved artwork (about 300 px tall) colour by colour kept
its pixel steps: wobbly edges, outlines that swelled and thinned, specks and a
grey halo. Each pose is drawn again instead, part by part, from the artwork's
own measurements:

  - every part (head, face, visor, body, arms, hands, legs, shoes, leaf) is
    found in the artwork by its colours and its edge is fitted with a few
    smooth curves;
  - eyes, pupils, highlights and the button are exact circles; limbs are two
    smooth sides that tuck under the parts that cover them;
  - outlines are one even stroke per pose, and the colours one shared palette.

Writes assets/brand/mascot-<pose>.svg (each the size of its artwork, so the
app's canvas code can draw it) and the website's copies of the four poses it
shares, site/public/img/mascot-<pose>.svg. With --site, the website's four
larger scenes (scenes.py) as site/public/img/mascot-<scene>.svg.

Needs: pip install numpy pillow scipy scikit-image opencv-python
Usage: python3 scripts/mascot/build.py [pose ...] [--compare DIR]
       python3 scripts/mascot/build.py --site [scene ...] [--compare DIR]
       --compare writes artwork-beside-drawing PNGs to DIR (needs rsvg-convert).
"""
import os
import shutil
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import poses  # noqa: E402
import scenes  # noqa: E402
from pose import BRAND, ROOT, compare  # noqa: E402

POSES = ['welcome', 'think', 'encourage', 'celebrate', 'review']
SCENES = ['open-welcome', 'statement-review', 'gift-sharing', 'gentle-encourage']
SITE_IMG = os.path.join(ROOT, 'site', 'public', 'img')
SITE_POSES = ['welcome', 'think', 'encourage', 'celebrate']


def build_scenes(names, out_dir):
    for name in names or SCENES:
        if name not in SCENES:
            raise SystemExit('unknown scene %r (one of %s)' % (name, ', '.join(SCENES)))
        scene = getattr(scenes, name.replace('-', '_'))()
        path = os.path.join(SITE_IMG, 'mascot-%s.svg' % name)
        report = scene.save(path)
        print('%s: %s (%d bytes)' % (name, os.path.relpath(path, ROOT), os.path.getsize(path)))
        if os.environ.get('VERBOSE'):
            print(report)
        if out_dir:
            compare(name, path, os.path.join(out_dir, 'mascot-%s.png' % name), src=os.path.join(SITE_IMG, 'mascot-%s.webp' % name))


def main(args):
    out_dir = None
    if '--compare' in args:
        i = args.index('--compare')
        out_dir = args[i + 1]
        args = args[:i] + args[i + 2:]
        os.makedirs(out_dir, exist_ok=True)
    if args[:1] == ['--site']:
        return build_scenes(args[1:], out_dir)
    for name in args or POSES:
        if name not in POSES:
            raise SystemExit('unknown pose %r (one of %s)' % (name, ', '.join(POSES)))
        pose = getattr(poses, name)()
        path = os.path.join(BRAND, 'mascot-%s.svg' % name)
        report = pose.save(path)
        print('%s: %s (%d bytes)' % (name, os.path.relpath(path, ROOT), os.path.getsize(path)))
        if os.environ.get('VERBOSE'):
            print(report)
        if name in SITE_POSES:
            shutil.copyfile(path, os.path.join(SITE_IMG, 'mascot-%s.svg' % name))
        if out_dir:
            compare(name, path, os.path.join(out_dir, 'mascot-%s.png' % name))


if __name__ == '__main__':
    main(sys.argv[1:])
