/**
 * Wall·ette's marks, from the brand kit.
 *
 * - BrandIcon: the app icon's tile (assets/brand/icon.svg, drawn by
 *   scripts/brand-icons.mjs from the approved icon).
 * - Wordmark: the approved logo artwork, in dark ink, with a cream copy that
 *   light-on-dark themes show instead (styles.css).
 * - Mascot: the approved poses, cut out from the identity board. Welcome is
 *   for first steps, Think for insights and empty screens, Encourage for
 *   progress, Celebrate for a real achievement, Review for statements.
 *   Decorative, so screen readers skip them.
 */
import iconUrl from '../../assets/brand/icon.svg';
import wordmarkUrl from '../../assets/brand/wordmark.webp';
import wordmarkDarkUrl from '../../assets/brand/wordmark-dark.webp';
import welcomeUrl from '../../assets/brand/mascot-welcome.webp';
import thinkUrl from '../../assets/brand/mascot-think.webp';
import encourageUrl from '../../assets/brand/mascot-encourage.webp';
import celebrateUrl from '../../assets/brand/mascot-celebrate.webp';
import reviewUrl from '../../assets/brand/mascot-review.webp';

export const TAGLINE = 'Your personal finance companion';

export function BrandIcon({ size = 40, className = '' }: { size?: number; className?: string }) {
  return <img src={iconUrl} alt="" width={size} height={size} draggable={false} className={`shrink-0 select-none ${className}`} />;
}

/** The logo. `height` in px; the artwork is 933 × 176. */
export function Wordmark({ height = 28, className = '' }: { height?: number; className?: string }) {
  const width = Math.round((height * 933) / 176);
  return (
    <span role="img" aria-label="Wall·ette" className={`inline-flex shrink-0 ${className}`}>
      <img src={wordmarkUrl} alt="" width={width} height={height} draggable={false} className="wordmark-light select-none" />
      <img src={wordmarkDarkUrl} alt="" width={width} height={height} draggable={false} className="wordmark-dark select-none" />
    </span>
  );
}

export type MascotPose = 'welcome' | 'think' | 'encourage' | 'celebrate' | 'review';

const POSES: Record<MascotPose, { src: string; w: number; h: number }> = {
  welcome: { src: welcomeUrl, w: 341, h: 467 },
  think: { src: thinkUrl, w: 271, h: 334 },
  encourage: { src: encourageUrl, w: 260, h: 332 },
  celebrate: { src: celebrateUrl, w: 306, h: 332 },
  review: { src: reviewUrl, w: 441, h: 600 },
};

/** A pose's image and size, for drawing it elsewhere (Rewind's card). */
export const mascotImage = (pose: MascotPose) => POSES[pose];

/** A pose at its own proportions, `height` px tall. */
export function Mascot({ pose, height = 120, className = '' }: { pose: MascotPose; height?: number; className?: string }) {
  const p = POSES[pose];
  return (
    <img
      src={p.src}
      alt=""
      width={Math.round((height * p.w) / p.h)}
      height={height}
      draggable={false}
      className={`shrink-0 select-none pointer-events-none ${className}`}
    />
  );
}
