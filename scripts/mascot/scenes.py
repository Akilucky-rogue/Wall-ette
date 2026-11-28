"""The website's four larger scenes (800 px tall), each drawn back to front from
its own measured parts, as the app's poses are (see poses.py). Details the
artwork paints softly (the gift's bow, the paper, the magnifier) are drawn
from measurements of the artwork, in source pixels.
"""
import math
import os

import cv2

from pose import *

SITE = os.path.join(ROOT, 'site', 'public', 'img')

PAPER = '#F5EDDA'; PAPER_BACK = '#E4D6BF'; PAPER_EDGE = '#D6C8AE'; FOLD = '#B9AD92'; LINE = '#93A673'; LINE_DARK = '#7B9561'
RING_GREY = '#474D4B'; GLASS = '#BFD2C7'; GLASS_HL = '#EEF3EE'
BOX = '#E9D09B'; BOX_TOP = '#F2E3BC'; BOX_EDGE = '#C9A86E'; BOX_SHADE = '#DDBF85'
RIBBON = '#9DAD78'; RIBBON_LIGHT = '#B4C192'; RIBBON_DARK = '#6E8253'


def tuck(m, *fronts, r=5.0):
    """A part grown into the parts drawn over it, so its edge hides under theirs."""
    out = m.copy()
    for f in fronts:
        out |= grow(m, r) & f
    return close_fill(out, 1.0)


def ellipse_of(m):
    pts = outline(m, 0.0, 0.5).astype(np.float32)
    (cx, cy), (w, h), ang = cv2.fitEllipse(pts)
    return cx, cy, w / 2, h / 2, ang


def ellipse(cx, cy, rx, ry, ang, **kw):
    a = '<ellipse cx="%s" cy="%s" rx="%s" ry="%s" transform="rotate(%s %s %s)"' % (num(cx), num(cy), num(rx), num(ry), num(ang), num(cx), num(cy))
    a += ' fill="%s"' % kw.get('fill', 'none')
    if 'stroke' in kw:
        a += ' stroke="%s" stroke-width="%s"' % (kw['stroke'], num(kw['sw']))
    return a + '/>'


def open_welcome():
    P = Pose('open-welcome', 6.4, src=os.path.join(SITE, 'mascot-open-welcome.webp'))
    A, OW, S = P.A, P.OW, P.S
    leaf_seed, vein_seed = (374.6, 74.9), (330.6, 78.9)
    leaf_tmp = A.region(['leaf', 'rim'], [leaf_seed], holes=False)
    head = P.head_mask((234.6, 148.4), leaf=leaf_tmp, classes=('head', 'iris', 'ringhl'))
    hand_l = close_fill(P.reg(['green', 'shade'], (55.6, 550.1)), 1.0)
    hand_r = close_fill(P.reg(['green', 'shade'], (543.9, 368.4)), 1.0)
    body = torso(P, (180, 430, 450, 655), exclude=(head, hand_l, hand_r))
    body_fit = close_fill(morphology.convex_hull_image(body), 1.0)
    la_in, la_out = P.seg((189.6, 489.4)), P.seg((136.1, 526.1))
    ra_in, ra_out = P.seg((446.1, 481.4)), P.seg((489.6, 442.9))
    arm_l = close_fill(la_in | la_out, 4.0)
    arm_r = close_fill(ra_in | ra_out, 4.0)
    leg_l, leg_r = close_fill(P.seg((247.1, 678.4)), 3.0), close_fill(P.seg((389.1, 668.6)), 3.0)
    shoe_l_g, shoe_l_c = P.reg(['green', 'shade'], (174.9, 740.1)), P.seg((219.9, 712.4))
    shoe_r_g, shoe_r_c = P.reg(['green', 'shade'], (393.9, 747.1)), P.seg((345.9, 720.9))
    shoe_l, shoe_r = close_fill(shoe_l_g | shoe_l_c, 1.0), close_fill(shoe_r_g | shoe_r_c, 1.0)
    gold = P.reg(['gold'], (317.9, 510.9))

    P.limb('arm_l', arm_l, [body_fit, (hand_l, True, 4.0)], joints=[P.joint(la_in, la_out)])
    P.limb('arm_r', arm_r, [body_fit, (hand_r, True, 4.0)], joints=[P.joint(ra_in, ra_out)])
    P.outlined('hand_l', hand_l, 22, GREEN, kappa=3)
    P.outlined('hand_r', hand_r, 22, GREEN, kappa=3)
    P.limb('leg_l', leg_l, [(body_fit, True, 3.0), shoe_l], m=3)
    P.limb('leg_r', leg_r, [(body_fit, True, 3.0), shoe_r], m=3)
    P.shoe('shoe_l', shoe_l_g, shoe_l_c)
    P.shoe('shoe_r', shoe_r_g, shoe_r_c)
    P.body(body_fit, P.head_d, button=P.circle_of(gold))
    P.draw_head()
    P.face((321.6, 364.6), (300, 300))
    P.eyes((181.4, 354.1), (365.1, 237.1))
    P.leaf(leaf_seed, vein_seed, P.head_core, vein_classes=('white', 'cream'), leaf_classes=('leaf',), over_head=True)
    return P


