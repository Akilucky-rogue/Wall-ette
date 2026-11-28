"""The five poses, each drawn back to front from its own measured parts.

Seeds (x, y) are points inside a part of the artwork; the part is the area of
those colours connected to the seed. Every function returns a finished Pose.
"""
import math

import cv2

from pose import *


def welcome():
    P = Pose('welcome', 3.6)
    A = P.A
    body = P.reg(['green', 'shade', 'gold'], (127.6, 340.1))
    leaf_seed, vein_seed = (195, 30), (196.9, 39.9)
    head_core = A.region(['head'], [(140, 80)])
    hand_l = P.reg(['green'], (44.4, 368.9))
    _hy = np.nonzero(hand_l.any(1))[0].min() / UP
    hand_l |= morphology.convex_hull_image(hand_l) & (P.YY < _hy + 8)
    hand_r = P.reg(['green'], (291.4, 264.9))
    arm_l_up, arm_l_lo = P.seg((90.9, 287.9)), P.seg((63.4, 318.4))
    arm_r_in, arm_r_out = P.seg((240.1, 287.6)), P.seg((265.9, 286.6))
    shoe_l_g, shoe_l_c = P.reg(['green', 'shade'], (101.9, 429.9)), P.seg((111.9, 411.1))
    shoe_r_g, shoe_r_c = P.reg(['green', 'shade'], (223.1, 429.9)), P.seg((193.1, 418.6))
    shoe_l, shoe_r = close_fill(shoe_l_g | shoe_l_c, 1.0), close_fill(shoe_r_g | shoe_r_c, 1.0)
    arm_l = close_fill(arm_l_up | arm_l_lo, 4.0)
    arm_r = close_fill(arm_r_in | arm_r_out, 4.0)
    body_fit = close_fill(body | (morphology.convex_hull_image(body) & grow(arm_l, 4)), 1.0)
    leg_l, leg_r = close_fill(P.seg((104.1, 390.9)), 3.0), close_fill(P.seg((214.9, 392.1)), 3.0)
    # a head mask for the covers (drawn later)
    leaf_tmp = A.region(['leaf', 'rim'], [leaf_seed], holes=False)
    head_full = P.head_mask((140, 80), leaf=leaf_tmp)

    P.limb('arm_r', arm_r, [body_fit, (hand_r, True, 4.0)], joints=[P.joint(arm_r_in, arm_r_out)])
    P.outlined('hand_r', hand_r, 20, GREEN, kappa=3)
    P.limb('leg_l', leg_l, [body_fit, shoe_l], m=3)
    P.limb('leg_r', leg_r, [body_fit, shoe_r], m=3)
    P.shoe('shoe_l', shoe_l_g, shoe_l_c)
    P.shoe('shoe_r', shoe_r_g, shoe_r_c)
    # the head's outline is needed for the body's shadow before the head is drawn
    P.body(body_fit, P.head_d, button=(164.8, 304.0, 11.3))
    P.limb('arm_l', arm_l, [(head_full, False, 3.0), (hand_l, True, 6.0)], joints=[P.joint(arm_l_up, arm_l_lo)])
    P.outlined('hand_l', hand_l, 18, GREEN, kappa=3)
    P.draw_head()
    P.face((147, 118), (160, 172))
    P.eyes((75, 172), (190, 160))
    P.leaf(leaf_seed, vein_seed, head_core)
    return P


