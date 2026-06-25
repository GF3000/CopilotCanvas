# 🎬 Canvas for Copilot — Hackathon Video Script

> **Working production script (v3).** Restructured for a strong **cold-open hook**:
> Problem first (no logo/team), then the title reveal as the *payoff*. Team moved
> to the outro/credits. Edit freely — shared draft.

---

## 1. Overview

| Field | Value |
|-------|-------|
| **Title** | Canvas for Copilot — see your code, don't just read it |
| **Purpose** | Hackathon submission / demo video |
| **Runtime** | Up to **4 min** allowed · recommended **~2–2.5 min** (current draft ~90 s — expandable, see §8) |
| **Format** | 1920×1080, 30 fps, H.264 `.mp4` |
| **Audience** | Hackathon judges + developers |
| **Tone** | Authentic, confident, energetic — real intern story, precise product claims |
| **Music** | "Evolution" — Bensound.com |
| **Voiceover** | Optional — written to be narrated OR to stand alone as on-screen text |

### Hook strategy (read this first)
The first **3–5 seconds decide everything**. We **cold-open on the intern pain** —
shown, not told — and **delay the logo/team** so the title lands as the *answer*
to the tension. Rule of thumb: tension in the first sentence, payoff on the reveal.

### The core story
We're **5 software-engineering interns** — **2 in Redmond, 2 in Dublin, 1 in
India**. Every project starts the same way: a *huge* unfamiliar repo and only a
few weeks to understand it and ship something real. Copilot CLI explains the
codebase — but only in **walls of text**. **Canvas for Copilot** turns those
explanations into **live, interactive diagrams** inside VS Code: *see* a system,
click into it, and even change code through it.

### Three things every viewer must remember
1. **Problem:** new to a big codebase + no time = text explanations are too slow.
2. **Solution:** Canvas for Copilot = live, interactive diagrams from Copilot, inside VS Code.
3. **Magic:** a **bidirectional loop** — click / expand / edit the diagram, and Copilot acts on it (even writing real code).

---

## 2. Timeline at a glance

| # | Scene | ~Time | Dur | Real clip? |
|---|-------|-------|-----|------------|
| 1 | 🪝 COLD-OPEN HOOK (the problem) | 0:00–0:06 | 6 s | — |
| 2 | Problem deepens (walls of text) | 0:06–0:16 | 10 s | — |
| 3 | TITLE REVEAL / Solution | 0:16–0:26 | 10 s | — |
| 4 | Feature 1 · Visualize (anim) | 0:26–0:34 | 8 s | — |
| 5 | 🎥 Demo · Visualize | 0:34–0:40 | 6 s | **clip-visualize.mp4** |
| 6 | Feature 2 · Interact (anim) | 0:40–0:48 | 8 s | — |
| 7 | 🎥 Demo · Interact | 0:48–0:54 | 6 s | **clip-interact.mp4** |
| 8 | Feature 3 · Modify (anim) | 0:54–1:02 | 8 s | — |
| 9 | 🎥 Demo · Modify | 1:02–1:08 | 6 s | **clip-modify.mp4** |
| 10 | How to download | 1:08–1:20 | 12 s | optional clip |
| 11 | Future work | 1:20–1:30 | 10 s | — |
| 12 | Outro · Team + CTA | 1:30–1:40 | 10 s | — |

---

## 3. Scene-by-scene script

Format per scene: **VISUAL** · **ON-SCREEN TEXT** · **VOICEOVER** · **NOTES**.

---

### Scene 1 — 🪝 COLD-OPEN HOOK · `0:00–0:06`
> No logo. No team. No product name yet. Pure tension.
- **VISUAL:** Smash cut to a **giant repo file-tree avalanche** flooding the screen (hundreds of files cascading) + a **ticking clock / countdown** in the corner. Slightly overwhelming on purpose.
- **ON-SCREEN TEXT:**
  - `POV: your first week as an intern 👀`
  - `understand this ENTIRE repo. ship real code.`
  - `⏳ you have 3 weeks.`
- **VOICEOVER:** *"Day one as an intern. Here's a massive codebase you've never seen — and a few weeks to understand it and ship something real."*
- **NOTES:** Music starts on the cut (a single hit/riser). This is the make-or-break moment — keep it punchy, a little stressful, no branding yet.

---

