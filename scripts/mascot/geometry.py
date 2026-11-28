"""Geometry for redrawing the mascot: reading the artwork's colour areas and
turning their edges into a few smooth Bezier curves.

All coordinates are in the artwork's own pixels; masks are kept at UP times
that resolution so edges can be measured to a fraction of a pixel.
"""
import math

import numpy as np
from PIL import Image
from scipy import ndimage
from skimage import color, measure, morphology

UP = 4


class Art:
    """The source artwork with every pixel given one of a few named colours."""

    def __init__(self, path, refs):
        src = Image.open(path).convert('RGBA')
        self.W, self.H = src.size
        self.src = src
        big = src.resize((self.W * UP, self.H * UP), Image.LANCZOS)
        a = np.asarray(big).astype(np.float32)
        alpha = a[..., 3]
        rgb = a[..., :3] / 255.0
        lab = color.rgb2lab(np.clip(rgb, 0, 1))
        names = list(refs)
        ref_lab = color.rgb2lab(np.array([[refs[n] for n in names]], np.float32) / 255.0)[0]
        d = ((lab[:, :, None, :] - ref_lab[None, None]) ** 2).sum(-1)
        lab_idx = d.argmin(-1)
        lab_idx[alpha < 128] = len(names)          # background
        names.append('bg')
        # soft vote, so anti-aliased edges and specks settle into their neighbours
        best = np.full(lab_idx.shape, -1.0, np.float32)
        voted = np.zeros(lab_idx.shape, np.int16)
        for j in range(len(names)):
            v = ndimage.gaussian_filter((lab_idx == j).astype(np.float32), UP * 0.45)
            sel = v > best
            best[sel] = v[sel]
            voted[sel] = j
        self.names = names
        self.L = voted
        self.alpha = alpha

    def cls(self, *names):
        idx = [self.names.index(n) for n in names]
        return np.isin(self.L, idx)

    def at(self, x, y):
        return self.names[self.L[int(y * UP), int(x * UP)]]

    def region(self, classes, seeds, close=0.0, holes=True, opening=0.0, within=None):
        """The connected area(s) of these colours that hold the seed points (1x coords)."""
        m = self.cls(*classes)
        if within is not None:
            m &= within
        if opening:
            m = ndimage.binary_opening(m, morphology.disk(int(round(opening * UP))))
        lab, _ = ndimage.label(m)
        keep = set()
        for (x, y) in seeds:
            v = lab[int(round(y * UP)), int(round(x * UP))]
            if v == 0:
                # nearest labelled pixel within 2px
                r = 2 * UP
                yy, xx = int(round(y * UP)), int(round(x * UP))
                win = lab[max(0, yy - r):yy + r, max(0, xx - r):xx + r]
                vals = win[win > 0]
                if len(vals) == 0:
                    raise ValueError('seed (%s,%s) is on %s' % (x, y, self.at(x, y)))
                v = np.bincount(vals).argmax()
            keep.add(v)
        out = np.isin(lab, list(keep))
        if close:
            out = ndimage.binary_closing(np.pad(out, 16), morphology.disk(int(round(close * UP))))[16:-16, 16:-16]
        if holes:
            out = ndimage.binary_fill_holes(out)
        return out


def grow(mask, px):
    if px <= 0:
        return mask
    d = ndimage.distance_transform_edt(~mask)
    return d <= px * UP


def shrink(mask, px):
    if px <= 0:
        return mask
    d = ndimage.distance_transform_edt(mask)
    return d > px * UP


def disc_mask(shape, cx, cy, r):
    yy, xx = np.mgrid[0:shape[0], 0:shape[1]]
    return ((xx + 0.5) / UP - cx) ** 2 + ((yy + 0.5) / UP - cy) ** 2 <= r * r


def poly_mask(shape, pts):
    from skimage.draw import polygon
    m = np.zeros(shape, bool)
    xs = np.array([p[0] for p in pts]) * UP
    ys = np.array([p[1] for p in pts]) * UP
    rr, cc = polygon(ys, xs, shape)
    m[rr, cc] = True
    return m