def statement_review():
    refs = dict(BASE_REFS)
    refs.update({'grey': (90, 96, 92), 'glass': (200, 220, 212)})
    P = Pose('statement-review', 6.4, refs=refs, src=os.path.join(SITE, 'mascot-statement-review.webp'))
    A, OW, S = P.A, P.OW, P.S
    ink = A.cls('ink')
    leaf_seed, vein_seed = (412.1, 38.9), (346.6, 67.1)
    leaf_tmp = A.region(['leaf'], [leaf_seed], holes=False)
    stem = A.region(['white'], [vein_seed], holes=False)
    # the magnifier, as two fitted ellipses
    ring_m = P.reg(['grey'], (342.6, 388.6), holes=False)
    glass_m = close_fill(P.reg(['glass', 'white'], (368.9, 414.6)), 1.0)
    mag = close_fill(ring_m | glass_m, 1.0)
    ox, oy, orx, ory, oang = ellipse_of(mag)
    ix, iy, irx, iry, iang = ellipse_of(glass_m)
    P.report.append('magnifier outer (%.1f,%.1f) %.1fx%.1f %.1f / inner (%.1f,%.1f) %.1fx%.1f %.1f' % (ox, oy, orx, ory, oang, ix, iy, irx, iry, iang))
    yy, xx = np.mgrid[0:mag.shape[0], 0:mag.shape[1]]
    cx_, cy_ = (xx + 0.5) / UP - ox, (yy + 0.5) / UP - oy
    c, s_ = math.cos(math.radians(oang)), math.sin(math.radians(oang))
    u, v = cx_ * c + cy_ * s_, -cx_ * s_ + cy_ * c
    mag_area = (u / (orx + OW / 2)) ** 2 + (v / (ory + OW / 2)) ** 2 <= 1
    hand_l = close_fill(P.reg(['green', 'shade'], (287.4, 479.1)), 1.0)
    # the head carries on under the magnifier and the stem
    head = P.head_mask((214.4, 145.9), leaf=leaf_tmp, classes=('head', 'iris', 'ringhl'), exclude=(hand_l,),
                       behind=(stem, mag_area), rim_depth=14)
    face_raw = A.region(CR, [(283.9, 215.1)])
    face = close_fill(face_raw | (morphology.convex_hull_image(face_raw) & mag_area), 1.0)
    visor = A.region(['ink'], [(255, 270)], within=shrink(morphology.convex_hull_image(face_raw), 2.0) & ~mag_area)
    visor = close_fill(visor | (morphology.convex_hull_image(visor) & mag_area), 1.0)
    fist_r = close_fill(P.reg(['green'], (526.1, 510.1)), 1.0)
    palm_r = close_fill(P.reg(['shade'], (511.4, 533.4)), 1.0)
    paper_raw = P.reg(CR + ['ringhl', 'head', 'iris', 'white'], (437.4, 541.6), holes=True)
    below = P.YY > 521.0 + (P.XX - 412.5) * (10.0 / 90.0)
    cuff = close_fill(paper_raw & below & (P.XX < 505), 1.0)
    lab, n = ndimage.label(cuff)
    if n:
        sz = ndimage.sum(cuff, lab, range(1, n + 1))
        cuff = lab == (int(np.argmax(sz)) + 1)
    body = torso(P, (120, 440, 400, 665), exclude=(head, hand_l, fist_r, palm_r))
    body_fit = close_fill(morphology.convex_hull_image(body), 1.0)
    la_up, la_lo = P.seg((153.4, 468.4)), P.seg((204.6, 516.1))
    ra_a, ra_b = P.seg((375.1, 493.1)), P.seg((391.9, 520.4))
    leg_l, leg_r = close_fill(P.seg((173.6, 663.9)), 3.0), close_fill(P.seg((307.9, 672.4)), 3.0)
    shoe_l_g, shoe_l_c = P.reg(['green', 'shade'], (179.6, 738.9)), P.seg((177.4, 701.4))
    shoe_r_g, shoe_r_c = P.reg(['green', 'shade'], (374.4, 727.1)), P.seg((309.6, 718.9))
    shoe_l, shoe_r = close_fill(shoe_l_g | shoe_l_c, 1.0), close_fill(shoe_r_g | shoe_r_c, 1.0)
    gold = P.reg(['gold'], (316.1, 540.6))

    # ------------------------------------------------------------ drawing, back to front
    P.limb('leg_l', leg_l, [(body_fit, True, 3.0), shoe_l], m=3)
    P.limb('leg_r', leg_r, [(body_fit, True, 3.0), shoe_r], m=3)
    P.shoe('shoe_l', shoe_l_g, shoe_l_c)
    P.shoe('shoe_r', shoe_r_g, shoe_r_c)
    arm_r = close_fill(ra_a | ra_b | cuff | (ink & grow(ra_b, OW + 0.5) & grow(cuff, OW + 0.5)), 4.0)
    j1, j2 = P.joint(ra_a, ra_b), P.joint(ra_b, cuff, ext=10)
    P.outlined('arm_r', tuck(arm_r, grow(body_fit, OW * 0.6), grow(palm_r | fist_r, OW * 0.6)), 20, CREAM, kappa=2.5,
               inner=lambda d: j1(d) + j2(d))
    P.body(body_fit, P.head_d, button=P.circle_of(gold))
    # the paper: a sheet with its top corner curled back, ruled lines and a tick
    items = []
    for (x0, y0, x1, y1) in [(478.5, 404.5, 527.8, 405.5), (471, 422.5, 520.2, 424.5), (463.5, 440.8, 499.8, 442.5), (456.5, 458.8, 474, 459.5)]:
        items.append('<path d="M%s %sL%s %s" stroke="%s" stroke-width="8" stroke-linecap="round" fill="none"/>' % (num(x0), num(y0), num(x1), num(y1), LINE))
    items.append(S.circle(479.5, 487.5, 19.5, fill=LINE_DARK))
    items.append('<path d="M470.6 488.4L476.6 495.2L490.4 482.2" fill="none" stroke="%s" stroke-width="5.4" stroke-linecap="round" stroke-linejoin="round"/>' % PAPER)
    sheet = ('M474.6 375.5L568.6 377.2Q571.4 377.5 569.8 378.8Q557.8 386.6 551 402.6L505.2 532.2'
             'L414.6 521.6Q411.6 521.2 412.6 518.4L471.4 377.6Q472.4 375.5 474.6 375.5Z')
    curl = 'M551 402.6Q557.8 386.6 569.8 378.8Q575.6 379.2 575.2 386L574.6 400.4Q574.4 402.6 572.4 402.6Z'
    S.add(S.path(sheet, fill=PAPER, stroke=PAPER_EDGE, sw=1.6) + ''.join(items))
    S.add(S.path(curl, fill=PAPER_BACK, stroke=PAPER_EDGE, sw=1.6))
    S.add('<path d="M551.4 401.8Q557.8 386.6 569.4 379" stroke="%s" stroke-width="1.8" stroke-linecap="round" fill="none"/>' % FOLD)
    P.outlined('palm_r', tuck(palm_r, grow(fist_r, OW * 0.6)), 16, GREEN_SHADE, kappa=2.5)
    P.outlined('fist_r', fist_r, 22, GREEN, kappa=3.0)
    # the left arm reaches across the body to the magnifier
    arm_whole = close_fill(la_up | la_lo | (ink & grow(la_up, OW + 0.5) & grow(la_lo, OW + 0.5)), OW * 1.2)
    arm_whole = tuck(arm_whole, grow(hand_l, OW * 0.6), head)
    P.outlined('arm_l', arm_whole, 22, CREAM, kappa=3.0)
    P.outlined('forearm_l', tuck(close_fill(la_lo, 1.5), grow(hand_l, OW * 0.6)), 18, CREAM, kappa=2.5)
    P.draw_head(shift=(9, -8))
    S.add(S.path(P.fit('face', face, 16, 0.0, 1.5), fill=CREAM))
    S.add(S.path(P.fit('visor', visor, 22, 0.0, 2.0), fill=INK))
    P.eyes((152.9, 320.1), (355.6, 258.4))
    P.leaf(leaf_seed, vein_seed, P.head_core, vein_classes=('white', 'cream'), leaf_classes=('leaf',), over_head=True)
    # the handle: its end under the fist, a short neck from the ring into the fist
    kx, ky, kr = 277.0, 524.0, 10.0
    S.add(S.circle(kx, ky, kr, fill=RING_GREY, stroke=INK, sw=OW * 0.8))
    ang = math.atan2(ky - oy, kx - ox)
    phi = ang - math.radians(oang)
    r_edge = 1.0 / math.sqrt((math.cos(phi) / orx) ** 2 + (math.sin(phi) / ory) ** 2)
    ex_, ey_ = ox + (r_edge - 4) * math.cos(ang), oy + (r_edge - 4) * math.sin(ang)
    cx2, cy2 = ox + (r_edge + 28) * math.cos(ang), oy + (r_edge + 28) * math.sin(ang)
    S.add('<path d="M%s %sL%s %s" stroke="%s" stroke-width="%s" stroke-linecap="round"/>' % (num(ex_), num(ey_), num(cx2), num(cy2), INK, num(14 + OW)))
    S.add('<path d="M%s %sL%s %s" stroke="%s" stroke-width="14" stroke-linecap="round"/>' % (num(ex_), num(ey_), num(cx2), num(cy2), RING_GREY))
    P.outlined('hand_l', hand_l, 24, GREEN, kappa=3.0)
    ring_w = ((orx - irx) + (ory - iry)) / 2
    mrx, mry = (orx + irx) / 2, (ory + iry) / 2
    S.add(ellipse(ox, oy, orx + OW / 2, ory + OW / 2, oang, fill=INK))
    S.add(ellipse(ox, oy, mrx, mry, oang, fill='none', stroke=RING_GREY, sw=ring_w - OW * 0.4))
    S.add(ellipse(ix, iy, irx - OW * 0.2, iry - OW * 0.2, iang, fill=GLASS))
    hl = A.cls('white') & shrink(glass_m, 1.5)
    lab, n = ndimage.label(hl)
    sz = ndimage.sum(hl, lab, range(1, n + 1)) / UP / UP
    for i in np.argsort(-sz)[:2]:
        if sz[i] > 25:
            S.add(S.path(P.fit('glass hl', close_fill(lab == i + 1, 1.0), 12, 0.0, 2.5), fill=GLASS_HL))
    S.add(ellipse(ix, iy, irx, iry, iang, fill='none', stroke=INK, sw=OW * 0.6))
    return P