### Scene 2 — Problem deepens · `0:06–0:16`
- **VISUAL:** You "ask for help" — a fake terminal types `copilot explain this repo` and replies with an **endless wall of paragraphs** that keeps scrolling. Eyes-glaze-over energy.
- **ON-SCREEN TEXT:**
  - Terminal: `$ copilot explain this repo` → 6–8 lines of dense prose ("…depends on… which depends on…")
  - Punchline: `Copilot explains it… in walls of text. 🧱`
  - `Reading paragraphs ≠ understanding a system.`
- **VOICEOVER:** *"Copilot CLI can explain it — but everything comes back as text. And reading paragraph after paragraph is a painfully slow way to see how a whole system actually fits together."*
- **NOTES:** Let the scroll feel slightly too long — that *is* the point. Tension peaks here right before the reveal.

---

### Scene 3 — TITLE REVEAL / Solution · `0:16–0:26`
> The payoff. Logo arrives as the *answer* to the pain.
- **VISUAL:** Beat drop. The wall of text **collapses / morphs into** a clean interactive node-graph that draws itself (Client→Gateway→Auth/Orders/Users). Title slams in over it.
- **ON-SCREEN TEXT:**
  - Pill: `there's a better way ✨`
  - Title: `CANVAS for COPILOT`
  - Sub: `Copilot's explanations → live, interactive diagrams, right inside a VS Code tab. text → visual, instantly. 🪄`
- **VOICEOVER:** *"So we built Canvas for Copilot. It turns those text explanations into a live, interactive diagram — right inside a VS Code tab. Suddenly, you can see the system."*
- **NOTES:** Music swells. The text→diagram morph is the signature moment — give it room to breathe.

---

### Scene 4 — Feature 1 · Visualize (animated) · `0:26–0:34`
- **VISUAL:** Left: `1 · Visualize` + bullets reveal. Right: graph builds node by node.
- **ON-SCREEN TEXT:**
  - Heading: `1 · Visualize`
  - `💬 Ask: "diagram the auth flow"`
  - `🪟 Canvas opens as a VS Code tab`
  - `🔍 Pan & zoom the live graph`
  - `⚡ Edit from the CLI → updates instantly`
- **VOICEOVER:** *"Feature one — visualize. Ask Copilot to diagram a flow, and the canvas opens right in VS Code. Pan, zoom, and when Copilot updates it, it changes live."*

---

### Scene 5 — 🎥 Demo · Visualize · `0:34–0:40`
- **VISUAL:** Real recording in a VS Code-style window frame, subtle zoom, "REAL DEMO 👀" badge.
- **ON-SCREEN TEXT:** `…and here it is for real 👇` / caption `Copilot draws the live graph in a VS Code tab`
- **VOICEOVER:** *"Here it is for real."*
- **🎬 RECORD → `clip-visualize.mp4`:** terminal `diagram the auth flow` → canvas tab opens → graph renders → pan/zoom. ~5–8 s.

---

### Scene 6 — Feature 2 · Interact (animated) · `0:40–0:48`
- **VISUAL:** Left: `2 · Interact` + bullets. Right: **Auth** node glows; a 👆 cursor flies in and clicks it.
- **ON-SCREEN TEXT:**
  - Heading: `2 · Interact`
  - `🖱️ Click any node — Copilot knows what you mean`
  - `🧐 "Explain this node" → instant breakdown`
  - `➕ "Expand this node" → grows new detail`
  - `🔁 Round-trips both ways, no refresh`
- **VOICEOVER:** *"Feature two — interact. Click any node and Copilot knows exactly what you mean. Ask it to explain that piece, or expand it, and the diagram grows new detail — no refresh."*

---

### Scene 7 — 🎥 Demo · Interact · `0:48–0:54`
- **VISUAL:** Real recording in the VS Code frame.
- **ON-SCREEN TEXT:** `click → explain → expand 🪄` / caption `Selecting a node feeds context straight back to Copilot`
- **VOICEOVER:** *"Select, explain, expand."*
- **🎬 RECORD → `clip-interact.mp4`:** click a node → `explain this node` (show reply) → `expand this node` (subgraph appears). ~5–8 s.

---

### Scene 8 — Feature 3 · Modify code + diagram (animated) · `0:54–1:02`
- **VISUAL:** Left: `3 · Modify code + diagram` + bullets. Right: a new green **Search API ✨** node grows in via a dashed edge.
- **ON-SCREEN TEXT:**
  - Heading: `3 · Modify code + diagram`
  - `🎯 Select a node, say "add a Search endpoint"`
  - `🤖 Copilot asks smart clarifying questions`
  - `📝 It writes the real code in your repo`
  - `🌱 …and grows the diagram to match`