def outline(mask, offset=0.0, smooth=0.5):
    """The mask's outer edge as points (1x coords), pushed out by `offset` px."""
    d = ndimage.distance_transform_edt(mask) - ndimage.distance_transform_edt(~mask)
    d = ndimage.gaussian_filter(d.astype(np.float32), UP * smooth)
    pad = np.pad(d, 2, constant_values=d.min())
    cs = measure.find_contours(pad, -offset * UP)
    c = max(cs, key=lambda c: polygon_area(c))
    c = c - 2
    pts = np.stack([(c[:, 1] + 0.5) / UP, (c[:, 0] + 0.5) / UP], 1)
    if np.allclose(pts[0], pts[-1]):
        pts = pts[:-1]
    # counter-clockwise in screen coords is irrelevant to SVG; keep as found
    return pts


def polygon_area(c):
    x, y = c[:, 1], c[:, 0]
    return abs(np.dot(x, np.roll(y, 1)) - np.dot(y, np.roll(x, 1))) / 2


def resample(pts, step=0.25, closed=True):
    p = np.vstack([pts, pts[:1]]) if closed else pts
    seg = np.linalg.norm(np.diff(p, axis=0), axis=1)
    s = np.concatenate([[0], np.cumsum(seg)])
    L = s[-1]
    n = max(16, int(L / step))
    t = np.linspace(0, L, n, endpoint=not closed)
    x = np.interp(t, s, p[:, 0])
    y = np.interp(t, s, p[:, 1])
    return np.stack([x, y], 1)


def curvature(pts, win=6):
    n = len(pts)
    a = np.roll(pts, win, 0)
    b = np.roll(pts, -win, 0)
    v1 = pts - a
    v2 = b - pts
    ang = np.arctan2(v1[:, 0] * v2[:, 1] - v1[:, 1] * v2[:, 0], (v1 * v2).sum(1))
    seg = (np.linalg.norm(v1, axis=1) + np.linalg.norm(v2, axis=1)) / 2
    return np.abs(ang) / np.maximum(seg, 1e-6)


def _basis(u, n):
    s = (u % 1.0) * n
    i = np.floor(s).astype(int) % n
    t = s - np.floor(s)
    w = np.stack([(1 - t) ** 3 / 6, (3 * t ** 3 - 6 * t ** 2 + 4) / 6,
                  (-3 * t ** 3 + 3 * t ** 2 + 3 * t + 1) / 6, t ** 3 / 6], 1)
    B = np.zeros((len(u), n))
    for k in range(4):
        np.add.at(B, (np.arange(len(u)), (i + k) % n), w[:, k])
    return B


def fit_closed(pts, n, kappa=2.0, lam=0.02, iters=6):
    """Least-squares closed cubic B-spline with n control points; knots crowd where the
    edge bends (kappa), so a few points follow tight curves and long sweeps stay smooth."""
    p = resample(pts, 0.2)
    # start at the topmost point so the output is stable
    p = np.roll(p, -int(np.argmin(p[:, 1] + 1e-3 * p[:, 0])), 0)
    k = curvature(p, 8)
    k = ndimage.gaussian_filter1d(k, 6, mode='wrap')
    ds = np.linalg.norm(np.diff(np.vstack([p, p[:1]]), axis=0), axis=1)
    L = ds.sum()
    w = ds * (1 + kappa * k * L / (2 * math.pi) / 6)
    u = np.concatenate([[0], np.cumsum(w)[:-1]]) / w.sum()
    D = np.zeros((n, n))
    for i in range(n):
        D[i, i] = -2
        D[i, (i - 1) % n] = 1
        D[i, (i + 1) % n] = 1
    for it in range(iters):
        B = _basis(u, n)
        A = B.T @ B + lam * len(p) / n * (D.T @ D)
        C = np.linalg.solve(A, B.T @ p)
        if it == iters - 1:
            break
        # parameter correction: nearest point on a dense evaluation
        uu = np.linspace(0, 1, n * 60, endpoint=False)
        cur = _basis(uu, n) @ C
        d = ((p[:, None, :] - cur[None]) ** 2).sum(-1)
        j = d.argmin(1)
        u_new = uu[j]
        # keep the order monotone around the loop
        u = u_new
    err = np.sqrt(((B @ C - p) ** 2).sum(1))
    return C, float(err.mean()), float(err.max())


