# ShopFlow — test prompts for Canvas for Copilot

Copy-paste prompts to exercise **every** Canvas for Copilot feature against this
example project. Run them in a **Copilot CLI** session inside VS Code (integrated
terminal) with the Canvas extension running, from the repo root.

> **Setup (once):** open the repo in VS Code → press **F5** (*Run Canvas Extension*)
> → in the dev-host window wait for *"MCP server ready…"* → open the integrated
> terminal → start/restart **Copilot CLI** → run **`/skills reload`** so the
> `/diagram*` skills load. Tip: `@examples/shopflow/...` adds a file to a prompt.

Legend for "expected": **node shapes** and **arrowheads** you should see (the palette
stays violet across all types — only shape/arrowhead/line-style changes per type).

---

## 1. The five diagram types (natural language)

Copilot should auto-pick the right typed tool for each.

| # | Prompt | Tool | Expect on canvas |
|---|--------|------|------------------|
| 1.1 | `Draw a dependency diagram of the ShopFlow packages (api, services, payments, data, domain).` | `diagram_dependency` | rounded boxes, solid arrows api→services→data→domain, etc. |
| 1.2 | `Draw a flowchart of the checkout process in @examples/shopflow/src/services/checkout-service.ts` | `diagram_flowchart` | terminator **pills** (start/end), process **rectangles**, decision **diamonds** with yes/no branches |
| 1.3 | `Draw the state machine for an Order in @examples/shopflow/src/domain/order.ts` | `diagram_state_machine` | `cart` marked **initial** (emerald), `delivered/cancelled/refunded` **final** (double border), **open-arrow** transitions labeled `place/pay/ship/...` |
| 1.4 | `Draw a UML class diagram for the ShopFlow domain + repositories + payment strategy.` | `diagram_class` | **sharp** class boxes; hollow-triangle inheritance & realization (realization **dashed**), ◆ composition (Order–OrderLine), ◇ aggregation (Order–Customer), dashed dependency (CheckoutService→PaymentGateway) |
| 1.5 | `Draw an ER diagram of the ShopFlow data model (Customer, Order, OrderLine, Product, Category, Payment).` | `diagram_er` | **sharp** entity boxes; plain relationship lines labeled with cardinality (`1:N`, `M:N`, `1:1`) |

---

## 2. Dependency *scope* (level) option

The `diagram_dependency` tool takes a `scope`; the prompt's stated level should be
honoured.

- **Package scope:** `Show the package-level dependency graph of ShopFlow.`
  → ~5 nodes (api, services, payments, data, domain).
- **Module scope:** `Show the module/file-level dependency graph for the services and data layers of ShopFlow.`
  → individual files (e.g. `checkout-service`, `order-service`, `order-repository`, `base-repository`, …) with import edges.
- **Function scope (call graph):** `Show the call graph of CheckoutService.checkout() in ShopFlow.`
  → functions/methods as nodes (`checkout`, `validate`, `reserve`, `charge`, `createOrder`, `transition`, `sendReceipt`) at `service` scope. Title should say "call graph".

✅ Verify: deeper scope = more, finer-grained nodes; the title reflects the level.

---

## 3. Slash-command skills

Each diagram type is also a `/` command; a `/diagram` dispatcher auto-detects the type.

- `/diagram-dependency the ShopFlow services and what they depend on`
- `/diagram-flowchart the checkout flow in ShopFlow`
- `/diagram-state-machine the ShopFlow Order lifecycle`
- `/diagram-class the ShopFlow payment strategy (PaymentMethod, CreditCardPayment, PayPalPayment)`
- `/diagram-er the ShopFlow sales data model`

**Dispatcher (auto-detect):**
- `/diagram the checkout flow of ShopFlow` → should route to **flowchart**.
- `/diagram the ShopFlow data model` → should route to **ER**.
- `/diagram what the CheckoutService depends on` → should route to **dependency**.

✅ Verify: typing `/` lists `diagram`, `diagram-dependency`, `diagram-flowchart`,
`diagram-state-machine`, `diagram-class`, `diagram-er`.