- **VOICEOVER:** *"Feature three — and this is the magic. Select a node and say 'add a search endpoint.' Copilot asks a clarifying question, writes the real code in your repo, and grows the diagram to match. Code and diagram, evolving together."*
- **NOTES:** Climax — strongest claim. Land it clearly.

---

### Scene 9 — 🎥 Demo · Modify · `1:02–1:08`
- **VISUAL:** Real recording in the VS Code frame.
- **ON-SCREEN TEXT:** `it edits real code 🤯` / caption `Copilot writes the endpoint and grows the diagram to match`
- **VOICEOVER:** *"Real code, real diagram."*
- **🎬 RECORD → `clip-modify.mp4`:** select node → `add a search endpoint` → Copilot asks a question → show new code/diff → diagram updates. ~6–10 s.

---

### Scene 10 — How to download · `1:08–1:20`
- **VISUAL:** Clean "install" slide. VS Code Marketplace card mock + a terminal showing the MCP config / command. Numbered steps animate in.
- **ON-SCREEN TEXT:**
  - Heading: `Get it in 3 steps 🚀`
  - `1️⃣ Install the "Canvas for Copilot" VS Code extension`
  - `2️⃣ Add the Canvas MCP server to your Copilot CLI config`
  - `3️⃣ Run Copilot CLI in VS Code's terminal → ask for a diagram`
  - Footer: `Runs 100% locally · single VS Code window`
- **VOICEOVER:** *"Getting started is easy. Install the VS Code extension, add the Canvas MCP server to your Copilot config, then run Copilot in VS Code's terminal and ask for a diagram. It all runs locally."*
- **NOTES:** ✅ Confirm exact install steps / marketplace name before final render. Optional: replace the mock with a short real install clip.

---

### Scene 11 — Future work · `1:20–1:30`
- **VISUAL:** Three forward-looking "roadmap" cards slide in (spring pop), each with a **floating icon** and a coloured glow.
- **ON-SCREEN TEXT:**
  - Heading: `What's next 🔮`
  - `👥 Collaborate in real time with others`
  - `📊 Work with tables & more complex figures`
  - `💾 Save your diagrams in your account`
- **VOICEOVER:** *"And we're just getting started. Next up: collaborate on a canvas in real time, work with tables and richer figures, and save your diagrams to your account."*
- **NOTES:** Maps to the roadmap — honest framing as what's coming next.

---

### Scene 12 — Outro · Team + CTA · `1:30–1:40`
> Team belongs HERE (credits), not at the open.
- **VISUAL:** Celebration emojis. Two-line kinetic payoff, then a row of **5 circular avatar slots** (equal size, evenly spaced) that pop in one by one, each with a name label beneath. Then the brand pill.
- **ON-SCREEN TEXT:**
  - `SEE your code.`
  - `don't just read it.`
  - Pill: `Canvas for Copilot 💜`
  - `built by 5 SWE interns · 2 Redmond · 2 Dublin · 1 India`
  - **5 avatar circles** with labels: `Ashley Torres Perez` · `Guillermo Franco Gimeno` · `Hadwik Payidiparthy` · `Nataliia Kulieshova` · `Oleksii Babii`
  - `a visual reasoning channel for Copilot CLI · hackathon 2026`
  - Credit: `Music: "Evolution" by Bensound.com`
- **VOICEOVER:** *"Built by five software-engineering interns — across Redmond, Dublin, and India. Canvas for Copilot — see your code, don't just read it."*
- **NOTES:** 5 equal circular avatars in a single row: Ashley Torres Perez, Guillermo Franco Gimeno, Hadwik Payidiparthy, Nataliia Kulieshova, Oleksii Babii. Drop each member's photo into `public/avatars/` (e.g. `avatar-1.png`…`avatar-5.png`); falls back to initials if no photo.

---

## 4. Full voiceover (clean read-through)

> ~95–105 s at a relaxed, energetic pace. ≈ 230 words.

