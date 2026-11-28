"""One pose being redrawn: the artwork, the SVG being built, and the drawing helpers."""
import math
import os
import numpy as np
from geometry import *
from svg import SVG, loop_path

INK = '#2B2F1E'; HEAD = '#99AC70'; HEAD_RIM = '#728F4F'; CREAM = '#F6E8D4'; GREEN = '#41653E'
GREEN_SHADE = '#355834'; LEAF = '#5B8339'; VEIN = '#F6F7E6'; GOLD = '#CDA14A'; RING = '#A3B47C'
RING_HL = '#CFDDB5'; IRIS = '#87A05F'; SPOKE = '#6F8B4E'; HILITE = '#FCFAF3'
BASE_REFS = {'ink': (44, 47, 28), 'green': (65, 101, 62), 'shade': (46, 77, 42), 'head': (154, 171, 113),
             'rim': (103, 133, 69), 'leaf': (91, 131, 55), 'cream': (246, 231, 211), 'white': (252, 252, 242),
             'gold': (204, 161, 75), 'ringhl': (208, 222, 184), 'iris': (130, 155, 90)}
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
BRAND = os.path.join(ROOT, 'assets', 'brand')
CR = ['cream', 'white']
LIMB = ['cream', 'white', 'ringhl']


class Pose:
    def __init__(self, name, ow, refs=None, src=None):
        self.name = name
        self.OW = ow
        self.A = Art(src or os.path.join(BRAND, 'mascot-%s.webp' % name), refs or BASE_REFS)
        self.S = SVG(self.A.W, self.A.H, prefix=name)
        self.report = []
        self.YY = np.mgrid[0:self.A.L.shape[0], 0:self.A.L.shape[1]][0] / UP
        self.XX = np.mgrid[0:self.A.L.shape[0], 0:self.A.L.shape[1]][1] / UP

    # ------------------------------------------------------------ areas
    def reg(self, classes, *seeds, **kw):
        return self.A.region(classes, list(seeds), **kw)

    def seg(self, *seeds):
        return self.A.region(LIMB, list(seeds))

    def drawn(self, m, lined=True):
        return grow(m, self.OW) if lined else m

    # ------------------------------------------------------------ drawing
    def fit(self, name, mask, n, offset=0.0, kappa=2.0, lam=0.02):
        d, (em, ex) = shape(mask, n, offset, kappa, lam)
        self.report.append('%-10s n=%2d  mean %.2f  max %.2f' % (name, n, em, ex))
        return d

    def draw(self, d, fill, inner=None, clip=None):
        S = self.S
        items = [S.path(d, fill=fill)]
        if inner:
            items += inner(d)
        items.append(S.path(d, stroke=INK, sw=self.OW))
        S.add(S.group(items, clip=clip) if clip else ''.join(items))
        return d

    def outlined(self, name, mask, n, fill, kappa=2.0, inner=None, lam=0.02):
        return self.draw(self.fit(name, mask, n, self.OW / 2, kappa, lam), fill, inner)

    def joint(self, a, b, ext=6, width=None):
        """A crease line where two areas of one part meet; returns a draw callback."""
        width = width or self.OW / 2 + 1.0
        pts = order_along(boundary_between(a, b, width))
        P, e = fit_cubic(pts)
        P = extend(P, ext, ext)
        S = self.S
        return lambda d: [S.group([S.path(cubic_d(P), stroke=INK, sw=self.OW)], clip=S.clip(d))]

    def limb(self, name, mask, covers, fill=CREAM, m=4, joints=()):
        """covers: parts this limb tucks under, as area or (area, outlined, gap)."""
        cv = []
        for c in covers:
            c, lined, gap = (c, True, 0.0) if not isinstance(c, tuple) else c
            dr = self.drawn(c, lined)
            cv.append((grow(dr, 0.5 + gap), dr))
        d = two_sided(mask, cv, self.OW / 2, m, report=self.report, name=name)
        inner = (lambda dd: sum((j(dd) for j in joints), [])) if joints else None
        return self.draw(d, fill, inner)

    def shoe(self, name, green, collar, n=16):
        whole = close_fill(green | collar, 1.0)
        S = self.S
        OW = self.OW

        def inner(d):
            cy, cx = ndimage.center_of_mass(green)
            dd, P, e = split_d(collar, green, side_pt=(cx / UP, cy / UP), width=OW / 2 + 0.8)
            return [S.group([S.path(dd, fill=GREEN)], clip=S.clip(d))]
        return self.outlined(name, whole, n, CREAM, kappa=2.5, inner=inner)

    def body(self, body_fit, head_d, n=12, shade=(0.11, -0.105), head_drop=0.033, button=None):
        ys, xs = np.nonzero(body_fit)
        bw, bh = (xs.max() - xs.min()) / UP, (ys.max() - ys.min()) / UP
        S = self.S

        def inner(d):
            items = [S.path(d, fill=GREEN_SHADE),
                     S.path(d, fill=GREEN, extra=' transform="translate(%s %s)"' % (num(shade[0] * bw), num(shade[1] * bh)))]
            if head_d:
                hy = head_drop * bh * 1.7
                items.append(S.path(head_d, fill=GREEN_SHADE, extra=' transform="translate(0 %s)"' % num(hy)))
            return [S.group(items, clip=S.clip(d))]
        d = self.outlined('body', body_fit, n, GREEN, inner=inner)
        if button is not None:
            cx, cy, r = button
            S.add(S.circle(cx, cy, r, fill=GOLD))
        return d

    def head_mask(self, seed, leaf=None, classes=('head',), exclude=(), behind=(), rim_depth=None):
        """The head's area (with its darker rim), before anything is drawn."""
        A = self.A
        core = A.region(list(classes), [seed], holes=False)
        # drop thin strands (the leaf's stem, edge specks)
        op = ndimage.binary_opening(core, morphology.disk(3 * UP))
        lab, _ = ndimage.label(op)
        v = lab[int(seed[1] * UP), int(seed[0] * UP)]
        if v:
            core = ndimage.binary_fill_holes(lab == v) | (core & grow(lab == v, 0.5))
        lab, _ = ndimage.label(A.cls('rim', 'leaf', 'green', 'shade') & grow(core, 12) &
                               (self.YY > ndimage.center_of_mass(core)[0] / UP))
        touch = np.unique(lab[grow(core, 1.5) & (lab > 0)])
        rim = np.isin(lab, touch[touch > 0])
        for e in exclude:                      # hands or arms that touch the head are not its rim
            rim &= ~grow(e, 1.0)
        if rim_depth:                          # the rim is a band along the edge, not specks inside
            rim &= grow(~ndimage.binary_fill_holes(core | rim), rim_depth)
        head = close_fill(core | rim, 1.5)
        if leaf is not None:
            head |= morphology.convex_hull_image(head) & grow(leaf, 3)
        for b in behind:                       # parts in front of the head: it carries on under them
            head |= morphology.convex_hull_image(head) & grow(b, self.OW + 1.0)
        self.head_mask_, self.head_core, self.head_rim = head, core, rim
        self.head_d = shape(head, 16, 0.0, 1.5)[0]
        return head

    def draw_head(self, n=16, shift=None):
        """The head, with its darker rim along the lower left: either where the artwork
        has it (split along the rim's inner edge), or, with shift=(dx, dy), as the head's
        own shape moved up and right over a darker copy (an even crescent)."""
        head, core, rim = self.head_mask_, self.head_core, self.head_rim
        hd = self.fit('head', head, n, 0.0, 1.5)
        S = self.S
        if shift is not None:
            items = [S.path(hd, fill=HEAD_RIM),
                     S.path(hd, fill=HEAD, extra=' transform="translate(%s %s)"' % (num(shift[0]), num(shift[1])))]
            S.add(S.group(items, clip=S.clip(hd)))
            return hd
        items = [S.path(hd, fill=HEAD)]
        if rim.sum() > 50 * UP * UP:
            ys, xs = np.nonzero(head)
            rd, P, e = split_d(core, rim, side_pt=(xs.mean() / UP, ys.max() / UP + 40), width=2.0)
            items.append(S.group([S.path(rd, fill=HEAD_RIM)], clip=S.clip(hd)))
        S.add(''.join(items))
        return hd

    def face(self, face_seed, visor_seed, nf=14, nv=20):
        A, S = self.A, self.S
        face = A.region(CR, [face_seed])
        S.add(S.path(self.fit('face', face, nf, 0.0, 1.5), fill=CREAM))
        visor = A.region(['ink'], [visor_seed])
        S.add(S.path(self.fit('visor', visor, nv, 0.0, 2.0), fill=INK))
        self.visor = visor
        return face, visor

    def circle_of(self, mask):
        a = mask.sum() / UP / UP
        cy, cx = ndimage.center_of_mass(mask)
        return (cx + 0.5) / UP, (cy + 0.5) / UP, math.sqrt(a / math.pi)

    def eyes(self, left_seed, right_seed, spokes=24):
        """Measures both eyes in the artwork and draws them as exact circles."""
        A, S = self.A, self.S
        ring = close_fill(A.region(['head', 'iris', 'ringhl', 'rim', 'leaf'], [left_seed]), 1.0)
        lx, ly, lr = self.circle_of(ring)
        inner = disc_mask(ring.shape, lx, ly, lr - 1.0)
        lab, n = ndimage.label(A.cls('ink') & inner)
        sizes = ndimage.sum(np.ones_like(lab), lab, range(1, n + 1))
        pupil = lab == (int(np.argmax(sizes)) + 1)
        px, py, pr = self.circle_of(ndimage.binary_fill_holes(pupil | (A.cls('white', 'cream') & inner & grow(pupil, 1))))
        hl = A.cls('white', 'cream') & inner
        lab, n = ndimage.label(hl)
        sizes = ndimage.sum(np.ones_like(lab), lab, range(1, n + 1))
        hx, hy, hr = self.circle_of(lab == (int(np.argmax(sizes)) + 1))
        # the light arc on the ring
        m = A.cls('ringhl') & disc_mask(ring.shape, lx, ly, lr + 1) & ~disc_mask(ring.shape, lx, ly, pr - 0.5)
        yy, xx = np.nonzero(m)
        S.add(S.circle(lx, ly, lr, fill=RING))
        if len(xx) > 30 * UP * UP:
            ang = (np.degrees(np.arctan2((yy + .5) / UP - ly, (xx + .5) / UP - lx)) + 360) % 360
            h, e = np.histogram(ang, bins=36, range=(0, 360))
            on = h > h.max() * 0.25
            # the longest run of bins with highlight, cyclic
            best, cur, start, bstart = 0, 0, 0, 0
            for i in range(72):
                if on[i % 36]:
                    if cur == 0:
                        start = i
                    cur += 1
                    if cur > best:
                        best, bstart = cur, start
                else:
                    cur = 0
            best = min(best, 36)
            a0, a1 = bstart * 10, bstart * 10 + best * 10
            rin, rout = pr + 0.8, lr - 2.5
            S.add(S.path(arc(lx, ly, (rin + rout) / 2, a0, a1), stroke=RING_HL, sw=rout - rin, extra=' stroke-linecap="butt"'))
            self.report.append('ring arc %d-%d deg' % (a0, a1))
        S.add(S.circle(px, py, pr, fill=INK))
        S.add(S.circle(hx, hy, hr, fill=HILITE))
        # right eye: a lens with spokes
        iris = close_fill(A.region(['head', 'iris', 'ringhl', 'rim', 'leaf'], [right_seed]), 1.0)
        rx, ry, rr = self.circle_of(iris)
        inner = disc_mask(iris.shape, rx, ry, rr - 1.0)
        lab, n = ndimage.label(A.cls('ink') & inner)
        sizes = ndimage.sum(np.ones_like(lab), lab, range(1, n + 1))
        pupil = lab == (int(np.argmax(sizes)) + 1)
        qx, qy, qr = self.circle_of(ndimage.binary_fill_holes(pupil | (A.cls('white', 'cream') & inner & grow(pupil, 1))))
        hl = A.cls('white', 'cream') & inner
        lab, n = ndimage.label(hl)
        sizes = ndimage.sum(np.ones_like(lab), lab, range(1, n + 1))
        gx, gy, gr = self.circle_of(lab == (int(np.argmax(sizes)) + 1))
        S.add(S.circle(rx, ry, rr, fill=IRIS))
        sp = []
        for i in range(spokes):
            a = 2 * math.pi * (i + 0.5) / spokes
            sp.append('M%s %sL%s %s' % (num(qx + (qr + 1.0) * math.cos(a)), num(qy + (qr + 1.0) * math.sin(a)),
                                        num(rx + (rr - 1.3) * math.cos(a)), num(ry + (rr - 1.3) * math.sin(a))))
        S.add(S.path(''.join(sp), stroke=SPOKE, sw=round(rr / 29, 2)))
        S.add(S.circle(qx, qy, qr, fill=INK))
        S.add(S.circle(gx, gy, gr, fill=HILITE))
        self.report.append('eyes: L ring (%.1f,%.1f) r%.1f pupil r%.1f hl r%.1f | R iris (%.1f,%.1f) r%.1f pupil r%.1f hl r%.1f'
                           % (lx, ly, lr, pr, hr, rx, ry, rr, qr, gr))

    def leaf(self, seed, vein_seed, head_core, vein_classes=None, leaf_classes=('leaf', 'rim'), over_head=False):
        A, S = self.A, self.S
        hull = morphology.convex_hull_image(head_core)
        leaf_only = A.region(list(leaf_classes), [seed], holes=False)
        # where the leaf lies over the head, keep it (over_head) or leave it to the head
        leaf_only &= ~grow(head_core, 0.5) if over_head else ~hull
        if vein_classes:
            # only the light stroke inside the leaf, not the light rim round it
            vein = A.region(list(vein_classes), [vein_seed], holes=False,
                            within=shrink(morphology.convex_hull_image(leaf_only | hull), 1.0) | hull)
        else:
            vein = A.region(LIMB, [vein_seed])
        leafm = close_fill(leaf_only | (vein & morphology.convex_hull_image(leaf_only) & ~hull), 1.0)
        lp = resample(outline(leafm, 0.0, 0.6), 0.25)
        tip = lp[np.argmax(lp[:, 0] - lp[:, 1])]
        base = lp[np.argmax(lp[:, 1] - 0.3 * lp[:, 0])]
        i_t = int(np.argmin(((lp - tip) ** 2).sum(1)))
        i_b = int(np.argmin(((lp - base) ** 2).sum(1)))
        lp2 = np.roll(lp, -i_b, 0)
        k = (i_t - i_b) % len(lp)
        c1, c2 = lp2[:k + 1], np.vstack([lp2[k:], lp2[:1]])
        s1, e1 = fit_open(c1, 5)
        s2, e2 = fit_open(c2, 6)
        self.report.append('leaf sides err %.2f %.2f' % (e1, e2))
        S.add(S.path(segs_d(s1) + segs_d(s2, move=False) + 'Z', fill=LEAF))
        pts = order_along(mask_points(vein))
        P, e = fit_cubic(pts)
        # the stem end is the lower one
        if P[0][1] < P[3][1]:
            P = P[::-1].copy()
        ys, xs = np.nonzero(leafm)
        size = (ys.max() - ys.min()) / UP
        k = size / 55.0
        S.add(S.path(loop_path(tapered(P, 2.8 * k, 1.0 * k, 3.8 * k, 28)), fill=VEIN))
        return leafm, vein

    def save(self, path):
        open(path, 'w').write(self.S.text())
        return '\n'.join(self.report)