def think():
    P = Pose('think', 2.4)
    A = P.A
    OW = P.OW
    leaf_seed, vein_seed = (122, 30), (125.9, 31.1)
    leaf_tmp = A.region(['leaf', 'rim'], [leaf_seed], holes=False)
    head = P.head_mask((40, 100), leaf=leaf_tmp, classes=('head', 'ringhl'))
    hw = np.ptp(np.nonzero(head.any(0))[0]) / UP
    P.report.append('head width %.1f -> OW %.2f' % (hw, 3.6 * hw / 270))
    hand = P.reg(['green'], (122.1, 179.9))
    # the body shows in several pieces round the folded arms: take every dark-green piece of the torso
    _g = A.cls('green', 'shade', 'gold') & ~grow(hand, 1.0) & ~grow(head, 1.0) & (P.XX > 52) & (P.XX < 185) & (P.YY > 165) & (P.YY < 268)
    _lab, _n = ndimage.label(_g)
    _sz = ndimage.sum(_g, _lab, range(1, _n + 1)) / UP / UP
    body = np.isin(_lab, [i + 1 for i in range(_n) if _sz[i] > 6])
    varm = close_fill(P.seg((101.9, 204.6)), 2.0)
    varm_raw = P.seg((101.9, 204.6))
    rarm_lo, rarm_up = P.seg((144.6, 211.1)), P.seg((155.6, 181.9))
    rarm = close_fill(rarm_lo | rarm_up, 3.0)
    hand = P.reg(['green'], (122.1, 179.9))
    leg_l, leg_r = close_fill(P.seg((93.4, 278.9)), 2.0), close_fill(P.seg((138.9, 280.1)), 2.0)
    shoe_l_g, shoe_l_c = P.reg(['green', 'shade'], (79.9, 308.9)), P.seg((85.4, 295.6))
    shoe_r_g, shoe_r_c = P.reg(['green', 'shade'], (158.6, 308.1)), P.seg((137.9, 302.1))
    shoe_l, shoe_r = close_fill(shoe_l_g | shoe_l_c, 1.0), close_fill(shoe_r_g | shoe_r_c, 1.0)
    body_fit = close_fill(morphology.convex_hull_image(body), 1.0)
    gold = P.reg(['gold'], (120, 242))

    P.limb('leg_l', leg_l, [body_fit, shoe_l], m=3)
    P.limb('leg_r', leg_r, [body_fit, shoe_r], m=3)
    P.shoe('shoe_l', shoe_l_g, shoe_l_c)
    P.shoe('shoe_r', shoe_r_g, shoe_r_c)
    P.body(body_fit, P.head_d, button=P.circle_of(gold))
    # the folded arms, back to front: each part tucks under the ones drawn over it
    def tuck(m, *fronts, r=4.0):
        out = m.copy()
        for f in fronts:
            out |= grow(m, r) & f
        return close_fill(out, 1.0)
    larm = varm
    rup_x = tuck(rarm_up, grow(rarm_lo, OW), grow(larm, OW), grow(hand, OW))
    rlo_x = tuck(rarm_lo, grow(larm, OW), grow(hand, OW))
    larm_x = tuck(larm, grow(hand, OW))
    S = P.S
    P.outlined('arm_r_up', rup_x, 10, CREAM)
    P.outlined('arm_r_lo', rlo_x, 14, CREAM)
    lines = inner_lines(A.cls('ink'), larm, OW, min_len=2.0, edge=OW * 0.5)
    P.report.append('left arm creases: %d' % len(lines))
    P.outlined('arm_l', larm_x, 26, CREAM, kappa=3.0, inner=lambda d: [S.group([S.path(segs_d(l), stroke=INK, sw=OW) for l in lines], clip=S.clip(d))])
    P.draw_head()
    P.face((114.1, 146.1), (118, 108))
    P.eyes((57, 118), (131, 110))
    P.outlined('hand', hand, 22, GREEN, kappa=3)
    P.leaf(leaf_seed, vein_seed, P.head_core)
    # the thought: a bubble with a little bar chart, and two small bubbles leading to it
    def ellipse_of(m):
        import cv2
        pts = outline(m, 0.0, 0.5).astype(np.float32)
        (cx, cy), (w, h), ang = cv2.fitEllipse(pts)
        return cx, cy, w / 2, h / 2, ang
    big_in = A.region(CR, [(208.4, 31.4)])
    big_ring = close_fill(big_in | (A.cls('head', 'ringhl', 'iris', 'rim') & grow(big_in, 4)), 1.0)
    ex, ey, ea, eb, eang = ellipse_of(big_ring)
    ix, iy, ia, ib, iang = ellipse_of(big_in)
    ring_w = ((ea - ia) + (eb - ib)) / 2
    P.report.append('bubble: (%.1f,%.1f) %.1fx%.1f rot %.1f, ring %.2f' % (ex, ey, ea, eb, eang, ring_w))
    rm = (ea + ia) / 2, (eb + ib) / 2
    S.add('<ellipse cx="%s" cy="%s" rx="%s" ry="%s" transform="rotate(%s %s %s)" fill="%s" stroke="%s" stroke-width="%s"/>' % (
        num(ex), num(ey), num(rm[0]), num(rm[1]), num(eang), num(ex), num(ey), CREAM, HEAD, num(ring_w)))
    bars = A.cls('head', 'iris') & ndimage.binary_fill_holes(big_in) & ~grow(~ndimage.binary_fill_holes(big_in), 3)
    lab, n = ndimage.label(bars)
    for i in range(1, n + 1):
        m = lab == i
        if m.sum() < 20 * UP * UP:
            continue
        ys, xs = np.nonzero(m)
        x0, x1, y0, y1 = xs.min() / UP - 0.6, (xs.max() + 1) / UP + 0.6, ys.min() / UP - 0.6, (ys.max() + 1) / UP + 0.6
        P.report.append('bar %.1f-%.1f x %.1f-%.1f' % (x0, x1, y0, y1))
        S.add('<rect x="%s" y="%s" width="%s" height="%s" rx="%s" fill="%s"/>' % (num(x0), num(y0), num(x1 - x0), num(y1 - y0), num(min(1.6, (x1 - x0) / 4)), HEAD))
    sm_in = A.region(CR, [(208.1, 86.1)])
    sm = close_fill(sm_in | (A.cls('head', 'ringhl', 'iris', 'rim') & grow(sm_in, 3)), 1.0)
    sx, sy, sr = P.circle_of(sm)
    _, _, sri = P.circle_of(sm_in)
    S.add(S.circle(sx, sy, (sr + sri) / 2, fill=CREAM, stroke=HEAD, sw=sr - sri))
    dot = A.region(['head', 'ringhl', 'iris', 'rim', 'cream', 'white'], [(199, 98)])
    dx, dy, dr = P.circle_of(dot)
    S.add(S.circle(dx, dy, dr, fill=HEAD))
    P.report.append('small bubble (%.1f,%.1f) r%.1f/%.1f, dot (%.1f,%.1f) r%.1f' % (sx, sy, sr, sri, dx, dy, dr))
    return P


