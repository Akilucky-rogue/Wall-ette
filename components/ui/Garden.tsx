import React, { useEffect, useRef } from 'react';
import { gardenBackground, placeGarden, type GardenColors, type Placed, type Rect } from '../../utils/garden';

/**
 * The garden on a page (utils/garden.ts): put <Garden /> first inside a
 * page's root. It measures the page, finds the empty space (no text,
 * buttons, cards or header there) and scatters the eco motifs into it at
 * random, as the root's own background images: underneath everything, so
 * they never get in the way. A fresh arrangement each time the page opens;
 * when the page grows or loads more, the motifs still clear stay put.
 */
const READS = new Set(['BUTTON', 'A', 'INPUT', 'TEXTAREA', 'SELECT', 'IMG', 'svg', 'SVG', 'CANVAS', 'VIDEO', 'LABEL', 'H1', 'H2', 'H3', 'H4', 'P', 'LI', 'TABLE']);

function alphaOf(color: string): number {
  const m = /rgba?\(([^)]+)\)/.exec(color);
  if (!m) return color === 'transparent' ? 0 : 1;
  const parts = m[1].split(/[\s,/]+/).filter(Boolean);
  return parts.length >= 4 ? parseFloat(parts[3]) : 1;
}

/** Something the eye reads as a surface: a fill, a shadow, an image or a border. */
function surface(cs: CSSStyleDeclaration): boolean {
  return alphaOf(cs.backgroundColor) > 0.04
    || cs.backgroundImage !== 'none'
    || cs.boxShadow !== 'none'
    || (parseFloat(cs.borderTopWidth) > 0 && cs.borderTopStyle !== 'none' && alphaOf(cs.borderTopColor) > 0.04)
    || (parseFloat(cs.borderBottomWidth) > 0 && cs.borderBottomStyle !== 'none' && alphaOf(cs.borderBottomColor) > 0.04);
}

/** A card a motif can tuck behind: solid enough to hide it, and not the sticky header. */
const solid = (cs: CSSStyleDeclaration) => alphaOf(cs.backgroundColor) >= 0.6 && cs.position !== 'sticky';

const hasText = (el: Element) => Array.from(el.childNodes).some(n => n.nodeType === 3 && !!n.textContent?.trim());

/**
 * The page's size and what's on it, relative to its top-left corner: what
 * must stay clear (text, buttons, the header) and the cards motifs may tuck
 * behind.
 */
function measure(root: HTMLElement, skip: Element): { width: number; height: number; obstacles: Rect[]; surfaces: Rect[] } {
  const box = root.getBoundingClientRect();
  const obstacles: Rect[] = [];
  const surfaces: Rect[] = [];
  const stack: Element[] = Array.from(root.children).reverse();
  let budget = 4000;
  while (stack.length > 0 && budget-- > 0) {
    const el = stack.pop()!;
    if (el === skip) continue;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || cs.position === 'fixed') continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) {
      stack.push(...Array.from(el.children).reverse());
      continue;
    }
    // A sticky header counts where it sits with the page at the top.
    const y = cs.position === 'sticky' && el instanceof HTMLElement ? el.offsetTop : r.top - box.top;
    const rect = { x: r.left - box.left, y, w: r.width, h: r.height };
    if (surface(cs) && solid(cs)) { surfaces.push(rect); continue; }
    if (surface(cs) || READS.has(el.tagName) || hasText(el)) { obstacles.push(rect); continue; }
    stack.push(...Array.from(el.children).reverse());
  }
  return { width: box.width, height: Math.max(box.height, root.scrollHeight), obstacles, surfaces };
}

function colors(): GardenColors {
  const cs = getComputedStyle(document.documentElement);
  const v = (name: string, fallback: string) => cs.getPropertyValue(name).trim() || fallback;
  return { leaf: v('--sage-3', '#97A96D'), lotus: v('--rose-2', '#C98A79'), sand: v('--gold-2', '#D4B896') };
}

export const Garden: React.FC = () => {
  const marker = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const root = marker.current?.parentElement;
    if (!root || typeof ResizeObserver === 'undefined') return;
    let placed: Placed[] = [];
    let timer: ReturnType<typeof setTimeout> | undefined;
    let frame = 0;
    const paint = () => {
      const bg = gardenBackground(placed, colors());
      root.style.backgroundImage = bg.image;
      root.style.backgroundPosition = bg.position;
      root.style.backgroundSize = bg.size;
      root.style.backgroundRepeat = 'no-repeat';
    };
    const grow = () => {
      if (!marker.current) return;
      const page = measure(root, marker.current);
      if (page.width < 80 || page.height < 80) return;
      placed = placeGarden({ ...page, existing: placed });
      paint();
    };
    const later = () => { clearTimeout(timer); timer = setTimeout(grow, 180); };
    frame = requestAnimationFrame(grow);
    const resized = new ResizeObserver(later);
    resized.observe(root);
    window.addEventListener('resize', later);
    window.addEventListener('wallette:theme', paint);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
      resized.disconnect();
      window.removeEventListener('resize', later);
      window.removeEventListener('wallette:theme', paint);
      root.style.backgroundImage = '';
      root.style.backgroundPosition = '';
      root.style.backgroundSize = '';
      root.style.backgroundRepeat = '';
    };
  }, []);
  return <span ref={marker} hidden aria-hidden="true" />;
};

export default Garden;