def closed_path(C, nd=2):
    n = len(C)
    segs = []
    for i in range(n):
        P0, P1, P2, P3 = C[i], C[(i + 1) % n], C[(i + 2) % n], C[(i + 3) % n]
        b0 = (P0 + 4 * P1 + P2) / 6
        b1 = (2 * P1 + P2) / 3
        b2 = (P1 + 2 * P2) / 3
        b3 = (P1 + 4 * P2 + P3) / 6
        segs.append((b0, b1, b2, b3))
    f = lambda v: ('%.*f' % (nd, v)).rstrip('0').rstrip('.') if '.' in ('%.*f' % (nd, v)) else '%.*f' % (nd, v)
    pt = lambda q: '%s %s' % (f(q[0]), f(q[1]))
    d = 'M' + pt(segs[0][0])
    for b0, b1, b2, b3 in segs:
        d += 'C' + pt(b1) + ' ' + pt(b2) + ' ' + pt(b3)
    return d + 'Z'


def shape(mask, n, offset=0.0, kappa=2.0, lam=0.02, smooth=0.5):
    pts = outline(mask, offset, smooth)
    C, e_mean, e_max = fit_closed(pts, n, kappa, lam)
    return closed_path(C), (e_mean, e_max)


def bezier(P, t):
    t = t[:, None]
    return ((1 - t) ** 3) * P[0] + 3 * ((1 - t) ** 2) * t * P[1] + 3 * (1 - t) * t * t * P[2] + t ** 3 * P[3]


def fit_cubic(pts, iters=8, fix_ends=True):
    """One cubic Bezier through ordered points (least squares, parameter correction)."""
    pts = np.asarray(pts, float)
    seg = np.linalg.norm(np.diff(pts, axis=0), axis=1)
    t = np.concatenate([[0], np.cumsum(seg)]) / max(seg.sum(), 1e-9)
    P0, P3 = pts[0].copy(), pts[-1].copy()
    for _ in range(iters):
        b0 = (1 - t) ** 3
        b1 = 3 * (1 - t) ** 2 * t
        b2 = 3 * (1 - t) * t ** 2
        b3 = t ** 3
        if fix_ends:
            R = pts - np.outer(b0, P0) - np.outer(b3, P3)
            A = np.stack([b1, b2], 1)
            sol, *_ = np.linalg.lstsq(A, R, rcond=None)
            P = np.array([P0, sol[0], sol[1], P3])
        else:
            A = np.stack([b0, b1, b2, b3], 1)
            sol, *_ = np.linalg.lstsq(A, pts, rcond=None)
            P = sol
        tt = np.linspace(0, 1, 400)
        cur = bezier(P, tt)
        d = ((pts[:, None] - cur[None]) ** 2).sum(-1)
        t = tt[d.argmin(1)]
    err = np.sqrt(((bezier(P, t) - pts) ** 2).sum(1))
    return P, float(err.max())


def order_along(pts):
    """Order scattered points along their main direction."""
    pts = np.asarray(pts, float)
    c = pts.mean(0)
    u, s, vt = np.linalg.svd(pts - c, full_matrices=False)
    proj = (pts - c) @ vt[0]
    o = np.argsort(proj)
    pts = pts[o]
    proj = proj[o]
    # average points in bins along the axis to get a centreline
    nb = max(4, int((proj[-1] - proj[0]) / 0.5))
    bins = np.linspace(proj[0], proj[-1] + 1e-6, nb + 1)
    out = []
    for i in range(nb):
        sel = (proj >= bins[i]) & (proj < bins[i + 1])
        if sel.any():
            out.append(pts[sel].mean(0))
    return np.array(out)


def mask_points(mask):
    yy, xx = np.nonzero(mask)
    return np.stack([(xx + 0.5) / UP, (yy + 0.5) / UP], 1)


def extend(P, a=0.0, b=0.0):
    """Lengthen a cubic at its ends along its end tangents (px)."""
    P = P.copy()
    if a:
        d = P[0] - P[1]
        d /= np.linalg.norm(d) + 1e-9
        P[0] = P[0] + d * a
    if b:
        d = P[3] - P[2]
        d /= np.linalg.norm(d) + 1e-9
        P[3] = P[3] + d * b
    return P


def num(v, nd=2):
    s = '%.*f' % (nd, v)
    s = s.rstrip('0').rstrip('.') if '.' in s else s
    return '0' if s in ('-0', '') else s


def cubic_d(P, move=True):
    pt = lambda q: '%s %s' % (num(q[0]), num(q[1]))
    return ('M' + pt(P[0]) if move else '') + 'C' + pt(P[1]) + ' ' + pt(P[2]) + ' ' + pt(P[3])