def arc(cx, cy, r, a0, a1):
    p0 = (cx + r * math.cos(math.radians(a0)), cy + r * math.sin(math.radians(a0)))
    p1 = (cx + r * math.cos(math.radians(a1)), cy + r * math.sin(math.radians(a1)))
    large = 1 if (a1 - a0) % 360 > 180 else 0
    return 'M%s %sA%s %s 0 %d 1 %s %s' % (num(p0[0]), num(p0[1]), num(r), num(r), large, num(p1[0]), num(p1[1]))


def compare(pose, svg, out, src=None):
    """Side by side: the artwork and the redraw, same size."""
    import subprocess
    from PIL import Image
    src = Image.open(src or os.path.join(BRAND, 'mascot-%s.webp' % pose)).convert('RGBA')
    s = 3 if src.width < 400 else 2
    W, H = src.width * s, src.height * s
    tmp = out + '.render.png'
    subprocess.run(['rsvg-convert', '-w', str(W), svg, '-o', tmp], check=True)
    r = Image.open(tmp).convert('RGBA')
    os.remove(tmp)
    a = Image.new('RGBA', (W, H), (255, 255, 255, 255)); a.alpha_composite(src.resize((W, H), Image.LANCZOS))
    b = Image.new('RGBA', r.size, (255, 255, 255, 255)); b.alpha_composite(r)
    c = Image.new('RGB', (W * 2 + 10, H), 'white'); c.paste(a.convert('RGB'), (0, 0)); c.paste(b.convert('RGB'), (W + 10, 0))
    c.save(out)


