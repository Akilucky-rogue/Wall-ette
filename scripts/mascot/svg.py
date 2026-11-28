"""Collects the layers of one pose and writes the SVG."""
import numpy as np
from geometry import num


class SVG:
    def __init__(self, W, H, prefix='m'):
        self.W, self.H = W, H
        self.prefix = prefix
        self.defs = []
        self.body = []
        self.nclip = 0

    def clip(self, d):
        self.nclip += 1
        cid = '%s-c%d' % (self.prefix, self.nclip)   # unique across poses, if ever inlined together
        self.defs.append('<clipPath id="%s"><path d="%s"/></clipPath>' % (cid, d))
        return cid

    def path(self, d, fill='none', stroke=None, sw=None, extra=''):
        a = '<path d="%s" fill="%s"' % (d, fill)
        if stroke:
            a += ' stroke="%s" stroke-width="%s"' % (stroke, num(sw))
        return a + extra + '/>'

    def add(self, s):
        self.body.append(s)

    def group(self, items, clip=None, extra=''):
        g = '<g'
        if clip:
            g += ' clip-path="url(#%s)"' % clip
        return g + extra + '>' + ''.join(items) + '</g>'

    def circle(self, cx, cy, r, fill='none', stroke=None, sw=None, extra=''):
        a = '<circle cx="%s" cy="%s" r="%s" fill="%s"' % (num(cx), num(cy), num(r), fill)
        if stroke:
            a += ' stroke="%s" stroke-width="%s"' % (stroke, num(sw))
        return a + extra + '/>'

    def text(self):
        out = ['<svg xmlns="http://www.w3.org/2000/svg" width="%d" height="%d" viewBox="0 0 %d %d">' % (self.W, self.H, self.W, self.H)]
        if self.defs:
            out.append('<defs>' + ''.join(self.defs) + '</defs>')
        out.append('<g stroke-linejoin="round" stroke-linecap="round">')
        out.extend(self.body)
        out.append('</g></svg>')
        return '\n'.join(out) + '\n'


def loop_path(pts, closed=True):
    """A smooth path through points (Catmull-Rom as cubic Beziers)."""
    P = np.asarray(pts, float)
    n = len(P)
    pt = lambda q: '%s %s' % (num(q[0]), num(q[1]))
    d = 'M' + pt(P[0])
    rng = range(n) if closed else range(n - 1)
    for i in rng:
        p0 = P[(i - 1) % n] if (closed or i > 0) else P[i]
        p1 = P[i]
        p2 = P[(i + 1) % n]
        p3 = P[(i + 2) % n] if (closed or i + 2 < n) else P[(i + 1) % n]
        c1 = p1 + (p2 - p0) / 6
        c2 = p2 - (p3 - p1) / 6
        d += 'C' + pt(c1) + ' ' + pt(c2) + ' ' + pt(p2)
    return d + ('Z' if closed else '')