def boundary_between(a, b, width=1.5):
    """Points on the line where two areas meet (the gap between them)."""
    da = ndimage.distance_transform_edt(~a)
    db = ndimage.distance_transform_edt(~b)
    band = (da <= width * UP) & (db <= width * UP) & ~a & ~b
    if band.sum() < 4:
        band = (da <= width * UP) & (db <= width * UP)
    return mask_points(band)


def tapered(P, w0, w1, w_mid=None, n=40):
    """A filled stroke along cubic P whose width runs w0 -> (w_mid) -> w1, round ends."""
    t = np.linspace(0, 1, n)
    c = bezier(P, t)
    d = np.gradient(c, axis=0)
    d /= np.linalg.norm(d, axis=1, keepdims=True) + 1e-9
    nrm = np.stack([-d[:, 1], d[:, 0]], 1)
    if w_mid is None:
        w = w0 + (w1 - w0) * t
    else:
        w = np.where(t < 0.5, w0 + (w_mid - w0) * (t / 0.5) ** 0.6, w_mid + (w1 - w_mid) * ((t - 0.5) / 0.5) ** 1.6)
    left = c + nrm * (w[:, None] / 2)
    right = c - nrm * (w[:, None] / 2)
    loop = np.vstack([left, right[::-1]])
    return loop


def close_fill(m, r):
    """Morphological closing by a disc of radius r px (via distance transforms), holes filled."""
    if r > 0:
        R = r * UP
        p = int(R) + 4
        mp = np.pad(m, p)
        dil = ndimage.distance_transform_edt(~mp) <= R
        m = (ndimage.distance_transform_edt(dil) > R)[p:-p, p:-p] | m
    return ndimage.binary_fill_holes(m)


def union(*ms):
    out = ms[0].copy()
    for m in ms[1:]:
        out |= m
    return out


def split_d(a, b, side_pt, ext=20.0, width=2.0, far=400):
    """A closed region bounded by the line where areas a and b meet, on side_pt's side.
    Clip it to the part's outline to colour one side of a two-colour part."""
    pts = order_along(boundary_between(a, b, width))
    P, err = fit_cubic(pts)
    P = extend(P, ext, ext)
    # push the two ends far out on side_pt's side, perpendicular to the chord
    chord = P[3] - P[0]
    nrm = np.array([-chord[1], chord[0]]) / (np.linalg.norm(chord) + 1e-9)
    mid = bezier(P, np.array([0.5]))[0]
    if np.dot(np.asarray(side_pt) - mid, nrm) < 0:
        nrm = -nrm
    q3 = P[3] + nrm * far
    q0 = P[0] + nrm * far
    pt = lambda q: '%s %s' % (num(q[0]), num(q[1]))
    return cubic_d(P) + 'L' + pt(q3) + 'L' + pt(q0) + 'Z', P, err


def _open_map(m):
    M = np.zeros((m + 2, m))
    M[0, 0], M[0, 1] = 2, -1
    for i in range(m):
        M[i + 1, i] = 1
    M[m + 1, m - 1], M[m + 1, m - 2] = 2, -1
    return M


def _open_basis(u, m):
    nseg = m - 1
    s = np.clip(u, 0, 1) * nseg
    i = np.minimum(np.floor(s).astype(int), nseg - 1)
    t = s - i
    w = np.stack([(1 - t) ** 3 / 6, (3 * t ** 3 - 6 * t ** 2 + 4) / 6,
                  (-3 * t ** 3 + 3 * t ** 2 + 3 * t + 1) / 6, t ** 3 / 6], 1)
    B = np.zeros((len(u), m + 2))
    for k in range(4):
        np.add.at(B, (np.arange(len(u)), i + k), w[:, k])
    return B @ _open_map(m)


