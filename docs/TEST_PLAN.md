# Test Plan

> How to verify the project works. Gives AI agents a concrete way to self-validate
> before declaring a task done. Test cases are linked to the FRs in
> `REQUIREMENTS.md`.

## Test strategy

- **Unit tests:** protocol type guards (`/shared`), graph-model → Cytoscape render
  helper, the typed diagram-type builders (`server/src/diagramTypes.test.ts`), the
  client-side drill-down helpers (`canvas/src/scope.test.ts`), and message relay
  logic in the server.
- **Integration tests:** drive the MCP server, simulate the MCP Apps channel, and
  assert message round-trips (`diagram` out, `node_selected`/`interaction` in).
- **Manual / demo checks:** the end-to-end demo script below.

## How to run tests

```bash
npm install
npm test        # unit + integration
npm run lint
npm run build   # canvas bundle must build
```

## Test cases

| ID | Linked req | Scenario | Steps | Expected result |
|------|------------|----------|-------|-----------------|
| TC-1 | FR-1 | Render a diagram | Send a `diagram` message with a valid graph model (`elements`) | Canvas renders the Cytoscape graph |
| TC-2 | FR-1 | Invalid graph model | Send a malformed `elements` model | Readable error, not blank canvas |
| TC-3 | FR-2 | Open on demand | Invoke the tool first time | Extension opens the canvas as a VS Code tab once |
| TC-4 | FR-2 | Reuse tab | Invoke the tool a second time | Same tab updates, no new tab |
| TC-5 | FR-3 | Pan/zoom | Drag + wheel + reset control | View pans, zooms, and resets to fit |
| TC-6 | FR-4 | Live update | Push a new `diagram` | Canvas re-renders without refresh |
| TC-7 | FR-4 | Channel re-init | Extension reloads the webview / re-inits the channel | Canvas recovers and re-syncs |
| TC-8 | FR-5 | Select node | Click a node | Node highlights; server reads current selection |
| TC-9 | FR-5 | Selection persists | Re-render with node still present | Selection retained |
| TC-10 | FR-6 | Explain | Select node → "explain this node" | Relevant explanation appears in the CLI |
| TC-11 | FR-7 | Expand | Select node → "expand this node" | Subnodes/detail appear in place |
| TC-12 | FR-9 | Modify | Select entrypoint → "add a new entrypoint to do X" | Clarifying questions asked, code edited, diagram updated |
| TC-13 | NFR-3 | Second host (stretch) | Render the app in a second MCP host | Same diagram renders and accepts interactions, or limitation documented |
| TC-14 | FR-11 | Dependency + cycles | Call `diagram_dependency` with a cyclic graph (A→B→A) | Directed dependency diagram renders; cycle renders without error |
| TC-15 | FR-11 | Flowchart notation | Call `diagram_flowchart` with start/step/decision/io/end + yes/no branches | Terminator/process/diamond/parallelogram shapes; decision branches labeled |
| TC-16 | FR-11 | State machine | Call `diagram_state_machine` with an initial + final state and events | Initial/final marked distinctly; open-arrow transitions labeled with events |
| TC-17 | FR-11 | Class relations | Call `diagram_class` with inheritance/realization/aggregation/composition | Sharp class boxes; each relation drawn with its distinct UML arrowhead/line-style |
| TC-18 | FR-11 | ER cardinality | Call `diagram_er` with 1:N and M:N relationships | Entity table boxes; relationship lines labeled with cardinality |
| TC-19 | FR-11 | Bad edges dropped | Any typed tool with an edge referencing an unknown node id | Edge dropped + reported in the tool result; canvas not blank |
| TC-20 | FR-7 | Drill-down expand | Right-click a node with neighbours → "Expand element" | View focuses the node + its neighbours (same notation); Back button appears |
| TC-21 | FR-7 | Back to previous scope | After expanding, click "Back to previous scope" | Previous (parent) scope is restored; Back hides at the top level |

## Demo script (end-to-end)

1. In VS Code's integrated terminal: *"diagram the auth flow."* → the canvas opens
   as a VS Code tab beside the terminal with the interactive Cytoscape graph.
   **(TC-1, TC-3)**
2. Click the `Auth service` node and type *"explain this node."* → Copilot
   explains it in the CLI. **(TC-8, TC-10)**
3. Type *"expand this node."* → the diagram grows new subnodes in place.
   **(TC-11)**
4. Select an entrypoint node and type *"add a new endpoint to do X."* → Copilot
   asks a clarifying question, writes the code, and updates the diagram. **(TC-12)**

## Definition of done (project)

- [ ] All Must-have requirements (FR-1..FR-7, FR-9) pass their test cases
- [ ] Demo script runs start to finish without errors
- [ ] `npm run build`, `lint`, and `test` are green
- [ ] No known critical bugs
