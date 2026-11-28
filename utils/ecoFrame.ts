/**
 * The garden frame on every page: two rangoli corners, a leaf and a lotus
 * (the shapes in components/ui/Decor.tsx), as CSS background images in the
 * theme's own colours. utils/theme.ts puts them on <html> as --eco-frame at
 * every theme change; styles.css .eco-frame places them on each page, in its
 * background, so cards, headers and the nav bar always sit on top. The
 * full-screen moments (splash, sign-in, lock, a required update) use the
 * splash's own garden instead (Decor.tsx SplashGarden).
 */

const image = (w: number, h: number, body: string): string =>
  `url("data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}' viewBox='0 0 ${w} ${h}' fill='none'>${body}</svg>`,
  )}")`;

const rangoli = (c: string, mirror: boolean): string => image(40, 40, `
  <g${mirror ? " transform='translate(40 0) scale(-1 1)'" : ''}>
    <circle cx='8' cy='8' r='2' fill='${c}' fill-opacity='0.4'/>
    <circle cx='16' cy='4' r='1.5' fill='${c}' fill-opacity='0.3'/>
    <circle cx='4' cy='16' r='1.5' fill='${c}' fill-opacity='0.3'/>
    <path d='M2 2Q20 2 20 20' stroke='${c}' stroke-width='0.6' stroke-opacity='0.45'/>
    <path d='M6 2Q20 6 20 20' stroke='${c}' stroke-width='0.6' stroke-opacity='0.35'/>
    <circle cx='12' cy='12' r='1' fill='${c}' fill-opacity='0.5'/>
  </g>`);

const leaf = (c: string): string => image(16, 20, `
  <path d='M8 0C8 0 2 6 2 12C2 16 4.5 19 8 19C11.5 19 14 16 14 12C14 6 8 0 8 0Z' fill='${c}' fill-opacity='0.45'/>
  <path d='M8 4V16M5 8C5 8 8 10 11 8' stroke='${c}' stroke-width='0.5' stroke-opacity='0.7'/>`);

const lotus = (c: string, flame: string): string => image(30, 21, `
  <ellipse cx='15' cy='14' rx='4' ry='8' fill='${c}' fill-opacity='0.55'/>
  <ellipse cx='9' cy='15' rx='3.5' ry='7' fill='${c}' fill-opacity='0.4' transform='rotate(-20 9 15)'/>
  <ellipse cx='5' cy='16' rx='3' ry='5' fill='${c}' fill-opacity='0.25' transform='rotate(-35 5 16)'/>
  <ellipse cx='21' cy='15' rx='3.5' ry='7' fill='${c}' fill-opacity='0.4' transform='rotate(20 21 15)'/>
  <ellipse cx='25' cy='16' rx='3' ry='5' fill='${c}' fill-opacity='0.25' transform='rotate(35 25 16)'/>
  <circle cx='15' cy='18' r='2' fill='${flame}' fill-opacity='0.7'/>`);

/** The four images, in the order styles.css .eco-frame places them. */
export function ecoFrameImages(colors: { leaf: string; lotus: string; flame: string }): string {
  return [rangoli(colors.leaf, false), rangoli(colors.leaf, true), leaf(colors.leaf), lotus(colors.lotus, colors.flame)].join(', ');
}