def fit_open(pts, m=4, lam=0.0, iters=8, fix_ends=True):
    """Open uniform cubic B-spline with m control points through the ends, least squares.
    Returns the Bezier segments (m-1 of them) and the largest error."""
    p = resample(np.asarray(pts, float), 0.25, closed=False)
    seg = np.linalg.norm(np.diff(p, axis=0), axis=1)
    u = np.concatenate([[0], np.cumsum(seg)]) / max(seg.sum(), 1e-9)
    E2 = np.zeros((m, m))
    for i in range(1, m - 1):
        E2[i, i - 1], E2[i, i], E2[i, i + 1] = 1, -2, 1
    for it in range(iters):
        B = _open_basis(u, m)
        if fix_ends and m > 2:
            R = p - np.outer(B[:, 0], p[0]) - np.outer(B[:, -1], p[-1])
            Bm = B[:, 1:-1]
            D = E2[:, 1:-1]
            A = Bm.T @ Bm + lam * D.T @ D
            rhs = Bm.T @ R - lam * D.T @ (np.outer(E2[:, 0], p[0]) + np.outer(E2[:, -1], p[-1]))
            mid = np.linalg.solve(A, rhs)
            C = np.vstack([p[0], mid, p[-1]])
        else:
            C, *_ = np.linalg.lstsq(B, p, rcond=None)
        uu = np.linspace(0, 1, 80 * m)
        cur = _open_basis(uu, m) @ C
        d = ((p[:, None] - cur[None]) ** 2).sum(-1)
        u = uu[d.argmin(1)]
    err = float(np.sqrt(((_open_basis(u, m) @ C - p) ** 2).sum(1)).max())
    E = _open_map(m) @ C
    segs = []
    for i in range(m - 1):
        P0, P1, P2, P3 = E[i], E[i + 1], E[i + 2], E[i + 3]
        segs.append(np.array([(P0 + 4 * P1 + P2) / 6, (2 * P1 + P2) / 3, (P1 + 2 * P2) / 3, (P1 + 4 * P2 + P3) / 6]))
    return segs, err


def segs_d(segs, move=True):
    pt = lambda q: '%s %s' % (num(q[0]), num(q[1]))
    d = 'M' + pt(segs[0][0]) if move else ''
    for s in segs:
        d += 'C' + pt(s[1]) + ' ' + pt(s[2]) + ' ' + pt(s[3])
    return d


def extend_segs(segs, a=0.0, b=0.0):
    segs = [s.copy() for s in segs]
    segs[0] = extend(segs[0], a, 0)
    segs[-1] = extend(segs[-1], 0, b)
    return segs


def runs(flags):
    """Runs of True in a cyclic boolean array, as (start, length), longest first."""
    n = len(flags)
    if flags.all():
        return [(0, n)]
    k = int(np.argmin(flags))  # a False to start from
    f = np.roll(flags, -k)
    out = []
    i = 0
    while i < n:
        if f[i]:
            j = i
            while j < n and f[j]:
                j += 1
            out.append(((i + k) % n, j - i))
            i = j
        else:
            i += 1
    return sorted(out, key=lambda r: -r[1])


