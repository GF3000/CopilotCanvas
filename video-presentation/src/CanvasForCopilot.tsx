import { Audio } from "@remotion/media";
import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
  OffthreadVideo,
  random,
  Sequence,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { loadFont as loadDisplayFont } from "@remotion/google-fonts/Inter";
import { loadFont as loadMonoFont } from "@remotion/google-fonts/JetBrainsMono";
import { loadFont as loadTitleFont } from "@remotion/google-fonts/Sora";

/* ------------------------------------------------------------------ */
/* Design tokens                                                       */
/* ------------------------------------------------------------------ */
// Real web fonts (loaded via @remotion/google-fonts) so they render identically
// in the Studio preview and the final headless render — no reliance on
// system-installed fonts.
const { fontFamily: FONT } = loadDisplayFont("normal", {
  weights: ["400", "500", "600", "700", "800", "900"],
  subsets: ["latin"],
});
const { fontFamily: MONO } = loadMonoFont("normal", {
  weights: ["400", "600", "700"],
  subsets: ["latin"],
});
// Distinct display font for the big animated headlines (Kinetic).
const { fontFamily: TITLE_FONT } = loadTitleFont("normal", {
  weights: ["600", "700", "800"],
  subsets: ["latin"],
});

const C = {
  bg0: "#0b1020",
  bg1: "#161b3a",
  cyan: "#00F5D4",
  pink: "#FF3CAC",
  purple: "#9b5cff",
  yellow: "#FFD93D",
  green: "#6BCB77",
  ink: "#0b1020",
  white: "#ffffff",
};

/* ------------------------------------------------------------------ */
/* Shared helpers                                                      */
/* ------------------------------------------------------------------ */