def gift_sharing():
    P = Pose('gift-sharing', 6.4, src=os.path.join(SITE, 'mascot-gift-sharing.webp'))
    A, OW, S = P.A, P.OW, P.S
    ink = A.cls('ink')
    leaf_seed, vein_seed = (408.1, 76.1), (374.6, 65.1)
    leaf_tmp = A.region(['leaf'], [leaf_seed], holes=False)
    stem = A.region(['white'], [vein_seed], holes=False)
    hand_l = close_fill(P.reg(['green', 'shade'], (212.9, 576.1)), 1.0)
    hand_r = close_fill(P.reg(['green', 'shade'], (388.9, 575.1)), 1.0)
    head = P.head_mask((298.1, 133.4), leaf=leaf_tmp, classes=('head', 'iris', 'ringhl'), behind=(stem,), rim_depth=14)
    # the gift
    gx0, gy0, gx1, gy1 = 214, 460, 382, 626
    box_area = (P.XX > gx0) & (P.XX < gx1) & (P.YY > gy0) & (P.YY < gy1)
    tan = A.cls('gold', 'ringhl', 'cream', 'white') & box_area & ~grow(hand_l | hand_r, 0.5)
    lab, n = ndimage.label(tan)
    sz = ndimage.sum(tan, lab, range(1, n + 1))
    tan = np.isin(lab, [i + 1 for i in range(n) if sz[i] > 40 * UP * UP])
    sage = A.cls('head', 'iris', 'rim', 'leaf') & box_area
    lab, n = ndimage.label(sage)
    sz = ndimage.sum(sage, lab, range(1, n + 1))
    sage = lab == (int(np.argmax(sz)) + 1)
    gift = close_fill(tan | sage, 2.0)
    body = torso(P, (150, 420, 450, 665), exclude=(head, hand_l, hand_r, gift))
    body_fit = close_fill(morphology.convex_hull_image(body | gift), 1.0)
    la_up, la_lo = P.seg((187.6, 454.1)), P.seg((176.9, 505.9))
    ra_up, ra_lo = P.seg((379.1, 460.1)), P.seg((401.6, 500.1))
    leg_l, leg_r = close_fill(P.seg((196.4, 672.6)), 3.0), close_fill(P.seg((382.1, 673.4)), 3.0)
    shoe_l_g, shoe_l_c = P.reg(['green', 'shade'], (186.1, 749.6)), P.seg((229.4, 718.9))
    shoe_r_g, shoe_r_c = P.reg(['green', 'shade'], (412.4, 749.9)), P.seg((352.9, 727.6))
    shoe_l, shoe_r = close_fill(shoe_l_g | shoe_l_c, 1.0), close_fill(shoe_r_g | shoe_r_c, 1.0)
    gold = P.reg(['gold'], (289.1, 464.6))

    P.limb('leg_l', leg_l, [(body_fit, True, 3.0), shoe_l], m=3)
    P.limb('leg_r', leg_r, [(body_fit, True, 3.0), shoe_r], m=3)
    P.shoe('shoe_l', shoe_l_g, shoe_l_c)
    P.shoe('shoe_r', shoe_r_g, shoe_r_c)
    P.body(body_fit, P.head_d, button=P.circle_of(gold))
    # arms: upper arms at the sides, forearms curling in to hold the gift
    for name, up, lo in (('arm_l', la_up, la_lo), ('arm_r', ra_up, ra_lo)):
        lo_c = close_fill(lo, 1.5)
        hand = hand_l if name == 'arm_l' else hand_r
        P.outlined(name + '_up', tuck(close_fill(up, 1.5), head, grow(lo_c, OW * 0.6), grow(body_fit, OW * 0.6)), 14, CREAM, kappa=2.5)
        P.outlined(name + '_lo', tuck(lo_c, grow(hand, OW * 0.6), grow(body_fit, OW * 0.6)), 16, CREAM, kappa=2.5)
    # the gift, drawn from measurements of the artwork: a lid over a box, a ribbon
    # down the front and across the lid's top, and a bow with two loops and two tails
    def rrect(x0, y0, x1, y1, r):
        return ('M%s %sH%sQ%s %s %s %sV%sQ%s %s %s %sH%sQ%s %s %s %sV%sQ%s %s %s %sZ' % tuple(num(v) for v in (
            x0 + r, y0, x1 - r, x1, y0, x1, y0 + r, y1 - r, x1, y1, x1 - r, y1, x0 + r, x0, y1, x0, y1 - r, y0 + r, x0, y0, x0 + r, y0)))
    items = [
        S.path(rrect(232.5, 540, 365.5, 622.5, 4.5), fill=BOX, stroke=BOX_EDGE, sw=1.4),
        '<rect x="234" y="612" width="130" height="9" rx="3" fill="%s"/>' % BOX_SHADE,
        S.path(rrect(220, 494, 376, 545.5, 5), fill=BOX, stroke=BOX_EDGE, sw=1.4),
        S.path(rrect(221.4, 495.4, 374.6, 512.5, 4), fill=BOX_TOP),
        '<rect x="221.4" y="500.5" width="153.2" height="8" fill="%s"/>' % RIBBON,
        '<rect x="285.6" y="500" width="32.8" height="122" fill="%s"/>' % RIBBON,
        '<path d="M232.5 545.5H365.5" stroke="%s" stroke-width="1.4"/>' % BOX_EDGE,
    ]
    S.add(''.join(items))
    bow = [
        # tails, under the loops
        'M294 509C278 512 250 524 229 543L246.5 546L256 560C268 546 284 528 302 514Z',
        'M300 509C318 511 348 522 370 539L354 542L348 555C340 543 326 528 298 514Z',
    ]
    for d in bow:
        S.add(S.path(d, fill=RIBBON, stroke=RIBBON_DARK, sw=1.4))
    loops = [
        ('M287 495C271 477 246 465 235 479C227 491 236 506 250 510C263 513.5 278 511.5 287 509Z',
         'M284.5 501C276 494.5 256 489.5 245.5 494.5C240.5 499.5 246.5 506 258.5 507.2C268.5 508 278.5 506 284.5 503.5Z'),
        ('M308 495C318 477 341 461 355 472C363 480 363.5 496 356 504C345.5 510.5 322 511.5 308 509Z',
         'M311.5 500.5C322 492.5 343.5 486.5 352.5 492C357 498 352.5 504 342.5 505.2C330.5 506.2 318.5 505.2 311.5 502.5Z'),
    ]
    for outer, inner in loops:
        S.add(S.path(outer, fill=RIBBON_LIGHT, stroke=RIBBON_DARK, sw=1.4) + S.path(inner, fill=RIBBON_DARK))
    S.add(S.path(rrect(285, 490.5, 308, 511.5, 6.5), fill=RIBBON, stroke=RIBBON_DARK, sw=1.4))
    # hands hold the gift's sides
    P.outlined('hand_l', hand_l, 20, GREEN, kappa=3)
    P.outlined('hand_r', hand_r, 20, GREEN, kappa=3)
    P.draw_head(shift=(9, -8))
    P.face((290.6, 358.6), (300, 280))
    P.eyes((258.9, 293.6), (420, 280))
    P.leaf(leaf_seed, vein_seed, P.head_core, vein_classes=('white', 'cream'), leaf_classes=('leaf',), over_head=True)
    return P