def two_sided(mask, covers, offset, m=4, depth=None, smooth=0.6, report=None, name='', trim=3.0):
    """A limb drawn as its two visible sides, one smooth curve each.
    covers: (near, drawn) pairs: `near` is where the limb counts as tucked under that part
    (its drawn area, plus any open gap the artwork leaves at the join), `drawn` is the
    area the part paints. Each side runs on straight until it is under the part, then
    turns in, so any bend is hidden under the part's own outline."""
    if depth is None:
        depth = offset + 1.2
    pts = resample(outline(mask, offset, smooth), 0.25)
    near = np.zeros(mask.shape, bool)
    for c, _ in covers:
        near |= c
    H, W_ = mask.shape
    ix = np.clip(np.round(pts[:, 0] * UP - 0.5).astype(int), 0, W_ - 1)
    iy = np.clip(np.round(pts[:, 1] * UP - 0.5).astype(int), 0, H - 1)
    free = ~near[iy, ix]
    for (s, L) in runs(~free):
        if L * 0.25 < 4.0:
            free[(s + np.arange(L)) % len(free)] = True
    for (s, L) in runs(free):
        if L * 0.25 < 6.0:
            free[(s + np.arange(L)) % len(free)] = False
    rs = runs(free)
    if len(rs) < 2:
        raise ValueError('%s: %d free sides' % (name, len(rs)))
    drawn = np.zeros(mask.shape, bool)
    for _, t in covers:
        drawn |= t
    inside = ndimage.gaussian_filter(ndimage.distance_transform_edt(drawn).astype(np.float32) / UP, UP * 0.5)
    gy, gx = np.gradient(inside)

    def at(q, a):
        x, y = int(round(q[0] * UP - 0.5)), int(round(q[1] * UP - 0.5))
        if not (0 <= y < H and 0 <= x < W_):
            return 0.0
        return a[y, x]

    def run_on(p, v):
        v = v / (np.linalg.norm(v) + 1e-9)
        q = p.copy()
        out = []
        for k in range(int(14 / 0.25)):          # straight on until under the part
            if at(q, inside) > 0.6:
                break
            q = q + v * 0.25
        else:
            return [p.copy(), p.copy()]           # no part to tuck under here: stop
        out.append(q.copy())
        for k in range(160):                      # then in, until deep enough
            if at(q, inside) >= depth:
                break
            g = np.array([at(q, gx), at(q, gy)])
            if np.linalg.norm(g) < 1e-6:
                g = v
            q = q + g / (np.linalg.norm(g) + 1e-9) * 0.25
        out.append(q.copy())
        return out

    n = len(pts)
    sides = []
    for (s, L) in rs[:2]:
        cut = min(int(trim / 0.25), max(0, (L - 40) // 2))
        idx = (s + np.arange(cut, L - cut)) % n
        segs, e = fit_open(pts[idx], m)
        ra = run_on(segs[0][0], segs[0][0] - segs[0][1])
        rb = run_on(segs[-1][3], segs[-1][3] - segs[-1][2])
        sides.append((ra[::-1], segs, rb))
        if report is not None:
            report.append('    %s side: %d pts, err %.2f, run-ons %.1f+%.1f / %.1f+%.1f' % (
                name, L, e, np.linalg.norm(ra[0] - segs[0][0]), np.linalg.norm(ra[1] - ra[0]),
                np.linalg.norm(rb[0] - segs[-1][3]), np.linalg.norm(rb[1] - rb[0])))
    pt = lambda q: '%s %s' % (num(q[0]), num(q[1]))
    d = ''
    for i, (ra, segs, rb) in enumerate(sides):
        d += ('M' if i == 0 else 'L') + pt(ra[0]) + 'L' + pt(ra[1]) + 'L' + pt(segs[0][0])
        d += segs_d(segs, move=False) + 'L' + pt(rb[0]) + 'L' + pt(rb[1])
    return d + 'Z'


def branches(skel):
    """Split a skeleton into simple branches (ordered pixel lists), cutting at junctions."""
    pts = np.argwhere(skel)
    index = {(int(r), int(c)): i for i, (r, c) in enumerate(pts)}
    nb = [[] for _ in pts]
    for i, (r, c) in enumerate(pts):
        for dr in (-1, 0, 1):
            for dc in (-1, 0, 1):
                if dr or dc:
                    j = index.get((int(r) + dr, int(c) + dc))
                    if j is not None:
                        nb[i].append(j)
    deg = np.array([len(n) for n in nb])
    node = deg != 2
    seen = set()
    out = []
    for s in range(len(pts)):
        if not node[s]:
            continue
        for t in nb[s]:
            if (s, t) in seen:
                continue
            path = [s, t]
            seen.add((s, t)); seen.add((t, s))
            prev, cur = s, t
            while not node[cur]:
                nxt = [x for x in nb[cur] if x != prev]
                if not nxt:
                    break
                prev, cur = cur, nxt[0]
                seen.add((prev, cur)); seen.add((cur, prev))
                path.append(cur)
            out.append(pts[path])
    # loops with no nodes
    return [np.stack([(p[:, 1] + 0.5) / UP, (p[:, 0] + 0.5) / UP], 1) for p in out]


def inner_lines(ink, silhouette, ow, min_len=4.0, edge=None):
    """The artwork's dark lines inside an area (creases, overlaps), each as a smooth curve.
    Returns cubic segment lists, already run on a little past both ends."""
    edge = edge if edge is not None else ow * 1.1
    inside = ink & silhouette & shrink(silhouette, edge)
    inside = ndimage.binary_opening(inside, morphology.disk(max(1, int(ow * UP * 0.25))))
    sk = morphology.skeletonize(inside)
    out = []
    for b in branches(sk):
        L = np.linalg.norm(np.diff(b, axis=0), axis=1).sum() if len(b) > 1 else 0
        if L < min_len:
            continue
        m = 2 if L < 25 else (3 if L < 60 else 4)
        segs, e = fit_open(b, m)
        out.append(extend_segs(segs, ow * 1.6, ow * 1.6))
    return out