// Animated dark gradient with drifting neon blobs
const Backdrop: React.FC = () => {
  const frame = useCurrentFrame();
  const a = interpolate(frame, [0, 1800], [120, 480]);
  const b1x = 30 + Math.sin(frame / 80) * 15;
  const b2x = 70 + Math.cos(frame / 60) * 15;
  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(${a}deg, ${C.bg0}, ${C.bg1})`,
      }}
    >
      <AbsoluteFill
        style={{
          background: `radial-gradient(40% 40% at ${b1x}% 30%, ${C.purple}55, transparent 70%),
                       radial-gradient(45% 45% at ${b2x}% 75%, ${C.cyan}40, transparent 70%),
                       radial-gradient(35% 35% at 85% 20%, ${C.pink}33, transparent 70%)`,
          filter: "blur(8px)",
        }}
      />
    </AbsoluteFill>
  );
};

// Scene wrapper: fades + scales in at start, fades out at end
const Scene: React.FC<{
  durationInFrames: number;
  children: React.ReactNode;
}> = ({ durationInFrames, children }) => {
  const frame = useCurrentFrame();
  const enter = interpolate(frame, [0, 14], [0, 1], {
    easing: Easing.bezier(0.16, 1, 0.3, 1),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const exit = interpolate(
    frame,
    [durationInFrames - 12, durationInFrames],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const scale = interpolate(enter, [0, 1], [0.94, 1]);
  return (
    <AbsoluteFill
      style={{
        opacity: enter * exit,
        scale: String(scale),
        justifyContent: "center",
        alignItems: "center",
        padding: 80,
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

// A word whose letters pop in with overshoot
const Kinetic: React.FC<{
  text: string;
  size: number;
  color: string;
  delay?: number;
  outline?: string;
  weight?: number;
}> = ({ text, size, color, delay = 0, outline, weight = 800 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center" }}>
      {text.split("").map((ch, i) => {
        const pop = spring({
          frame: frame - delay - i * 2.5,
          fps,
          config: { damping: 11, stiffness: 170, mass: 0.6 },
        });
        return (
          <span
            key={i}
            style={{
              display: "inline-block",
              fontFamily: TITLE_FONT,
              fontWeight: weight,
              fontSize: size,
              lineHeight: 1.05,
              color,
              whiteSpace: "pre",
              scale: String(pop),
              rotate: `${interpolate(pop, [0, 1], [-18, 0])}deg`,
              WebkitTextStroke: outline ? `${size * 0.04}px ${outline}` : undefined,
            }}
          >
            {ch}
          </span>
        );
      })}
    </div>
  );
};

// Simple fade/slide-up reveal for a block
const Reveal: React.FC<{
  delay?: number;
  y?: number;
  children: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ delay = 0, y = 30, children, style }) => {
  const frame = useCurrentFrame();
  const p = interpolate(frame, [delay, delay + 18], [0, 1], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <div
      style={{
        opacity: p,
        translate: `0px ${interpolate(p, [0, 1], [y, 0])}px`,
        ...style,
      }}
    >
      {children}
    </div>
  );
};

const Pill: React.FC<{
  children: React.ReactNode;
  bg?: string;
  color?: string;
}> = ({ children, bg = C.cyan, color = C.ink }) => (
  <span
    style={{
      fontFamily: FONT,
      fontWeight: 800,
      fontSize: 34,
      padding: "12px 30px",
      borderRadius: 999,
      background: bg,
      color,
      letterSpacing: 1,
    }}
  >
    {children}
  </span>
);

// floating emoji layer (subtle)
const FloatEmojis: React.FC<{ items: string[]; count?: number }> = ({
  items,
  count = 12,
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  return (
    <AbsoluteFill>
      {new Array(count).fill(0).map((_, i) => {
        const seed = i + 7;
        const x = random(`x${seed}`) * width;
        const speed = 0.3 + random(`s${seed}`) * 0.7;
        const y = height + 80 - ((frame * speed * 5 + i * 120) % (height + 200));
        const drift = Math.sin((frame + i * 30) / 22) * 30;
        return (
          <span
            key={i}
            style={{
              position: "absolute",
              left: x + drift,
              top: y,
              fontSize: 36 + random(`z${seed}`) * 30,
              opacity: 0.5,
            }}
          >
            {items[i % items.length]}
          </span>
        );
      })}
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ */
/* Fake terminal (text-only Copilot) for the PROBLEM scene             */
/* ------------------------------------------------------------------ */
const FakeTerminal: React.FC = () => {
  const frame = useCurrentFrame();
  const lines = [
    "$ copilot explain auth flow",
    "The request hits the API gateway, which calls the",
    "auth service. The auth service validates the JWT,",
    "then queries the user store. On success it issues",
    "a session token via the token service, which the",
    "gateway returns to the client. The orders service",
    "also depends on the auth service for every call...",
    "...and the payments service depends on orders,",
    "which depends on the user store, which depends on...",
  ];
  return (
    <div
      style={{
        width: 1100,
        background: "#05070f",
        borderRadius: 18,
        border: `2px solid ${C.purple}66`,
        boxShadow: "0 30px 80px rgba(0,0,0,0.6)",
        overflow: "hidden",
        fontFamily: MONO,
      }}
    >
      <div
        style={{
          display: "flex",
          gap: 10,
          padding: "14px 18px",
          background: "#0c1226",
        }}
      >
        {[C.pink, C.yellow, C.green].map((c) => (
          <div
            key={c}
            style={{ width: 14, height: 14, borderRadius: 99, background: c }}
          />
        ))}
        <span style={{ color: "#6b7299", fontSize: 20, marginLeft: 10 }}>
          copilot — terminal
        </span>
      </div>
      <div style={{ padding: 28, fontSize: 26, lineHeight: 1.5 }}>
        {lines.map((ln, i) => {
          const appear = interpolate(frame, [i * 8, i * 8 + 6], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          return (
            <div
              key={i}
              style={{
                color: i === 0 ? C.cyan : "#aeb6e0",
                opacity: appear,
              }}
            >
              {ln}
            </div>
          );
        })}
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Mini interactive graph (used in SOLUTION + FEATURE scenes)          */
/* ------------------------------------------------------------------ */
type GNode = { id: string; x: number; y: number; label: string; color: string };

const NODES: GNode[] = [
  { id: "client", x: 0.5, y: 0.12, label: "Client", color: C.cyan },
  { id: "gateway", x: 0.5, y: 0.4, label: "Gateway", color: C.purple },
  { id: "auth", x: 0.22, y: 0.72, label: "Auth", color: C.pink },
  { id: "orders", x: 0.5, y: 0.72, label: "Orders", color: C.yellow },
  { id: "users", x: 0.78, y: 0.72, label: "Users DB", color: C.green },
];
const EDGES: [string, string][] = [
  ["client", "gateway"],
  ["gateway", "auth"],
  ["gateway", "orders"],
  ["gateway", "users"],
  ["orders", "users"],
  ["auth", "users"],
];

const MiniGraph: React.FC<{
  w: number;
  h: number;
  appearDelay?: number;
  highlight?: string | null;
  extraNode?: GNode | null;
  extraDelay?: number;
}> = ({ w, h, appearDelay = 0, highlight = null, extraNode = null, extraDelay = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pos = (n: GNode) => ({ left: n.x * w, top: n.y * h });

  const nodeScale = (i: number) =>
    spring({
      frame: frame - appearDelay - i * 5,
      fps,
      config: { damping: 12, stiffness: 160 },
    });

  const allNodes = extraNode ? [...NODES, extraNode] : NODES;
  const allEdges = extraNode
    ? [...EDGES, ["gateway", extraNode.id] as [string, string]]
    : EDGES;

  return (
    <div style={{ position: "relative", width: w, height: h }}>
      <svg width={w} height={h} style={{ position: "absolute", inset: 0 }}>
        {allEdges.map(([a, b], i) => {
          const na = allNodes.find((n) => n.id === a)!;
          const nb = allNodes.find((n) => n.id === b)!;
          const isExtra = extraNode && (a === extraNode.id || b === extraNode.id);
          const draw = interpolate(
            frame,
            isExtra
              ? [extraDelay, extraDelay + 14]
              : [appearDelay + 8 + i * 3, appearDelay + 22 + i * 3],
            [0, 1],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
          );
          const x1 = na.x * w;
          const y1 = na.y * h;
          const x2 = nb.x * w;
          const y2 = nb.y * h;
          return (
            <line
              key={`${a}-${b}`}
              x1={x1}
              y1={y1}
              x2={x1 + (x2 - x1) * draw}
              y2={y1 + (y2 - y1) * draw}
              stroke={isExtra ? C.green : `${C.cyan}aa`}
              strokeWidth={isExtra ? 5 : 3}
              strokeDasharray={isExtra ? "8 8" : undefined}
            />
          );
        })}
      </svg>

      {allNodes.map((n, i) => {
        const isExtra = extraNode && n.id === extraNode.id;
        const s = isExtra
          ? spring({ frame: frame - extraDelay, fps, config: { damping: 11 } })
          : nodeScale(i);
        const isHi = highlight === n.id;
        const pulse = isHi ? 1 + Math.sin(frame / 5) * 0.08 : 1;
        const p = pos(n);
        return (
          <div
            key={n.id}
            style={{
              position: "absolute",
              left: p.left,
              top: p.top,
              translate: "-50% -50%",
              scale: String(s * pulse),
            }}
          >
            <div
              style={{
                fontFamily: FONT,
                fontWeight: 800,
                fontSize: 28,
                color: C.ink,
                background: n.color,
                padding: "16px 26px",
                borderRadius: 16,
                whiteSpace: "nowrap",
                border: isHi ? `5px solid ${C.white}` : "5px solid transparent",
                boxShadow: isHi
                  ? `0 0 40px ${n.color}, 0 0 80px ${n.color}`
                  : "0 10px 30px rgba(0,0,0,0.4)",
              }}
            >
              {n.label}
            </div>
          </div>
        );
      })}
    </div>
  );
};

// Fake cursor that moves to a point and "clicks"
const Cursor: React.FC<{
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  start: number;
  travel?: number;
}> = ({ fromX, fromY, toX, toY, start, travel = 22 }) => {
  const frame = useCurrentFrame();
  const p = interpolate(frame, [start, start + travel], [0, 1], {
    easing: Easing.bezier(0.22, 1, 0.36, 1),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const x = interpolate(p, [0, 1], [fromX, toX]);
  const y = interpolate(p, [0, 1], [fromY, toY]);
  const clickFrame = frame - (start + travel);
  const click = clickFrame >= 0 && clickFrame < 10 ? 1 : 0;
  return (
    <div style={{ position: "absolute", left: x, top: y, zIndex: 50 }}>
      <div style={{ fontSize: 46, filter: "drop-shadow(0 3px 4px rgba(0,0,0,.6))" }}>
        👆
      </div>
      {click ? (
        <div
          style={{
            position: "absolute",
            left: 6,
            top: 4,
            width: 40,
            height: 40,
            borderRadius: 99,
            border: `4px solid ${C.white}`,
            translate: "-50% -50%",
            scale: String(1 + clickFrame * 0.18),
            opacity: 1 - clickFrame * 0.1,
          }}
        />
      ) : null}
    </div>
  );
};

const SectionLabel: React.FC<{ n: string; title: string; color: string }> = ({
  n,
  title,
  color,
}) => (
  <Reveal>
    <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
      <span
        style={{
          fontFamily: FONT,
          fontWeight: 900,
          fontSize: 40,
          color: C.ink,
          background: color,
          width: 70,
          height: 70,
          borderRadius: 18,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {n}
      </span>
      <span style={{ fontFamily: FONT, fontWeight: 900, fontSize: 56, color }}>
        {title}
      </span>
    </div>
  </Reveal>
);

/* ================================================================== */
/* SCENES                                                              */
/* ================================================================== */

const SceneHook: React.FC = () => (
  <Scene durationInFrames={150}>
    <FloatEmojis items={["😵‍💫", "📜", "🥱", "💤", "❓"]} count={10} />
    <div style={{ textAlign: "center" }}>
      <Reveal>
        <Pill bg={C.pink} color={C.white}>
          POV: you asked your AI to explain the codebase
        </Pill>
      </Reveal>
      <div style={{ height: 40 }} />
      <Kinetic text="…and it gave you" size={70} color={C.white} delay={10} />
      <div style={{ height: 16 }} />
      <Kinetic
        text="A WALL OF TEXT 🧱"
        size={120}
        color={C.yellow}
        delay={22}
        outline={C.ink}
      />
    </div>
  </Scene>
);

// Cascading repo file names — the "overwhelm" of a huge unfamiliar codebase
const FILE_NAMES = [
  "server.ts", "auth.service.ts", "gateway.ts", "protocol.ts", "canvas.tsx",
  "index.ts", "extension.ts", "render.ts", "graph.ts", "mcp-server.ts",
  "webview.ts", "cytoscape.ts", "handlers.ts", "session.ts", "utils.ts",
  "types.ts", "config.ts", "router.ts", "db.ts", "cache.ts", "queue.ts",
  "logger.ts", "client.ts", "store.ts", "model.ts", "schema.ts", "api.ts",
  "hooks.ts", "layout.tsx", "app.tsx", "main.ts", "bridge.ts", "diff.ts",
];

const FileAvalanche: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  return (
    <AbsoluteFill>
      {new Array(46).fill(0).map((_, i) => {
        const seed = i + 1;
        const x = random(`fx${seed}`) * width;
        const speed = 1.4 + random(`fs${seed}`) * 2.6;
        const offset = random(`fo${seed}`) * (height + 200);
        const y = ((frame * speed * 4 + offset) % (height + 200)) - 100;
        const name = FILE_NAMES[i % FILE_NAMES.length];
        return (
          <span
            key={i}
            style={{
              position: "absolute",
              left: x,
              top: y,
              fontFamily: MONO,
              fontSize: 18 + random(`fz${seed}`) * 16,
              color: "#5566aa",
              opacity: 0.22 + random(`fp${seed}`) * 0.4,
              whiteSpace: "nowrap",
            }}
          >
            📄 {name}
          </span>
        );
      })}
    </AbsoluteFill>
  );
};

// COLD-OPEN HOOK — pure tension, no branding yet
const SceneHookCold: React.FC = () => {
  const frame = useCurrentFrame();
  const tick = Math.sin(frame / 4) * 6; // clock wobble
  return (
    <Scene durationInFrames={180}>
      <FileAvalanche />
      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          background:
            "radial-gradient(60% 60% at 50% 50%, rgba(11,16,32,0.55), rgba(11,16,32,0.9))",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <Reveal>
            <Pill bg={C.pink} color={C.white}>
              POV: your first week as an intern 👀
            </Pill>
          </Reveal>
          <div style={{ height: 34 }} />
          <Kinetic
            text="understand this ENTIRE repo."
            size={78}
            color={C.white}
            delay={8}
          />
          <div style={{ height: 8 }} />
          <Kinetic text="ship real code." size={78} color={C.white} delay={18} />
          <div style={{ height: 30 }} />
          <Reveal delay={40}>
            <span
              style={{
                display: "inline-block",
                rotate: `${tick}deg`,
                fontFamily: TITLE_FONT,
                fontWeight: 800,
                fontSize: 92,
                color: C.yellow,
                WebkitTextStroke: `4px ${C.ink}`,
              }}
            >
              ⏳ you have 3 weeks.
            </span>
          </Reveal>
        </div>
      </AbsoluteFill>
    </Scene>
  );
};


const SceneProblem: React.FC = () => (
  <Scene durationInFrames={270}>
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 34 }}>
      <SectionLabel n="!" title="The problem" color={C.pink} />
      <FakeTerminal />
      <Reveal delay={70}>
        <div style={{ textAlign: "center" }}>
          <span
            style={{
              fontFamily: FONT,
              fontWeight: 800,
              fontSize: 40,
              color: C.white,
            }}
          >
            Copilot CLI explains systems… in{" "}
            <span style={{ color: C.pink }}>TEXT only.</span>
            <br />
            But our brains are{" "}
            <span style={{ color: C.cyan }}>visual</span> — we think in maps,
            not paragraphs. 🧠✨
          </span>
        </div>
      </Reveal>
    </div>
  </Scene>
);

const SceneSolution: React.FC = () => {
  return (
    <Scene durationInFrames={240}>
      <FloatEmojis items={["✨", "🔥", "💯", "🚀"]} count={8} />
      <div style={{ textAlign: "center" }}>
        <Reveal>
          <Pill bg={C.cyan}>the glow-up ✨</Pill>
        </Reveal>
        <div style={{ height: 24 }} />
        <Kinetic
          text="CANVAS for COPILOT"
          size={108}
          color={C.cyan}
          delay={8}
          outline={C.ink}
        />
        <div style={{ height: 24 }} />
        <Reveal delay={40}>
          <span
            style={{
              fontFamily: FONT,
              fontWeight: 700,
              fontSize: 40,
              color: C.white,
            }}
          >
            It turns Copilot&apos;s words into{" "}
            <span style={{ color: C.yellow }}>live, interactive diagrams</span>
            <br />
            right inside a VS Code tab. text → visual, instantly. 🪄
          </span>
        </Reveal>
        <div style={{ height: 40 }} />
        <Reveal delay={70} style={{ display: "flex", justifyContent: "center" }}>
          <MiniGraph w={760} h={300} appearDelay={70} />
        </Reveal>
      </div>
    </Scene>
  );
};

// FEATURE 1 — Visualize + explain
const SceneFeature1: React.FC = () => (
  <Scene durationInFrames={300}>
    <FeatureLayout
      n="1"
      title="Visualize + explain"
      color={C.cyan}
      bullets={[
        "💬 Ask: “diagram the auth flow”",
        "🪟 Canvas opens as a VS Code tab",
        "🔍 Pan & zoom the live graph",
        "🧐 Click a node → “explain this” → instant breakdown",
      ]}
      graph={
        <div style={{ position: "relative", width: 760, height: 520 }}>
          <MiniGraph w={760} h={520} appearDelay={30} highlight="auth" />
          <Cursor
            fromX={620}
            fromY={40}
            toX={150}
            toY={370}
            start={60}
            travel={26}
          />
        </div>
      }
    />
  </Scene>
);

// FEATURE 2 — Expand + undo
const SceneFeature2: React.FC = () => {
  const grown: GNode = {
    id: "expand",
    x: 0.14,
    y: 0.92,
    label: "+ detail 🌱",
    color: C.purple,
  };
  return (
    <Scene durationInFrames={300}>
      <FeatureLayout
        n="2"
        title="Expand + undo"
        color={C.purple}
        bullets={[
          "➕ “Expand this node” → grows new detail in place",
          "🌳 Drill deeper into any part of the system",
          "↩️ Undo to step back — instantly",
          "🔁 Explore freely, never lose your place",
        ]}
        graph={
          <MiniGraph
            w={760}
            h={520}
            appearDelay={20}
            highlight="auth"
            extraNode={grown}
            extraDelay={110}
          />
        }
      />
    </Scene>
  );
};

// FEATURE 3 — Search + code reference
const SceneFeature3: React.FC = () => (
  <Scene durationInFrames={300}>
    <FeatureLayout
      n="3"
      title="Search + code reference"
      color={C.green}
      bullets={[
        "🔎 Search the diagram — jump to any node fast",
        "🔗 Nodes & links carry real code references",
        "📂 Click a reference → open the exact file & line",
        "🧵 Diagram and codebase stay connected",
      ]}
      graph={
        <div style={{ position: "relative", width: 760, height: 520 }}>
          <MiniGraph w={760} h={520} appearDelay={20} highlight="orders" />
          <Cursor
            fromX={600}
            fromY={60}
            toX={400}
            toY={300}
            start={70}
            travel={26}
          />
        </div>
      }
    />
  </Scene>
);

// FEATURE 4 — Diagram types
const SceneFeature4: React.FC = () => (
  <Scene durationInFrames={300}>
    <FeatureLayout
      n="4"
      title="Diagram types"
      color={C.yellow}
      bullets={[
        "🧩 Not just node graphs",
        "🌊 Flowcharts · 🧱 dependency · 🔄 state machines",
        "🏛️ UML class · 🗂️ entity-relationship",
        "🪄 Ask for a type, or let Copilot auto-detect",
      ]}
      graph={<MiniGraph w={760} h={520} appearDelay={20} />}
    />
  </Scene>
);

const FeatureLayout: React.FC<{
  n: string;
  title: string;
  color: string;
  bullets: string[];
  graph: React.ReactNode;
}> = ({ n, title, color, bullets, graph }) => (
  <div
    style={{
      display: "flex",
      gap: 60,
      alignItems: "center",
      width: "100%",
      maxWidth: 1640,
    }}
  >
    <div style={{ flex: 1 }}>
      <SectionLabel n={n} title={title} color={color} />
      <div style={{ height: 36 }} />
      <div style={{ display: "flex", flexDirection: "column", gap: 26 }}>
        {bullets.map((b, i) => (
          <Reveal key={i} delay={24 + i * 16} y={24}>
            <span
              style={{
                fontFamily: FONT,
                fontWeight: 700,
                fontSize: 40,
                color: C.white,
              }}
            >
              {b}
            </span>
          </Reveal>
        ))}
      </div>
    </div>
    <div style={{ flexShrink: 0 }}>{graph}</div>
  </div>
);

const SceneOutro: React.FC = () => (
  <Scene durationInFrames={240}>
    <FloatEmojis items={["🎉", "✨", "🏆", "💜", "🚀"]} count={14} />
    <div style={{ textAlign: "center" }}>
      <Kinetic
        text="SEE your code."
        size={104}
        color={C.cyan}
        delay={6}
        outline={C.ink}
      />
      <Kinetic
        text="don't just read it."
        size={104}
        color={C.yellow}
        delay={20}
        outline={C.ink}
      />
      <div style={{ height: 40 }} />
      <Reveal delay={55}>
        <Pill bg={C.purple} color={C.white}>
          Canvas for Copilot 💜
        </Pill>
      </Reveal>
      <div style={{ height: 24 }} />
      <Reveal delay={70}>
        <span
          style={{
            fontFamily: FONT,
            fontWeight: 700,
            fontSize: 34,
            color: "#aeb6e0",
          }}
        >
          a visual reasoning channel for Copilot CLI · hackathon 2026
        </span>
      </Reveal>
      <div style={{ height: 14 }} />
      <Reveal delay={82}>
        <span
          style={{
            fontFamily: FONT,
            fontWeight: 600,
            fontSize: 20,
            color: "#5a628c",
          }}
        >
          Music: “Evolution” by Bensound.com
        </span>
      </Reveal>
    </div>
  </Scene>
);

/* ================================================================== */
/* REAL SCREEN-RECORDING SHOWCASE                                      */
/* ================================================================== */

/*
 * Drop your VS Code extension screen recordings into `public/clips/` and
 * set their filenames below. While a slot is an empty string ("") the scene
 * renders a labeled placeholder, so the video always builds. Once you add a
 * file, set the matching value (e.g. "clips/clip-visualize.mp4") and re-render.
 */
const CLIP_SOURCES = {
  visualize: "clips/feature-1-diagram-explain-scene-5-demo.mp4",
  expand: "clips/feature-2-diagram-explain-scene-7-demo.mp4",
  search: "clips/feature-3-diagram-explain-scene-9-demo.mp4",
  types: "clips/feature-4-diagram-explain-scene-11-demo.mp4",
};

// A VS Code-style window framing either a real recording or a placeholder
const ScreenClip: React.FC<{
  src: string;
  tab: string;
  caption: string;
  accent: string;
}> = ({ src, tab, caption, accent }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // Window springs in
  const enter = spring({ frame, fps, config: { damping: 14 } });
  // Subtle Ken Burns zoom across the whole clip
  const zoom = interpolate(frame, [0, durationInFrames], [1.0, 1.08], {
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        scale: String(interpolate(enter, [0, 1], [0.92, 1])),
        opacity: enter,
        width: 1360,
        borderRadius: 20,
        overflow: "hidden",
        border: `2px solid ${accent}66`,
        boxShadow: `0 40px 100px rgba(0,0,0,0.6), 0 0 60px ${accent}33`,
        background: "#1e1e1e",
      }}
    >
      {/* VS Code title bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "12px 18px",
          background: "#323233",
        }}
      >
        {[C.pink, C.yellow, C.green].map((c) => (
          <div
            key={c}
            style={{ width: 14, height: 14, borderRadius: 99, background: c }}
          />
        ))}
        <div
          style={{
            marginLeft: 14,
            padding: "8px 20px",
            borderRadius: "10px 10px 0 0",
            background: "#1e1e1e",
            color: "#cfd3e0",
            fontFamily: MONO,
            fontSize: 22,
          }}
        >
          ◧ {tab} — Canvas for Copilot
        </div>
      </div>

      {/* Media area (16:9) */}
      <div
        style={{
          position: "relative",
          width: "100%",
          aspectRatio: "16 / 9",
          background: "#0b0f1c",
          overflow: "hidden",
        }}
      >
        {src ? (
          <AbsoluteFill style={{ scale: String(zoom) }}>
            <OffthreadVideo
              src={staticFile(src)}
              muted
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          </AbsoluteFill>
        ) : (
          <Placeholder accent={accent} tab={tab} />
        )}
      </div>

      {/* Caption strip */}
      <div
        style={{
          padding: "20px 28px",
          background: "#181a26",
          display: "flex",
          alignItems: "center",
          gap: 16,
        }}
      >
        <span
          style={{
            fontFamily: FONT,
            fontWeight: 900,
            fontSize: 26,
            color: C.ink,
            background: accent,
            padding: "6px 18px",
            borderRadius: 999,
          }}
        >
          REAL DEMO 👀
        </span>
        <span
          style={{ fontFamily: FONT, fontWeight: 700, fontSize: 32, color: C.white }}
        >
          {caption}
        </span>
      </div>
    </div>
  );
};

// Placeholder body shown until a real recording is added
const Placeholder: React.FC<{ accent: string; tab: string }> = ({
  accent,
  tab,
}) => {
  const frame = useCurrentFrame();
  const pulse = 0.5 + Math.sin(frame / 12) * 0.25;
  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        gap: 20,
        background:
          "repeating-linear-gradient(45deg, #11152a, #11152a 24px, #151a33 24px, #151a33 48px)",
      }}
    >
      <div style={{ fontSize: 90, opacity: pulse }}>🎬</div>
      <div
        style={{
          fontFamily: FONT,
          fontWeight: 800,
          fontSize: 40,
          color: C.white,
          textAlign: "center",
        }}
      >
        Drop your screen recording here
      </div>
      <div
        style={{
          fontFamily: MONO,
          fontSize: 28,
          color: accent,
          background: "#0b0f1c",
          padding: "10px 22px",
          borderRadius: 12,
          border: `2px dashed ${accent}88`,
        }}
      >
        public/clips/clip-{tab.toLowerCase()}.mp4
      </div>
    </AbsoluteFill>
  );
};

// A clip scene: animated heading + the framed recording/placeholder
const SceneClip: React.FC<{
  src: string;
  tab: string;
  heading: string;
  caption: string;
  accent: string;
  durationInFrames: number;
}> = ({ src, tab, heading, caption, accent, durationInFrames }) => (
  <Scene durationInFrames={durationInFrames}>
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 30,
      }}
    >
      <Reveal>
        <span
          style={{
            fontFamily: FONT,
            fontWeight: 900,
            fontSize: 52,
            color: accent,
          }}
        >
          {heading}
        </span>
      </Reveal>
      <ScreenClip src={src} tab={tab} caption={caption} accent={accent} />
    </div>
  </Scene>
);

/* ================================================================== */
/* ARCHITECTURE SCENE — how it works (MCP)                            */
/* ================================================================== */
const ArchBox: React.FC<{
  icon: string;
  title: string;
  sub: string;
  color: string;
  delay: number;
}> = ({ icon, title, sub, color, delay }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame: frame - delay, fps, config: { damping: 13 } });
  return (
    <div
      style={{
        scale: String(pop),
        opacity: pop,
        width: 340,
        background: "rgba(255,255,255,0.04)",
        border: `2px solid ${color}88`,
        borderRadius: 20,
        padding: "26px 22px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
        boxShadow: `0 16px 50px rgba(0,0,0,0.4), 0 0 40px ${color}22`,
      }}
    >
      <div style={{ fontSize: 60 }}>{icon}</div>
      <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 32, color }}>
        {title}
      </div>
      <div
        style={{
          fontFamily: FONT,
          fontWeight: 600,
          fontSize: 21,
          color: C.white,
          textAlign: "center",
        }}
      >
        {sub}
      </div>
    </div>
  );
};

const ArchArrow: React.FC<{ label: string; color: string; delay: number }> = ({
  label,
  color,
  delay,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const grow = spring({ frame: frame - delay, fps, config: { damping: 16 } });
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        width: 130,
        opacity: grow,
      }}
    >
      <div
        style={{
          fontFamily: MONO,
          fontSize: 16,
          color,
          marginBottom: 6,
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </div>
      <div
        style={{
          width: "100%",
          height: 3,
          background: color,
          transformOrigin: "left",
          transform: `scaleX(${grow})`,
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            right: -2,
            top: -7,
            color,
            fontSize: 26,
            lineHeight: "1px",
          }}
        >
          ▶
        </div>
      </div>
    </div>
  );
};

const SceneArchitecture: React.FC = () => (
  <Scene durationInFrames={240}>
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 46,
      }}
    >
      <Reveal>
        <Pill bg={C.cyan} color={C.ink}>
          🔌 under the hood
        </Pill>
      </Reveal>
      <Reveal delay={8}>
        <span
          style={{ fontFamily: FONT, fontWeight: 900, fontSize: 58, color: C.white }}
        >
          Powered by an <span style={{ color: C.cyan }}>MCP</span> server
        </span>
      </Reveal>

      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <ArchBox
          icon="🧠"
          title="Copilot CLI"
          sub="the brain · VS Code terminal"
          color={C.pink}
          delay={14}
        />
        <ArchArrow label="MCP tools" color={C.cyan} delay={26} />
        <ArchBox
          icon="🔌"
          title="Canvas MCP server"
          sub="runs inside the extension"
          color={C.cyan}
          delay={20}
        />
        <ArchArrow label="diagram" color={C.yellow} delay={32} />
        <ArchBox
          icon="🪟"
          title="Canvas tab"
          sub="Cytoscape webview"
          color={C.purple}
          delay={26}
        />
      </div>

      <Reveal delay={44}>
        <span
          style={{
            fontFamily: FONT,
            fontWeight: 700,
            fontSize: 27,
            color: "#aeb6e0",
            textAlign: "center",
          }}
        >
          ↩ a bidirectional loop — your clicks &amp; selections feed context right
          back to Copilot
        </span>
      </Reveal>
    </div>
  </Scene>
);

/* ================================================================== */
/* ROOT COMPOSITION                                                    */
/* ================================================================== */
export const CanvasForCopilot: React.FC = () => {
  const { durationInFrames } = useVideoConfig();
  return (
    <AbsoluteFill style={{ backgroundColor: C.bg0 }}>
      <Audio
        src={staticFile("music-pro.mp3")}
        loop
        volume={(f) =>
          interpolate(
            f,
            [0, 18, 30, 660, 690, durationInFrames - 30, durationInFrames],
            [0, 0.5, 0.18, 0.18, 0.55, 0.55, 0],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
          )
        }
      />
      {/* Voiceover narration for scenes 1–3 (hook → problem → solution). */}
      <Sequence durationInFrames={660}>
        <Audio src={staticFile("audio/scene-1-scene-2-scene-3.m4a")} />
      </Sequence>
      <Backdrop />

      <Sequence durationInFrames={150}>
        <SceneHook />
      </Sequence>
      <Sequence from={150} durationInFrames={270}>
        <SceneProblem />
      </Sequence>
      <Sequence from={420} durationInFrames={240}>
        <SceneSolution />
      </Sequence>
      <Sequence from={660} durationInFrames={300}>
        <SceneFeature1 />
      </Sequence>
      <Sequence from={960} durationInFrames={300}>
        <SceneFeature2 />
      </Sequence>
      <Sequence from={1260} durationInFrames={300}>
        <SceneFeature3 />
      </Sequence>
      <Sequence from={1560} durationInFrames={300}>
        <SceneFeature4 />
      </Sequence>
      <Sequence from={1860} durationInFrames={240}>
        <SceneOutro />
      </Sequence>
    </AbsoluteFill>
  );
};

/* ================================================================== */
/* NEW SCENES — Download · Future work · Team outro                    */
/* ================================================================== */

// Small numbered step row
const Step: React.FC<{
  n: string;
  text: React.ReactNode;
  color: string;
  delay: number;
}> = ({ n, text, color, delay }) => (
  <Reveal delay={delay} y={26}>
    <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
      <span
        style={{
          fontFamily: FONT,
          fontWeight: 900,
          fontSize: 34,
          color: C.ink,
          background: color,
          width: 60,
          height: 60,
          borderRadius: 14,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {n}
      </span>
      <span
        style={{ fontFamily: FONT, fontWeight: 700, fontSize: 36, color: C.white }}
      >
        {text}
      </span>
    </div>
  </Reveal>
);

const SceneDownload: React.FC = () => (
  <Scene durationInFrames={360}>
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 44,
        width: "100%",
        maxWidth: 1640,
      }}
    >
      <Reveal>
        <span
          style={{ fontFamily: FONT, fontWeight: 900, fontSize: 64, color: C.cyan }}
        >
          Get it in 3 steps 🚀
        </span>
      </Reveal>

      <div
        style={{
          display: "flex",
          gap: 70,
          alignItems: "center",
          width: "100%",
          justifyContent: "center",
        }}
      >
        {/* Steps */}
        <div style={{ display: "flex", flexDirection: "column", gap: 30, flex: 1 }}>
          <Step
            n="1"
            color={C.cyan}
            delay={20}
            text={
              <>
                Install the <b>“Canvas for Copilot”</b> VS Code extension
              </>
            }
          />
          <Step
            n="2"
            color={C.purple}
            delay={38}
            text={<>Add the Canvas MCP server to your Copilot config</>}
          />
          <Step
            n="3"
            color={C.green}
            delay={56}
            text={<>Run Copilot in VS Code&apos;s terminal → ask for a diagram</>}
          />
        </div>

        {/* Marketplace card + config */}
        <Reveal delay={30} style={{ flexShrink: 0 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
            <div
              style={{
                width: 600,
                background: "#252526",
                borderRadius: 16,
                border: "1px solid #3c3c44",
                padding: 26,
                display: "flex",
                gap: 22,
                alignItems: "center",
              }}
            >
              <div
                style={{
                  width: 84,
                  height: 84,
                  borderRadius: 18,
                  background: `linear-gradient(135deg, ${C.cyan}, ${C.purple})`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 44,
                }}
              >
                🎨
              </div>
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontFamily: FONT,
                    fontWeight: 800,
                    fontSize: 30,
                    color: C.white,
                  }}
                >
                  Canvas for Copilot
                </div>
                <div style={{ fontFamily: FONT, fontSize: 22, color: "#9aa0c0" }}>
                  Microsoft · Interns 2026
                </div>
              </div>
              <div
                style={{
                  fontFamily: FONT,
                  fontWeight: 800,
                  fontSize: 24,
                  color: C.white,
                  background: "#0e639c",
                  padding: "12px 26px",
                  borderRadius: 8,
                }}
              >
                Install
              </div>
            </div>

            <div
              style={{
                width: 600,
                background: "#05070f",
                borderRadius: 14,
                border: `1px solid ${C.purple}55`,
                padding: 22,
                fontFamily: MONO,
                fontSize: 20,
                color: "#aeb6e0",
                lineHeight: 1.5,
              }}
            >
              <div style={{ color: "#6b7299" }}>~/.copilot/mcp-config.json</div>
              <div>
                <span style={{ color: C.cyan }}>"canvas"</span>: {"{"} "type":{" "}
                <span style={{ color: C.green }}>"stdio"</span> {"}"}
              </div>
            </div>
          </div>
        </Reveal>
      </div>

      <Reveal delay={70}>
        <Pill bg={C.green} color={C.ink}>
          Runs 100% locally · single VS Code window 🔒
        </Pill>
      </Reveal>
    </div>
  </Scene>
);

const RoadmapCard: React.FC<{
  icon: string;
  title: string;
  sub: string;
  color: string;
  delay: number;
}> = ({ icon, title, sub, color, delay }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame: frame - delay, fps, config: { damping: 13 } });
  // Gentle continuous bob on the icon so each card feels alive once it lands.
  const float = Math.sin((frame - delay) / 12) * 6 * pop;
  return (
    <div
      style={{
        scale: String(pop),
        opacity: pop,
        width: 420,
        background: "rgba(255,255,255,0.04)",
        border: `2px solid ${color}66`,
        borderRadius: 22,
        padding: 36,
        display: "flex",
        flexDirection: "column",
        gap: 14,
        boxShadow: `0 20px 60px rgba(0,0,0,0.4), 0 0 40px ${color}22`,
      }}
    >
      <div
        style={{
          fontSize: 70,
          transform: `translateY(${float}px)`,
          filter: `drop-shadow(0 8px 18px ${color}55)`,
        }}
      >
        {icon}
      </div>
      <div
        style={{ fontFamily: FONT, fontWeight: 900, fontSize: 38, color }}
      >
        {title}
      </div>
      <div
        style={{ fontFamily: FONT, fontWeight: 600, fontSize: 28, color: C.white }}
      >
        {sub}
      </div>
    </div>
  );
};

const SceneFuture: React.FC = () => (
  <Scene durationInFrames={300}>
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 50,
      }}
    >
      <Reveal>
        <span
          style={{
            fontFamily: FONT,
            fontWeight: 900,
            fontSize: 64,
            color: C.white,
          }}
        >
          What&apos;s next 🔮
        </span>
      </Reveal>
      <div style={{ display: "flex", gap: 40 }}>
        <RoadmapCard
          icon="👥"
          title="Collaborate live"
          sub="real-time canvases with your team"
          color={C.cyan}
          delay={18}
        />
        <RoadmapCard
          icon="📊"
          title="Richer figures"
          sub="tables & more complex diagrams"
          color={C.yellow}
          delay={32}
        />
        <RoadmapCard
          icon="💾"
          title="Save to your account"
          sub="your diagrams, saved & synced"
          color={C.purple}
          delay={46}
        />
      </div>
    </div>
  </Scene>
);

// Team avatars. Add photos to public/avatars/ and set `img` to render them.
// `pos` is the CSS object-position so a portrait photo frames the face, not the torso.
const TEAM = [
  { name: "Ashley Torres Perez", initials: "AT", color: C.pink, img: "avatars/ashley.png", pos: "center 14%" },
  { name: "Guillermo Franco Gimeno", initials: "GF", color: C.cyan, img: "avatars/guillermo.png", pos: "center" },
  { name: "Hadwik Payidiparthy", initials: "HP", color: C.yellow, img: "", pos: "center" },
  { name: "Nataliia Kulieshova", initials: "NK", color: C.purple, img: "", pos: "center" },
  { name: "Oleksii Babii", initials: "OB", color: C.green, img: "", pos: "center" },
];

const Avatar: React.FC<{
  member: (typeof TEAM)[number];
  delay: number;
}> = ({ member, delay }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({
    frame: frame - delay,
    fps,
    config: { damping: 11, stiffness: 160 },
  });
  return (
    <div
      style={{
        scale: String(pop),
        opacity: pop,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 14,
        width: 320,
      }}
    >
      <div
        style={{
          width: 250,
          height: 250,
          borderRadius: "50%",
          background: member.img
            ? undefined
            : `linear-gradient(135deg, ${member.color}, ${member.color}99)`,
          border: `8px solid ${member.color}`,
          boxShadow: `0 0 56px ${member.color}66`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        }}
      >
        {member.img ? (
          <Img
            src={staticFile(member.img)}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition: member.pos,
            }}
          />
        ) : (
          <span
            style={{
              fontFamily: FONT,
              fontWeight: 900,
              fontSize: 96,
              color: C.ink,
            }}
          >
            {member.initials}
          </span>
        )}
      </div>
      <span
        style={{
          fontFamily: FONT,
          fontWeight: 700,
          fontSize: 26,
          color: C.white,
          textAlign: "center",
          lineHeight: 1.15,
        }}
      >
        {member.name}
      </span>
    </div>
  );
};

const SceneTeamOutro: React.FC = () => (
  <Scene durationInFrames={300}>
    <FloatEmojis items={["🎉", "✨", "🏆", "💜", "🚀"]} count={12} />
    <div style={{ textAlign: "center" }}>
      <Kinetic text="SEE your code." size={92} color={C.cyan} delay={6} outline={C.ink} />
      <Kinetic
        text="don't just read it."
        size={92}
        color={C.yellow}
        delay={18}
        outline={C.ink}
      />
      <div style={{ height: 30 }} />
      <Reveal delay={42}>
        <span
          style={{
            fontFamily: FONT,
            fontWeight: 700,
            fontSize: 30,
            color: "#aeb6e0",
          }}
        >
          built by 5 SWE interns · 2 Redmond · 2 Dublin · 1 India
        </span>
      </Reveal>
      <div style={{ height: 22 }} />
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 26,
          alignItems: "center",
        }}
      >
        <div style={{ display: "flex", gap: 40, justifyContent: "center" }}>
          {TEAM.slice(0, 3).map((m, i) => (
            <Avatar key={m.name} member={m} delay={55 + i * 8} />
          ))}
        </div>
        <div style={{ display: "flex", gap: 40, justifyContent: "center" }}>
          {TEAM.slice(3).map((m, i) => (
            <Avatar key={m.name} member={m} delay={79 + i * 8} />
          ))}
        </div>
      </div>
      <div style={{ height: 26 }} />
      <Reveal delay={110}>
        <Pill bg={C.purple} color={C.white}>
          Canvas for Copilot 💜
        </Pill>
      </Reveal>
      <div style={{ height: 18 }} />
      <Reveal delay={120}>
        <span
          style={{
            fontFamily: FONT,
            fontWeight: 600,
            fontSize: 20,
            color: "#5a628c",
          }}
        >
          a visual reasoning channel for Copilot CLI · hackathon 2026 · Music:
          “Evolution” by Bensound.com
        </span>
      </Reveal>
    </div>
  </Scene>
);

/* ================================================================== */
/* FULL CUT — animation interleaved with real screen recordings        */
/* ================================================================== */
export const CanvasForCopilotFull: React.FC = () => {
  const { durationInFrames } = useVideoConfig();
  return (
    <AbsoluteFill style={{ backgroundColor: C.bg0 }}>
      <Audio
        src={staticFile("music-pro.mp3")}
        loop
        volume={(f) =>
          interpolate(
            f,
            [0, 18, 30, 690, 720, 3580, 3600, 4520, durationInFrames],
            [0, 0.5, 0.18, 0.18, 0.55, 0.55, 0.18, 0.18, 0],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
          )
        }
      />
      {/* Voiceover narration for scenes 1–3 (hook → problem → solution). */}
      <Sequence durationInFrames={690}>
        <Audio src={staticFile("audio/scene-1-scene-2-scene-3.m4a")} />
      </Sequence>
      {/* Voiceover narration for scenes 12–14 (download → future → outro). */}
      <Sequence from={3591} durationInFrames={960}>
        <Audio src={staticFile("audio/scene-12-scene-13-scene-14.m4a")} />
      </Sequence>
      <Backdrop />

      {/* Cold-open hook → problem → title reveal */}
      <Sequence durationInFrames={180}>
        <SceneHookCold />
      </Sequence>
      <Sequence from={180} durationInFrames={270}>
        <SceneProblem />
      </Sequence>
      <Sequence from={450} durationInFrames={240}>
        <SceneSolution />
      </Sequence>

      {/* How it works — architecture / MCP */}
      <Sequence from={690} durationInFrames={240}>
        <SceneArchitecture />
      </Sequence>

      {/* Feature 1 — Visualize + explain: animated, then real clip */}
      <Sequence from={690} durationInFrames={300}>
        <SceneFeature1 />
      </Sequence>
      <Sequence from={990} durationInFrames={682}>
        <SceneClip
          src={CLIP_SOURCES.visualize}
          tab="Visualize"
          heading="…and here it is for real 👇"
          caption="Copilot draws the graph, then explains any node you click"
          accent={C.cyan}
          durationInFrames={682}
        />
      </Sequence>

      {/* Feature 2 — Expand + undo: animated, then real clip */}
      <Sequence from={1672} durationInFrames={300}>
        <SceneFeature2 />
      </Sequence>
      <Sequence from={1972} durationInFrames={328}>
        <SceneClip
          src={CLIP_SOURCES.expand}
          tab="Expand"
          heading="expand → undo 🪄"
          caption="Grow the diagram in place, then step back with undo"
          accent={C.purple}
          durationInFrames={328}
        />
      </Sequence>

      {/* Feature 3 — Search + code reference: animated, then real clip */}
      <Sequence from={2300} durationInFrames={300}>
        <SceneFeature3 />
      </Sequence>
      <Sequence from={2600} durationInFrames={304}>
        <SceneClip
          src={CLIP_SOURCES.search}
          tab="Search"
          heading="search → jump to code 🤯"
          caption="A node or link opens the exact source file & line"
          accent={C.green}
          durationInFrames={304}
        />
      </Sequence>

      {/* Feature 4 — Diagram types: animated, then real clip */}
      <Sequence from={2904} durationInFrames={300}>
        <SceneFeature4 />
      </Sequence>
      <Sequence from={3204} durationInFrames={387}>
        <SceneClip
          src={CLIP_SOURCES.types}
          tab="Types"
          heading="one canvas, many diagrams 🎛️"
          caption="Flowcharts, state machines, ER — on demand"
          accent={C.yellow}
          durationInFrames={387}
        />
      </Sequence>

      {/* How to download → future work → team outro */}
      <Sequence from={3591} durationInFrames={360}>
        <SceneDownload />
      </Sequence>
      <Sequence from={3951} durationInFrames={300}>
        <SceneFuture />
      </Sequence>
      <Sequence from={4251} durationInFrames={300}>
        <SceneTeamOutro />
      </Sequence>
    </AbsoluteFill>
  );
};
