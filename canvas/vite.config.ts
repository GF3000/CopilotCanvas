import { defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';

// The canvas builds to a single portable bundle that the VS Code extension
// loads into the webview tab (the MCP App HTML resource).
export default defineConfig({
  plugins: [tsconfigPaths()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