1. Day one as an intern. Here's a massive codebase you've never seen — and a few weeks to understand it and ship something real.
2. Copilot CLI can explain it — but everything comes back as text. And reading paragraph after paragraph is a painfully slow way to see how a whole system actually fits together.
3. So we built **Canvas for Copilot**. It turns those text explanations into a live, interactive diagram — right inside a VS Code tab. Suddenly, you can *see* the system.
4. Feature one — **visualize**. Ask Copilot to diagram a flow, and the canvas opens right in VS Code. Pan, zoom, and when Copilot updates it, it changes live. *(Here it is for real.)*
5. Feature two — **interact**. Click any node and Copilot knows exactly what you mean. Ask it to explain that piece, or expand it, and the diagram grows new detail — no refresh. *(Select, explain, expand.)*
6. Feature three — and this is the magic. Select a node and say "add a search endpoint." Copilot asks a clarifying question, writes the real code in your repo, and grows the diagram to match. *(Real code, real diagram.)*
7. Getting started is easy: install the VS Code extension, add the Canvas MCP server to your Copilot config, and ask for a diagram — all running locally.
8. And we're just getting started — real-time collaboration with others, tables and richer figures, and saving your diagrams to your account are next.
9. Built by five software-engineering interns, across Redmond, Dublin, and India. **Canvas for Copilot** — see your code, don't just read it.

---

## 5. Product facts (keep claims accurate)

From `docs/PROJECT_BRIEF.md` + `docs/REQUIREMENTS.md`:

- Runs **locally**; Copilot CLI in **VS Code's integrated terminal** is the brain.
- A **thin VS Code extension** opens the canvas as a **webview tab** and bridges it to the CLI session over the **MCP Apps** `postMessage` channel.
- Diagrams are interactive **Cytoscape** graphs (pan, zoom, node selection).
- The novelty is the **bidirectional loop**, delivered in 3 tiers: **Visualize → Interact → Modify**.
- **Future work** (roadmap / what's next): **real-time collaboration** with others, **tables & more complex figures**, and **saving diagrams to your account**.
- ❗ Don't over-claim: today it's a **local, single-session, VS Code-first** dev tool.

---

## 6. Production checklist

- [ ] ~~Fill in real team names~~ ✅ done (Ashley, Guillermo, Hadwik, Nataliia, Oleksii)
- [ ] Add 5 avatar photos to `public/avatars/` (`avatar-1.png`…`avatar-5.png`)
- [ ] Confirm **exact install steps + marketplace name** (Scene 10)
- [ ] Record `clip-visualize.mp4`, `clip-interact.mp4`, `clip-modify.mp4` → `public/clips/`
- [ ] (Optional) record an install clip for Scene 10
- [ ] Set `CLIP_SOURCES` in `src/CanvasForCopilot.tsx`
- [ ] (Optional) record voiceover; add as `<Audio>`, drop music to ~25–30%
- [ ] Confirm Bensound credit / license code
- [ ] Build the new scenes in Remotion: **Cold-open hook**, **How to download**, **Future work**, **Team outro**
- [ ] Render: `npx remotion render CanvasForCopilotFull out/canvas-full.mp4`

---

## 7. Open questions / decisions

- Hook visual: file-tree avalanche, or a fast montage of confusing code? (Both test well — avalanche is simpler to build.)
- Team in outro: avatars/photos, or just names + locations?
- Voiceover: human, AI TTS, or text-only?
- Target length: ~90 s current; up to **4 min** allowed — how much to expand? (see §8)
- Install scene: animated mock, or a real screen recording?

---

## 8. Optional expansion modules (to use the 4-min allowance)

The current draft is a tight **~90 s**. You have up to **4 min**, so here are
drop-in modules you can add. **Recommendation: aim for ~2–2.5 min** — long enough
to show real depth, short enough to keep judges engaged. Don't pad to 4 min just
because you can.

| Module | Where | +Time | Why add it |
|--------|-------|-------|------------|
| **A. Real onboarding story** | after Scene 2 | +20 s | An intern voice: "my first repo had 800 files…" — makes the pain concrete & human |
| **B. How it works (architecture)** | after Scene 3 | +25 s | Show the loop: Copilot CLI ⇄ MCP server ⇄ VS Code webview (Cytoscape). Judges reward technical depth |
| **C. The bidirectional loop, explained** | after Feature 3 | +20 s | The real novelty — animate canvas→CLI and CLI→canvas arrows; the "second surface" idea |
| **D. Longer end-to-end demo** | replace one clip | +20–40 s | One uncut "wow" flow: ask → diagram → click → expand → modify → code changes, in a single take |
| **E. Before / after split-screen** | after Scene 2 | +15 s | Wall of text on the left, live diagram on the right — instant contrast |
| **F. Who it's for / use cases** | before Future work | +15 s | Onboarding, architecture reviews, navigating unfamiliar code |

**Suggested ~2.5 min cut:** base script **+ B (architecture) + C (the loop) + D (one
longer real demo)**. That keeps the strong hook, adds the technical credibility
judges look for, and lets one demo really breathe.

> Tell me which modules you want and I'll write them out as full scenes (visual /
> on-screen text / VO) and slot them into the timeline.