def encourage():
    P = Pose('encourage', 2.4)
    A = P.A
    OW = P.OW
    S = P.S
    leaf_seed, vein_seed = (150, 35), (146.1, 27.4)
    leaf_tmp = A.region(['leaf', 'rim'], [leaf_seed], holes=False)
    head = P.head_mask((30, 90), leaf=leaf_tmp, classes=('head', 'ringhl'))
    hw = np.ptp(np.nonzero(head.any(0))[0]) / UP
    P.report.append('head width %.1f -> OW %.2f' % (hw, 3.6 * hw / 270))
    # hands
    hand_l = P.reg(['green'], (59.1, 228.4))
    hand_r_parts = [P.reg(['green'], s) for s in [(217.1, 165.9), (205.6, 138.6), (191.9, 165.9)]]
    hand_r = close_fill(union(*hand_r_parts) | (A.cls('ink') & grow(union(*hand_r_parts), OW) & morphology.convex_hull_image(union(*hand_r_parts))), OW * 0.9)
    body = torso(P, (66, 168, 175, 272), exclude=(head, hand_l, hand_r))
    body_fit = close_fill(morphology.convex_hull_image(body), 1.0)
    # arms
    la_up, la_lo = P.seg((64.9, 187.9)), P.seg((36.6, 207.4))
    ra_up, ra_lo = P.seg((173.4, 201.4)), P.seg((186.4, 191.1))
    arm_l = close_fill(la_up | la_lo, 3.0)
    arm_r = close_fill(ra_up | ra_lo, 3.0)
    leg_l, leg_r = close_fill(P.seg((85.4, 274.1)), 2.0), close_fill(P.seg((144.6, 271.9)), 2.0)
    shoe_l_g, shoe_l_c = P.reg(['green', 'shade'], (58.6, 305.4)), P.seg((73.6, 292.6))
    shoe_r_g, shoe_r_c = P.reg(['green', 'shade'], (158.1, 304.4)), P.seg((130.6, 299.1))
    shoe_l, shoe_r = close_fill(shoe_l_g | shoe_l_c, 1.0), close_fill(shoe_r_g | shoe_r_c, 1.0)
    gold = P.reg(['gold'], (117.6, 201.6))

    def tuck(m, *fronts, r=4.0):
        out = m.copy()
        for f in fronts:
            out |= grow(m, r) & f
        return close_fill(out, 1.0)

    # right arm (thumbs up) behind the body
    P.outlined('arm_r', tuck(arm_r, grow(body_fit, OW * 0.6), grow(hand_r, OW * 0.6)), 14, CREAM, inner=P.joint(ra_up, ra_lo))
    thumb = close_fill(hand_r_parts[1], 1.0)
    fist = close_fill(hand_r_parts[0] | hand_r_parts[2] | (A.cls('ink') & grow(hand_r_parts[0], OW) & grow(hand_r_parts[2], OW)), OW * 0.9)
    P.outlined('thumb', tuck(thumb, grow(fist, OW)), 12, GREEN, kappa=2.5)
    # the fingers: two creases, drawn from the artwork (curling down at their left ends)
    fingers = [np.array([[213.5, 159.8], [206.0, 158.3], [197.8, 158.4], [196.9, 162.6]]),
               np.array([[212.8, 171.6], [205.2, 170.3], [197.8, 170.6], [197.0, 174.6]])]
    P.outlined('fist', fist, 20, GREEN, kappa=2.5, inner=lambda d: [S.path(cubic_d(f), stroke=INK, sw=OW * 0.8) for f in fingers])
    P.limb('leg_l', leg_l, [(body_fit, True, 3.0), shoe_l], m=3)
    P.limb('leg_r', leg_r, [(body_fit, True, 4.0), shoe_r], m=3)
    P.shoe('shoe_l', shoe_l_g, shoe_l_c)
    P.shoe('shoe_r', shoe_r_g, shoe_r_c)
    P.body(body_fit, P.head_d, button=P.circle_of(gold))
    # left arm, hand on hip, in front
    ink = A.cls('ink')
    arm_whole = close_fill(la_up | la_lo | (ink & grow(la_up, OW + 0.5) & grow(la_lo, OW + 0.5)), OW * 1.2)
    arm_whole = tuck(arm_whole, head, grow(hand_l, OW))
    # the whole arm as a backing, the forearm drawn over it (its edge makes the elbow crease)
    P.outlined('arm_l', arm_whole, 22, CREAM, kappa=3.0)
    P.outlined('forearm_l', tuck(close_fill(la_lo, 1.5), grow(hand_l, OW)), 16, CREAM, kappa=2.5)
    P.outlined('hand_l', hand_l, 20, GREEN, kappa=3)
    P.draw_head()
    P.face((112.9, 81.6), (115, 108))
    P.eyes((57, 112), (133, 112))
    P.leaf(leaf_seed, vein_seed, P.head_core)
    dashes(P, [(227.1, 95.9), (244.9, 109.9), (247.1, 130.4)])
    return P


