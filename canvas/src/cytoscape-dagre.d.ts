// cytoscape-dagre ships without TypeScript types — declare it as a Cytoscape
// extension registration function.
declare module 'cytoscape-dagre' {
  import type cytoscape from 'cytoscape';
  const ext: cytoscape.Ext;
  export default ext;
}