def gentle_encourage():
    P = Pose('gentle-encourage', 6.4, src=os.path.join(SITE, 'mascot-gentle-encourage.webp'))
    A, OW, S = P.A, P.OW, P.S
    ink = A.cls('ink')
    leaf_seed, vein_seed = (383.9, 69.6), (356.9, 59.6)
    leaf_tmp = A.region(['leaf'], [leaf_seed], holes=False)
    thumb = close_fill(P.reg(['green', 'shade'], (94.6, 366.9)), 1.0)
    fist = close_fill(P.reg(['green', 'shade'], (71.1, 443.6)), 1.0)
    stem = A.region(['white'], [vein_seed], holes=False)
    head = P.head_mask((270.4, 119.6), leaf=leaf_tmp, classes=('head', 'iris', 'ringhl'), exclude=(thumb, fist), behind=(thumb, fist, stem), rim_depth=14)
    hand_r = close_fill(P.reg(['green', 'shade'], (449.6, 592.1)), 1.0)
    body = torso(P, (150, 400, 410, 620), exclude=(head, fist, thumb, hand_r))
    body_fit = close_fill(morphology.convex_hull_image(body), 1.0)
    la_out, la_in = P.seg((135.1, 480.6)), P.seg((179.9, 435.6))
    ra_in, ra_out = P.seg((412.4, 474.6)), P.seg((434.6, 536.9))
    arm_l = close_fill(la_in | la_out, 4.0)
    arm_r = close_fill(ra_in | ra_out, 4.0)
    leg_l, leg_r = close_fill(P.seg((193.6, 628.1)), 3.0), close_fill(P.seg((324.6, 639.6)), 3.0)
    shoe_l_g, shoe_l_c = P.reg(['green', 'shade'], (189.9, 701.1)), P.seg((219.9, 670.9))
    shoe_r_g, shoe_r_c = P.reg(['green', 'shade'], (384.1, 700.9)), P.seg((324.1, 685.6))
    shoe_l, shoe_r = close_fill(shoe_l_g | shoe_l_c, 1.0), close_fill(shoe_r_g | shoe_r_c, 1.0)
    gold = P.reg(['gold'], (290.9, 476.9))

    # the right arm hangs at the side, behind the body
    P.outlined('arm_r', tuck(arm_r, grow(body_fit, OW * 0.6), grow(hand_r, OW * 0.6), r=6.0), 16, CREAM, inner=P.joint(ra_in, ra_out))
    P.outlined('hand_r', hand_r, 22, GREEN, kappa=3)
    P.limb('leg_l', leg_l, [(body_fit, True, 3.0), shoe_l], m=3)
    P.limb('leg_r', leg_r, [(body_fit, True, 3.0), shoe_r], m=3)
    P.shoe('shoe_l', shoe_l_g, shoe_l_c)
    P.shoe('shoe_r', shoe_r_g, shoe_r_c)
    P.body(body_fit, P.head_d, button=P.circle_of(gold))
    # the left arm reaches out to the thumbs-up, in front of the body
    P.limb('arm_l', arm_l, [(body_fit, True, 3.0), (fist, True, 4.0)], joints=[P.joint(la_in, la_out)])
    P.draw_head()
    P.face((272.6, 340.1), (300, 260))
    P.eyes((237.6, 277.6), (393.1, 289.9))
    P.leaf(leaf_seed, vein_seed, P.head_core, vein_classes=('white', 'cream'), leaf_classes=('leaf',), over_head=True)
    P.outlined('thumb', tuck(thumb, grow(fist, OW)), 14, GREEN, kappa=2.5)
    # the fingers: two creases, measured from the artwork, curling down at their left ends
    fingers = [np.array([[130.0, 429.5], [114.0, 427.6], [95.0, 427.8], [88.6, 432.8]]),
               np.array([[125.6, 464.6], [110.0, 463.2], [93.0, 463.8], [86.6, 468.8]])]
    P.outlined('fist', fist, 22, GREEN, kappa=2.5,
               inner=lambda d: [S.group([S.path(cubic_d(f), stroke=INK, sw=OW * 0.8) for f in fingers], clip=S.clip(d))])
    return P