def dashes(P, seeds, color=GOLD):
    """Short strokes (sparkles): each gold mark as one straight round-capped line."""
    A, S = P.A, P.S
    for sd in seeds:
        m = A.region(['gold'], [sd])
        pts = mask_points(m)
        c = pts.mean(0)
        u, s_, vt = np.linalg.svd(pts - c, full_matrices=False)
        d = vt[0]
        proj = (pts - c) @ d
        a, b = np.percentile(proj, 1), np.percentile(proj, 99)
        area = m.sum() / UP / UP
        w = area / max(b - a, 1e-6) * 0.86      # the mark's soft fringe is not its width
        # round caps add w/2 at each end
        p0 = c + d * (a + w / 2)
        p1 = c + d * (b - w / 2)
        S.add('<path d="M%s %sL%s %s" stroke="%s" stroke-width="%s" stroke-linecap="round" fill="none"/>' % (
            num(p0[0]), num(p0[1]), num(p1[0]), num(p1[1]), color, num(w)))
        P.report.append('dash (%.1f,%.1f)-(%.1f,%.1f) w%.2f' % (p0[0], p0[1], p1[0], p1[1], w))


def torso(P, box, exclude=()):
    """Every dark-green piece of the torso inside a box (x0, y0, x1, y1)."""
    A = P.A
    x0, y0, x1, y1 = box
    g = A.cls('green', 'shade', 'gold') & (P.XX > x0) & (P.XX < x1) & (P.YY > y0) & (P.YY < y1)
    for e in exclude:
        g &= ~grow(e, 1.0)
    lab, n = ndimage.label(g)
    sz = ndimage.sum(g, lab, range(1, n + 1)) / UP / UP
    return np.isin(lab, [i + 1 for i in range(n) if sz[i] > 6])