---

## 4. Drill-down: Expand an element / Back to previous scope

This is a **canvas UI** action (no prompt needed):

1. Render the package dependency diagram (prompt 1.1 or 2-package).
2. **Right-click the `services` node → "Expand element."** The view focuses `services`
   and its directly-connected neighbours (api, data, payments, domain) — same notation.
3. A **"Back to previous scope"** button appears next to the title; click it to return.
4. Drill in again on another node to confirm expansions **nest**; Back steps out one
   level at a time. (Right-click only offers Expand when the node has neighbours.)

✅ Verify: Expand focuses the element's neighbourhood; Back restores the prior scope;
Back is hidden at the top level.

---

## 5. Notation checklist (what to look for)

- **Flowchart:** start/end = rounded **pill**; steps = **rectangle**; decisions =
  **diamond**; an input/output step (ask for one) = **parallelogram**; yes/no labels on
  decision branches.
- **State machine:** initial state filled emerald; final states double-bordered;
  transitions use an **open (stick)** arrowhead with the event as the label.
- **Class:** **sharp** boxes; ▷ hollow triangle = inheritance (solid) / realization
  (dashed); ◇ hollow diamond = aggregation; ◆ filled diamond = composition; dashed →
  = dependency; solid → = association.
- **ER:** **sharp** "table" boxes; plain lines; cardinality in the label.
- **Dependency:** rounded boxes; solid arrows from dependent → dependency.

---

## 6. Notes / annotations, status colours

- `Draw the checkout flowchart for ShopFlow and add a sticky note explaining that stock is reserved before payment.`
  → a **note** node (amber sticky) attached with a **dashed leader** line.
- `Draw the ShopFlow Order state machine and colour 'cancelled' and 'refunded' as danger, 'delivered' as success.`
  → status colours (red/green) layered on the states.

---

## 7. Selection, explain, edit-in-place, code links

With a diagram on the canvas:

- **Explain (uses `describe_node`):** click the `CheckoutService` node →
  `Explain this node.` → Copilot describes it from its neighbours + your code.
- **Selection "this" (uses `get_selection` + `update_diagram`):** click a node →
  `Rename this to "Checkout orchestrator" and make it bigger.` → edits **in place**
  (view/zoom preserved).
- **Edit in place:** `Highlight the payment-related nodes and mark the data layer nodes as muted.`
- **Link + open code (uses `link_node_to_code` / `open_node_code`):**
  `Link each ShopFlow node to its source file, then show me the code for the CheckoutService node.`
  → opens `src/services/checkout-service.ts` in the editor. (Right-click a linked node
  → "Open in editor" also works.)

---

## 8. Edge cases (robustness)

- **Cycles render fine:** `Draw a dependency diagram where OrderService depends on NotificationService and NotificationService depends back on OrderService.`
  → both arrows render; no error.
- **Unknown-node edges are dropped, not fatal:** `Draw a dependency diagram of api, services, data, with an extra edge from services to a "cache" node you don't define.`
  → the diagram renders; the tool reports the skipped edge.
- **Invalid model → readable error:** if a generated graph is malformed, the canvas
  shows an error overlay (not a blank canvas).

---

## 9. One-shot "exercise everything" script

Run these in order for a quick full demo:

1. `Draw the ShopFlow package dependency diagram.`  *(dependency)*
2. Right-click `services` → **Expand element**, then **Back**.  *(drill-down)*
3. `/diagram-flowchart the ShopFlow checkout`  *(flowchart notation)*
4. `/diagram-state-machine the ShopFlow Order lifecycle`  *(initial/final + events)*
5. `/diagram-class the ShopFlow repositories and payment strategy`  *(UML arrowheads)*
6. `/diagram-er the ShopFlow data model`  *(cardinality)*
7. `Show the call graph of CheckoutService.checkout().`  *(function scope)*
8. Click the checkout node → `Explain this node, then link it to its code and open it.`
   *(explain + code link)*