def celebrate():
    P = Pose('celebrate', 2.4)
    A = P.A
    OW = P.OW
    S = P.S
    leaf_seed, vein_seed = (205, 20), (183.1, 33.6)
    leaf_tmp = A.region(['leaf', 'rim'], [leaf_seed], holes=False)
    head = P.head_mask((80, 90), leaf=leaf_tmp, classes=('head', 'ringhl'))
    hw = np.ptp(np.nonzero(head.any(0))[0]) / UP
    P.report.append('head width %.1f -> OW %.2f' % (hw, 3.6 * hw / 270))
    hand_l = P.reg(['green'], (32.4, 147.6))
    hand_r = P.reg(['green'], (272.4, 154.6))
    body = torso(P, (88, 172, 210, 262), exclude=(head, hand_l, hand_r))
    body_fit = close_fill(morphology.convex_hull_image(body), 1.0)
    la_out, la_in = P.seg((71.6, 172.9)), P.seg((94.1, 183.9))
    ra_out, ra_in = P.seg((232.9, 177.4)), P.seg((205.4, 190.6))
    arm_l = close_fill(la_out | la_in, 3.0)
    arm_r = close_fill(ra_out | ra_in, 3.0)
    leg_l = close_fill(P.seg((117.4, 257.9)), 2.0)
    leg_r = close_fill(P.seg((181.1, 272.6)), 2.0)
    # the standing shoe
    shoe_r_g, shoe_r_c = P.reg(['green', 'shade'], (185.6, 304.9)), P.seg((165.1, 294.9))
    shoe_r = close_fill(shoe_r_g | shoe_r_c, 1.0)
    # the kicked shoe: its sole faces us (dark), its upper (green) and opening (cream) above
    sole = P.reg(['shade'], (90, 285))
    upper = P.reg(['green'], (85, 265))
    collar = P.seg((107.4, 269.4))
    ink = A.cls('ink')
    kick = close_fill(morphology.convex_hull_image(sole | upper | (collar & grow(upper | sole, 7.0))), 1.0)
    # the green band between the sole and the cream opening: how wide it is in the artwork
    _ds = ndimage.distance_transform_edt(~sole) / UP
    _edge = collar & grow(~collar, 0.5) & grow(upper, 1.0)
    band = float(np.median(_ds[_edge])) if _edge.any() else 4.0
    P.report.append('kick: green band %.2f' % band)
    gold = P.reg(['gold'], (148.1, 203.6))

    def tuck(m, *fronts, r=4.0):
        out = m.copy()
        for f in fronts:
            out |= grow(m, r) & f
        return close_fill(out, 1.0)

    # arms out wide, behind the body
    P.limb('arm_l', arm_l, [body_fit, (hand_l, True, 3.0)], joints=[P.joint(la_out, la_in)])
    P.limb('arm_r', arm_r, [body_fit, (hand_r, True, 3.0)], joints=[P.joint(ra_out, ra_in)])
    P.outlined('hand_l', hand_l, 20, GREEN, kappa=3)
    P.outlined('hand_r', hand_r, 20, GREEN, kappa=3)
    P.limb('leg_r', leg_r, [(body_fit, True, 2.0), shoe_r], m=3)
    P.shoe('shoe_r', shoe_r_g, shoe_r_c)
    P.outlined('leg_l', tuck(leg_l, grow(body_fit, OW * 0.6), grow(kick, OW * 0.6), r=6.0), 12, CREAM, kappa=2.0)

    def kick_inner(d):
        sole_c = close_fill(sole, 2.0)
        gd = P.fit('sole+band', sole_c, 14, band, 2.0)
        sd = P.fit('sole', sole_c, 14, OW / 2, 2.0)
        return [S.group([S.path(gd, fill=GREEN), S.path(sd, fill=GREEN_SHADE), S.path(sd, stroke=INK, sw=OW)], clip=S.clip(d))]
    P.outlined('kick', kick, 18, CREAM, kappa=2.5, inner=kick_inner)
    P.body(body_fit, P.head_d, button=P.circle_of(gold))
    P.draw_head()
    face, visor = P.face((157.6, 82.9), (160, 110))
    smile(P, (105.1, 107.4))
    smile(P, (174.9, 115.9))
    P.leaf(leaf_seed, vein_seed, P.head_core)
    dashes(P, [(42.6, 59.6), (267.1, 62.9), (44.1, 92.9), (266.9, 92.9)])
    return P