def smile(P, seed, color=HILITE):
    """A closed happy eye: one white arc, drawn as a round-capped stroke on a fitted circle."""
    import math
    A, S = P.A, P.S
    m = A.region(['white', 'cream', 'ringhl'], [seed])
    sk = morphology.skeletonize(m)
    pts = mask_points(sk)
    # least-squares circle through the arc's centre line
    x, y = pts[:, 0], pts[:, 1]
    M = np.stack([x, y, np.ones_like(x)], 1)
    sol, *_ = np.linalg.lstsq(M, -(x ** 2 + y ** 2), rcond=None)
    cx, cy = -sol[0] / 2, -sol[1] / 2
    r = math.sqrt(cx ** 2 + cy ** 2 - sol[2])
    ang = np.degrees(np.arctan2(y - cy, x - cx))
    # the arc's span: its points lie in one angular run (the upper half, for a smile-shaped eye)
    ang = (ang + 360) % 360
    a_sorted = np.sort(ang)
    gaps = np.diff(np.concatenate([a_sorted, [a_sorted[0] + 360]]))
    j = int(np.argmax(gaps))
    a0 = a_sorted[(j + 1) % len(a_sorted)]
    a1 = a_sorted[j]
    span = (a1 - a0) % 360
    width = (m.sum() / UP / UP) / (math.radians(span) * r + 1e-6)
    # caps are round: pull the ends in by half the width
    trim = math.degrees((width / 2) / r)
    a0 += trim * 0.9
    a1 -= trim * 0.9
    S.add(arc(cx, cy, r, a0, a0 + ((a1 - a0) % 360)).replace('M', '<path d="M', 1) +
          '" fill="none" stroke="%s" stroke-width="%s" stroke-linecap="round"/>' % (color, num(width)))
    P.report.append('smile: centre (%.1f,%.1f) r%.1f, %d-%d deg, width %.2f' % (cx, cy, r, a0, a1, width))
