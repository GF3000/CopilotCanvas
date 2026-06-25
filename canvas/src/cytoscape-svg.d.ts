// cytoscape-svg ships without TypeScript types — declare the module so its default
// import (a Cytoscape extension registration function passed to cytoscape.use()) is
// typed. This file has no top-level import/export so it stays an *ambient* module
// declaration, which is required because `cytoscape-svg` has no base types to augment.
// The svg() method the plugin adds to Core is augmented separately in
// cytoscape-svg.augment.d.ts (that file must be a module, so it can't live here).
declare module 'cytoscape-svg' {
  import type cytoscape from 'cytoscape';
  const ext: cytoscape.Ext;
  export default ext;
}

