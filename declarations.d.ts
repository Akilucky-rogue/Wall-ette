// Global CSS Modules declaration for TypeScript
// Allows importing '*.module.css' files without type errors

declare module '*.module.css' {
  const classes: { [key: string]: string };
  export default classes;
}
