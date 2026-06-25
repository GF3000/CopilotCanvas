// Module augmentation for the svg() method that cytoscape-svg attaches to Core. The
// empty `export {}` makes this file a module, so `declare module 'cytoscape'` augments
// the real @types/cytoscape definitions instead of replacing them. (The cytoscape-svg
// module itself is declared ambiently in cytoscape-svg.d.ts.)
export {};

declare module 'cytoscape' {
  interface SvgExportOptions {
    /** Output scale factor (1 = on-screen size). */
    scale?: number;
    /** Export the whole graph (true) vs. the current viewport (false). */
    full?: boolean;
    /** Background colour; omit for a transparent background. */
    bg?: string;
  }
  interface Core {
    svg(options?: SvgExportOptions): string;
  }
}
