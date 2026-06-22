# Test Plan

> How to verify the project works. Gives AI agents a concrete way to self-validate
> before declaring a task done. Test cases are linked to the FRs in
> `REQUIREMENTS.md`.

## Test strategy

- **Unit tests:** protocol type guards (`/shared`), Mermaid→SVG render helper,
  message relay logic in the server.
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
| TC-1 | FR-1 | Render a diagram | Send a `diagram` message with valid Mermaid | Canvas shows the SVG |
| TC-2 | FR-1 | Invalid Mermaid | Send malformed Mermaid | Readable error, not blank canvas |
| TC-3 | FR-2 | Open on demand | Invoke the tool first time | Host renders the canvas app once |
| TC-4 | FR-2 | Reuse surface | Invoke the tool a second time | Same canvas updates, no new surface |
| TC-5 | FR-3 | Pan/zoom | Drag + wheel + reset control | View pans, zooms, and resets to fit |
| TC-6 | FR-4 | Live update | Push a new `diagram` | Canvas re-renders without refresh |
| TC-7 | FR-4 | Channel re-init | Host re-initializes the MCP Apps channel | Canvas recovers and re-syncs |
| TC-8 | FR-5 | Select node | Click a node | Node highlights; server reads current selection |
| TC-9 | FR-5 | Selection persists | Re-render with node still present | Selection retained |
| TC-10 | FR-6 | Explain | Select node → "explain this node" | Relevant explanation appears in host |
| TC-11 | FR-7 | Expand | Select node → "expand this node" | Subnodes/detail appear in place |
| TC-12 | FR-9 | Modify | Select entrypoint → "add a new entrypoint to do X" | Clarifying questions asked, code edited, diagram updated |
| TC-13 | NFR-3 | Multi-host | Render the app in a second MCP host | Same diagram renders and accepts interactions |

## Demo script (end-to-end)

1. In the terminal: *"diagram the auth flow."* → the canvas opens in the host with
   the Mermaid diagram. **(TC-1, TC-3)**
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