def review():
    REV_REFS = dict(BASE_REFS)
    REV_REFS.update({'grey': (90, 96, 92), 'glass': (200, 220, 212)})
    P = Pose('review', 4.6, refs=REV_REFS)
    A = P.A
    OW = P.OW
    S = P.S
    ink = A.cls('ink')
    PAPER = '#F5EDDA'; PAPER_BACK = '#E4D6BF'; PAPER_EDGE = '#D6C8AE'; FOLD = '#B9AD92'; LINE = '#93A673'; LINE_DARK = '#7B9561'
    RING_GREY = '#474D4B'; RING_HL = '#6E7674'; GLASS = '#BFD2C7'; GLASS_HL = '#EEF3EE'

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

    def tuck(m, *fronts, r=5.0):
        out = m.copy()
        for f in fronts:
            out |= grow(m, r) & f
        return close_fill(out, 1.0)

    # ------------------------------------------------------------ measuring
    leaf_seed, vein_seed = (300, 30), (251.1, 56.9)
    leaf_tmp = A.region(['leaf', 'rim'], [leaf_seed], holes=False)
    # magnifier
    ring_m = P.reg(['grey'], (259.4, 286.4), holes=False)
    glass_m = close_fill(P.reg(['glass', 'white'], (284.6, 308.6)), 1.0)
    mag = close_fill(ring_m | glass_m, 1.0)
    ox, oy, orx, ory, oang = ellipse_of(mag)
    ix, iy, irx, iry, iang = ellipse_of(glass_m)
    P.report.append('magnifier outer (%.1f,%.1f) %.1fx%.1f %.1f / inner (%.1f,%.1f) %.1fx%.1f %.1f' % (ox, oy, orx, ory, oang, ix, iy, irx, iry, iang))
    mag_area = disc_mask(mag.shape, 0, 0, 0)
    yy, xx = np.mgrid[0:mag.shape[0], 0:mag.shape[1]]
    cx_, cy_ = (xx + 0.5) / UP - ox, (yy + 0.5) / UP - oy
    c, s_ = math.cos(math.radians(oang)), math.sin(math.radians(oang))
    u, v = cx_ * c + cy_ * s_, -cx_ * s_ + cy_ * c
    mag_area = (u / (orx + OW / 2)) ** 2 + (v / (ory + OW / 2)) ** 2 <= 1
    # head: under the magnifier it carries on
    head_core = A.region(['head', 'iris', 'ringhl'], [(45, 230)], holes=False)
    _op = ndimage.binary_opening(head_core, morphology.disk(3 * UP))
    _lab, _ = ndimage.label(_op)
    head_core = ndimage.binary_fill_holes(_lab == _lab[230 * UP, 45 * UP])
    head_core = close_fill(head_core | (morphology.convex_hull_image(head_core) & mag_area), 1.5)
    rim = A.cls('rim') & grow(head_core, 3) & ~shrink(head_core, 14)
    head = close_fill(morphology.convex_hull_image(head_core | rim), 1.0)
    head |= morphology.convex_hull_image(head) & grow(leaf_tmp, 3)
    hd = P.fit('head', head, 18, 0.0, 1.5)
    face_raw = A.region(CR, [(214.6, 161.4)])
    face = close_fill(face_raw | (morphology.convex_hull_image(face_raw) & mag_area), 1.0)
    visor = A.region(['ink'], [(200, 230)], within=shrink(morphology.convex_hull_image(face_raw), 2.0) & ~mag_area)
    visor = close_fill(visor | (morphology.convex_hull_image(visor) & mag_area), 1.0)
    # hands, arms, body, legs
    hand_l = P.reg(['green'], (215.6, 359.1))
    body = torso(P, (90, 335, 290, 482), exclude=(head, hand_l))
    body_fit = close_fill(morphology.convex_hull_image(body), 1.0)
    la_up, la_lo = P.seg((114.9, 351.4)), P.seg((153.4, 387.1))
    ra_a, ra_b = P.seg((281.4, 369.9)), P.seg((293.9, 390.4))
    fist_r = close_fill(P.reg(['green'], (395.1, 381.4)), 1.0)
    palm_r = close_fill(P.reg(['shade'], (380, 405)), 1.0)
    paper_raw = P.reg(CR + ['ringhl', 'head', 'iris', 'white'], (390, 300), holes=True)
    # the paper's lower edge: below it, the sleeve's cuff runs on to the hand
    _below = P.YY > 393.0 + (P.XX - 311.0) * (4.0 / 59.0)
    cuff = close_fill(paper_raw & _below & (P.XX < 372), 1.0)
    lab_, n_ = ndimage.label(cuff)
    if n_:
        sz_ = ndimage.sum(cuff, lab_, range(1, n_ + 1))
        cuff = lab_ == (int(np.argmax(sz_)) + 1)
    # the sheet, drawn from its measured corners: no ink edge in the artwork, just a soft one
    SHEET = [(355.8, 280.3), (427.0, 281.2), (413.2, 302.4), (400.2, 337.5), (379.5, 396.5), (310.5, 388.5)]
    CURL = [(413.6, 281.0), (431.0, 282.4), (433.0, 284.6), (422.4, 292.0), (421.4, 301.6), (409.0, 302.0)]
    paper_m = poly_mask(paper_raw.shape, SHEET)
    leg_l, leg_r = close_fill(P.seg((130.1, 497.9)), 2.0), close_fill(P.seg((231.4, 504.1)), 2.0)
    shoe_l_g, shoe_l_c = P.reg(['green', 'shade'], (131.4, 554.6)), P.seg((138.4, 526.1))
    shoe_r_g, shoe_r_c = P.reg(['green', 'shade'], (284.4, 545.1)), P.seg((231.4, 540.1))
    shoe_l, shoe_r = close_fill(shoe_l_g | shoe_l_c, 1.0), close_fill(shoe_r_g | shoe_r_c, 1.0)
    gold = P.reg(['gold'], (237.1, 406.4))
    P.head_d = hd

    # ------------------------------------------------------------ drawing, back to front
    P.limb('leg_l', leg_l, [(body_fit, True, 3.0), shoe_l], m=3)
    P.limb('leg_r', leg_r, [(body_fit, True, 3.0), shoe_r], m=3)
    P.shoe('shoe_l', shoe_l_g, shoe_l_c)
    P.shoe('shoe_r', shoe_r_g, shoe_r_c)
    arm_r = close_fill(ra_a | ra_b | cuff | (ink & grow(ra_b, OW + 0.5) & grow(cuff, OW + 0.5)), 3.0)
    _j1, _j2 = P.joint(ra_a, ra_b), P.joint(ra_b, cuff, ext=8)
    P.outlined('arm_r', tuck(arm_r, grow(body_fit, OW * 0.6), grow(palm_r | fist_r, OW * 0.6)), 20, CREAM, kappa=2.5,
               inner=lambda d: _j1(d) + _j2(d))
    P.body(body_fit, hd, button=P.circle_of(gold))
    # the paper: a sheet with its top corner curled back, ruled lines and a tick
    items = []
    for (x0, y0, x1, y1) in [(359.3, 303.0, 395.5, 304.5), (353.3, 317.0, 390.3, 318.7), (347.4, 330.8, 374.9, 332.2), (342.3, 344.3, 355.7, 344.9)]:
        items.append('<path d="M%s %sL%s %s" stroke="%s" stroke-width="5" stroke-linecap="round" fill="none"/>' % (num(x0), num(y0), num(x1), num(y1), LINE))
    items.append(S.circle(359.5, 366.0, 14.7, fill=LINE_DARK))
    items.append('<path d="M352.4 366.6L357.4 371.4L366.6 361.4" fill="none" stroke="%s" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>' % PAPER)
    def rounded_poly(pts, r=1.2):
        """A closed path through the corners, each corner rounded by about r px."""
        P_ = np.array(pts, float)
        n = len(P_)
        d = ''
        for i in range(n):
            a, b, c = P_[i - 1], P_[i], P_[(i + 1) % n]
            u1 = (a - b) / (np.linalg.norm(a - b) + 1e-9)
            u2 = (c - b) / (np.linalg.norm(c - b) + 1e-9)
            p1, p2 = b + u1 * r, b + u2 * r
            d += ('M' if i == 0 else 'L') + '%s %s' % (num(p1[0]), num(p1[1]))
            d += 'Q%s %s %s %s' % (num(b[0]), num(b[1]), num(p2[0]), num(p2[1]))
        return d + 'Z'
    sheet_d = ('M357.3 280.3L426.6 281.1Q428.4 281.3 427.2 281.8Q417.6 287.6 413.2 302.4L400.2 337.5L379.5 396.5'
               'L311.9 388.7Q309.6 388.4 310.3 386.3L355.1 281.6Q355.6 280.3 357.3 280.3Z')
    curl_d = 'M413.2 302.4Q417.6 287.6 427.2 281.8Q431.2 282.2 430.6 287.5L430.2 300.4Q430 302.2 428.4 302.2Z'
    S.add(S.path(sheet_d, fill=PAPER, stroke=PAPER_EDGE, sw=1.3) + ''.join(items))
    S.add(S.path(curl_d, fill=PAPER_BACK, stroke=PAPER_EDGE, sw=1.3))
    S.add('<path d="M413.4 301.8Q417.6 287.6 426.8 282" stroke="%s" stroke-width="1.4" stroke-linecap="round" fill="none"/>' % FOLD)
    P.outlined('palm_r', tuck(palm_r, grow(fist_r, OW * 0.6)), 16, GREEN_SHADE, kappa=2.5)
    P.outlined('fist_r', fist_r, 22, GREEN, kappa=3.0)
    # the left arm, across the body, behind the head's rim
    arm_whole = close_fill(la_up | la_lo | (ink & grow(la_up, OW + 0.5) & grow(la_lo, OW + 0.5)), OW * 1.2)
    arm_whole = tuck(arm_whole, grow(hand_l, OW * 0.6), head)
    P.outlined('arm_l', arm_whole, 22, CREAM, kappa=3.0)
    P.outlined('forearm_l', tuck(close_fill(la_lo, 1.5), grow(hand_l, OW * 0.6)), 18, CREAM, kappa=2.5)
    # head, face, eyes, leaf
    P.head_mask_, P.head_core, P.head_rim = head, head_core, rim
    items = [S.path(hd, fill=HEAD_RIM), S.path(hd, fill=HEAD, extra=' transform="translate(7.5 -6)"')]
    S.add(S.group(items, clip=S.clip(hd)))
    S.add(S.path(P.fit('face', face, 16, 0.0, 1.5), fill=CREAM))
    S.add(S.path(P.fit('visor', visor, 22, 0.0, 2.0), fill=INK))
    P.eyes((112, 204), (255, 204))
    P.leaf(leaf_seed, vein_seed, head_core)
    # the magnifier's handle end, under the hand
    knob = A.region(['ink', 'grey'], [(207, 395)], holes=True) & ~grow(hand_l, 0.5) & disc_mask(ink.shape, 207, 395, 12)
    kx, ky, kr = P.circle_of(close_fill(knob, 1.0))
    kx, ky, kr = 206.0, 395.4, 7.6          # the handle's end, measured from the artwork
    S.add(S.circle(kx, ky, kr, fill=RING_GREY, stroke=INK, sw=OW * 0.8))
    P.report.append('knob (%.1f,%.1f) r%.1f' % (kx, ky, kr))
    # the handle: a short neck from the ring into the fist (drawn under the fist)
    ang = math.atan2(ky - oy, kx - ox)
    phi = ang - math.radians(oang)
    r_edge = 1.0 / math.sqrt((math.cos(phi) / orx) ** 2 + (math.sin(phi) / ory) ** 2)
    ex_, ey_ = ox + (r_edge - 3) * math.cos(ang), oy + (r_edge - 3) * math.sin(ang)
    cx2, cy2 = ox + (r_edge + 22) * math.cos(ang), oy + (r_edge + 22) * math.sin(ang)
    P.report.append('handle from (%.1f,%.1f) to (%.1f,%.1f), ring radius there %.1f' % (ex_, ey_, cx2, cy2, r_edge))
    S.add('<path d="M%s %sL%s %s" stroke="%s" stroke-width="%s" stroke-linecap="round"/>' % (num(ex_), num(ey_), num(cx2), num(cy2), INK, num(10.5 + OW)))
    S.add('<path d="M%s %sL%s %s" stroke="%s" stroke-width="%s" stroke-linecap="round"/>' % (num(ex_), num(ey_), num(cx2), num(cy2), RING_GREY, num(10.5)))
    P.outlined('hand_l', hand_l, 24, GREEN, kappa=3.0)
    ring_w = ((orx - irx) + (ory - iry)) / 2
    mrx, mry = (orx + irx) / 2, (ory + iry) / 2
    S.add(ellipse(ox, oy, orx + OW / 2, ory + OW / 2, oang, fill=INK))
    S.add(ellipse(ox, oy, mrx, mry, oang, fill='none', stroke=RING_GREY, sw=ring_w - OW * 0.4))
    S.add(ellipse(ix, iy, irx - OW * 0.2, iry - OW * 0.2, iang, fill=GLASS))
    for sd in [(296.4, 272.9), (300.9, 319.4)]:
        hl = close_fill(A.region(['white'], [sd]), 1.0) & shrink(glass_m, 1.0)
        if hl.sum() > 10 * UP * UP:
            S.add(S.path(P.fit('glass hl', hl, 12, 0.0, 2.5), fill=GLASS_HL))
    S.add(ellipse(ix, iy, irx, iry, iang, fill='none', stroke=INK, sw=OW * 0.6))
    return P
