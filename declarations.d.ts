/// <reference types="vite/client" />

// Global CSS Modules declaration for TypeScript
// Allows importing '*.module.css' files without type errors

declare module '*.module.css' {
  const classes: { [key: string]: string };
  export default classes;
}

// Vite `?url` asset imports (used for the bundled pdf.js worker)
declare module '*?url' {
  const src: string;
  export default src;
}
