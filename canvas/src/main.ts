// Canvas webview entry — scaffold stub (KAN-5).
// Real rendering (Cytoscape graph + interaction loop) lands in KAN-6 (canvas-render).
import cytoscape from 'cytoscape';
import { PROTOCOL_VERSION, type CyElement } from '@canvas/shared';

const elements: CyElement[] = [
  { data: { id: 'hello', label: `Canvas ready — protocol v${PROTOCOL_VERSION}` } },
];

const container = document.getElementById('cy');
if (container) {
  cytoscape({
    container,
    elements: elements as cytoscape.ElementDefinition[],
    layout: { name: 'grid' },
  });
}
