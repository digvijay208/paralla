import { Suspense, lazy, useEffect, useRef, useState } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import {
  ArrowRight,
  Blocks,
  Download,
  FolderGit2,
  GitCompareArrows,
  Layers,
  Menu,
  MonitorDown,
  Moon,
  Settings2,
  SquareTerminal,
  Sun,
  Users,
  Wallet,
  X,
  Zap,
} from "lucide-react";
import {
  BlurReveal,
  CountUp,
  FaqItem,
  GlowBorder,
  Magnetic,
  Reveal,
  ScrollProgress,
  Spotlight,
  TiltCard,
  WordsReveal,
  useLenis,
} from "./motion-primitives";
const DemoSection = lazy(() => import("./demo").then((m) => ({ default: m.DemoSection })));
const CodeDemo = lazy(() => import("./demo").then((m) => ({ default: m.CodeDemo })));

/* ================= data ================= */

const AGENTS = [
  { name: "OpenCode", cmd: "opencode run", note: "Empty model field = opencode default / Zen free tier." },
  { name: "Claude Code", cmd: "claude -p", note: "Your Claude subscription via CLI, non-interactive flag built in." },
  { name: "Hermes", cmd: "hermes -z", note: "Local hermes config — e.g. mimo-v2.5-free via OpenCode Zen." },
  { name: "Terminal", cmd: "cmd.exe /c", note: "Plain shell in the project dir. No agent, no cost." },
];

const MARQUEE = [
  "OpenCode", "Claude Code", "Hermes", "Terminal", "settings.json",
  "Free-tier first", "Parallel sessions", "Windows",
];

const BENTO = [
  {
    icon: Layers, span: "span7", title: "Parallel sessions, one window",
    body: "Every agent gets its own pane and streams concurrently. Prompt three models at once and watch all three answer — no round-tripping through separate CLI windows.",
    stat: "4", statLabel: "runners, side by side",
  },
  {
    icon: Wallet, span: "span5", title: "Free-tier first, zero API keys",
    body: "Each runner reuses its own CLI login — the same BYOS idea as T3 Code. Nothing to paste, nothing to bill.",
  },
  {
    icon: Settings2, span: "span5", title: "settings.json templates",
    body: "Per-agent argv templates with {prompt} {cwd} {model_args}. Edit live in the ⚙ tab; new sessions pick it up instantly.",
  },
  {
    icon: SquareTerminal, span: "span7", title: "Real PTY terminal built in",
    body: "Full terminals beside your agents — run builds, inspect output and poke the project without leaving the window.",
    stat: "0", statLabel: "context switches",
  },
  {
    icon: FolderGit2, span: "span6", title: "Files, diffs & checkpoints",
    body: "Browse the project tree, read files, review git diffs and restore a checkpoint when an agent goes sideways.",
  },
  {
    icon: Zap, span: "span6", title: "Sessions persist",
    body: "History, status and transcripts are stored server-side and rehydrated on launch. Close the app, keep the work.",
  },
];

const PERSONAS = [
  {
    icon: Zap, who: "Solo builders",
    title: "One brief, three answers",
    body: "Send the same task to OpenCode, Claude Code and Hermes. Keep the best diff, discard the rest — in minutes, not hours.",
    before: "1 prompt → 1 answer → hope",
    after: "1 prompt → 3 answers → pick best",
  },
  {
    icon: GitCompareArrows, who: "Careful reviewers",
    title: "Compare before you commit",
    body: "Every session checkpoints the repo. Review the git diff per agent, restore with one click if an approach goes wrong.",
    before: "agent rewrote main, no undo",
    after: "checkpoint → diff → restore",
  },
  {
    icon: Users, who: "Teams",
    title: "Standardize the fleet",
    body: "One settings.json defines every agent's command, model flags and defaults. Share it and the whole team runs the same harness.",
    before: "everyone wings their CLI flags",
    after: "one settings.json, same runs",
  },
];

const STEPS = [
  { n: "01", title: "Point it at a project", body: "Pick a directory. Paralla probes your PATH and shows which of the four runners are live." },
  { n: "02", title: "Spawn parallel sessions", body: "Choose an agent, optionally override the model, hit + Agent. Each session runs its CLI in your project dir." },
  { n: "03", title: "Prompt & compare", body: "Send one brief everywhere at once. Keep the winning diff, checkpoint-restore the experiments." },
];

const FAQS = [
  {
    q: "Is Paralla really free?",
    a: "Yes. Paralla drives the CLIs you already installed — OpenCode, Claude Code, Hermes — each reusing its own login and free tier. There is no Paralla account, no key to paste, nothing billed through us.",
  },
  {
    q: "What do I need installed?",
    a: "Windows 10/11 and whichever CLIs you want (opencode, claude, hermes) logged in on your PATH. The plain Terminal runner works with nothing extra. Paralla shows a live availability dot per runner so you always know what's ready.",
  },
  {
    q: "How is this different from T3 Code?",
    a: "Same architecture — a server owns provider processes, terminals and project files while the client controls them — but scoped to exactly four runners and free-tier CLI auth, with per-agent command templates in settings.json instead of a provider dashboard.",
  },
  {
    q: "What happens if an agent breaks my code?",
    a: "Each session checkpoints the repo before running. Open the diff panel, review what changed, and restore the checkpoint in one click. Nothing an agent does is irreversible.",
  },
  {
    q: "Can I customize how agents are invoked?",
    a: "Fully. settings.json holds an argv template per agent with {prompt}, {cwd} and {model_args} placeholders plus a model flag. Edit it live in the ⚙ tab — every new session uses the updated template.",
  },
];

const SETTINGS_SNIPPET = `{
  "project_dir": "C:/work/my-app",
  "agents": {
    "opencode": {
      "command": ["opencode", "run", "{prompt}",
                  "{model_args}", "--dir", "{cwd}"],
      "model_flag": "--model"
    },
    "claude": {
      "command": ["claude", "-p", "{prompt}",
                  "{model_args}"],
      "model_flag": "--model"
    }
  }
}`;

/* ================= particle streams canvas ================= */

function StreamsCanvas({ themeRef }: { themeRef: React.MutableRefObject<string> }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reduce = useReducedMotion();
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !canvas.parentElement) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    let w = 0;
    let h = 0;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const mouse = { x: -9999, y: -9999 };
    const parent = canvas.parentElement;
    const onMove = (e: MouseEvent) => {
      const r = canvas.getBoundingClientRect();
      mouse.x = e.clientX - r.left;
      mouse.y = e.clientY - r.top;
    };
    const onLeave = () => {
      mouse.x = -9999;
      mouse.y = -9999;
    };
    parent.addEventListener("mousemove", onMove);
    parent.addEventListener("mouseleave", onLeave);

    type P = { x: number; y: number; vx: number; vy: number; lane: number };
    let pts: P[] = [];
    const seed = () => {
      pts = Array.from({ length: 70 }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        lane: Math.floor(Math.random() * 4),
      }));
    };
    const resize = () => {
      const r = parent.getBoundingClientRect();
      w = r.width;
      h = r.height;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      seed();
    };
    resize();
    window.addEventListener("resize", resize);

    const LANES = ["111,214,255", "140,110,255", "110,255,190", "255,180,120"];
    let t = 0;
    const draw = () => {
      t += 0.016;
      const light = themeRef.current === "light";
      // trail fade instead of clear
      ctx.fillStyle = light ? "rgba(244,246,251,0.18)" : "rgba(9,12,20,0.16)";
      ctx.fillRect(0, 0, w, h);
      for (const p of pts) {
        p.x += p.vx + Math.sin(t + p.y * 0.01) * 0.25;
        p.y += p.vy;
        if (p.x < -20) p.x = w + 20;
        if (p.x > w + 20) p.x = -20;
        if (p.y < -20) p.y = h + 20;
        if (p.y > h + 20) p.y = -20;
        const dx = p.x - mouse.x;
        const dy = p.y - mouse.y;
        const dist = Math.hypot(dx, dy);
        const boost = Math.max(0, 1 - dist / 320);
        const r = 1.1 + boost * 2.4;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${LANES[p.lane]},${light ? 0.5 : 0.75})`;
        ctx.fill();
      }
      // lane links
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          const a = pts[i];
          const b = pts[j];
          if (a.lane !== b.lane) continue;
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d > 130) continue;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.strokeStyle = `rgba(${LANES[a.lane]},${(1 - d / 130) * (light ? 0.16 : 0.28)})`;
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }
      raf = requestAnimationFrame(draw);
    };
    if (reduce) {
      // single static frame
      ctx.fillStyle = themeRef.current === "light" ? "#f4f6fb" : "#090c14";
      ctx.fillRect(0, 0, w, h);
      for (const p of pts) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 1.4, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${LANES[p.lane]},0.6)`;
        ctx.fill();
      }
    } else {
      raf = requestAnimationFrame(draw);
    }
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      parent.removeEventListener("mousemove", onMove);
      parent.removeEventListener("mouseleave", onLeave);
    };
  }, [reduce, themeRef]);
  return <canvas ref={canvasRef} className="streams" aria-hidden />;
}

/* ================= app mock ================= */

const STREAM_LINES = [
  { agent: "opencode", text: "$ opencode run \"add auth middleware\" --dir C:/work/my-app" },
  { agent: "opencode", text: "▸ reading src/middleware… 3 files touched" },
  { agent: "claude", text: "$ claude -p \"add auth middleware\"" },
  { agent: "claude", text: "▸ drafting session guard + tests…" },
  { agent: "hermes", text: "$ hermes -z \"add auth middleware\"" },
  { agent: "hermes", text: "▸ checkpoint saved · streaming diff…" },
];

function AppMock() {
  const boxRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const id = setInterval(() => {
      const el = boxRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    }, 1500);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="mock" aria-hidden>
      <div className="mock-bar">
        <span className="mock-dots"><i /><i /><i /></span>
        <span className="mock-title">paralla — my-app</span>
        <span className="mock-conn" />
      </div>
      <div className="mock-tabs">
        <span className="on">OpenCode #1</span>
        <span className="on">Claude #2</span>
        <span className="on">Hermes #3</span>
        <span>⚙ Settings</span>
      </div>
      <div className="mock-grid">
        {["opencode", "claude", "hermes"].map((a, k) => (
          <div key={a} className="mock-pane">
            <div className="mock-pane-head"><span className={`pulse ${a}`} />{a}</div>
            <div className="mock-lines">
              {[90, 70, 80, 60].map((wd, j) => (
                <div key={j} className="ml" style={{ width: `${wd}%`, animationDelay: `${k * 0.3 + j * 0.4}s` }} />
              ))}
            </div>
          </div>
        ))}
      </div>
      <div ref={boxRef} className="mock-stream">
        {STREAM_LINES.map((l, i) => (
          <motion.p
            key={i}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 + i * 0.45 }}
          >
            <b className={l.agent}>{l.agent}</b> {l.text}
          </motion.p>
        ))}
        <span className="caret">▍</span>
      </div>
    </div>
  );
}

/* ================= page ================= */

export function App() {
  useLenis();
  const [theme, setTheme] = useState(() => localStorage.getItem("paralla-theme") ?? "dark");
  const themeRef = useRef(theme);
  themeRef.current = theme;
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("paralla-theme", theme);
  }, [theme]);

  const [faqOpen, setFaqOpen] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const heroRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const mockY = useTransform(scrollYProgress, [0, 1], [0, -60]);
  const headOpacity = useTransform(scrollYProgress, [0, 0.75], [1, 0]);

  return (
    <>
      <ScrollProgress />
      <div className="blobs" aria-hidden />

      <header className="nav">
        <a className="brand" href="#top"><span className="logo"><img src="/icon.ico" alt="Paralla logo" /></span> paralla</a>
        <nav>
          <a href="#demo">Demo</a>
          <a href="#agents">Agents</a>
          <a href="#features">Features</a>
          <a href="#workflow">Workflow</a>
          <a href="#faq">FAQ</a>
        </nav>
        <div className="nav-right">
          <button
            className="icon-btn menu-btn"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label="Menu"
            aria-expanded={menuOpen}
          >
            {menuOpen ? <X size={16} /> : <Menu size={16} />}
          </button>
          <button
            className="icon-btn"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            aria-label="Toggle theme"
            title="Toggle theme"
          >
            {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <Magnetic>
            <a className="btn small primary" href="#download"><Download size={15} /> Get for Windows</a>
          </Magnetic>
        </div>
        {menuOpen && (
          <div className="mobile-menu">
            {[["Demo", "#demo"], ["Agents", "#agents"], ["Features", "#features"], ["Workflow", "#workflow"], ["FAQ", "#faq"]].map(([label, href]) => (
              <a key={href} href={href} onClick={() => setMenuOpen(false)}>{label}</a>
            ))}
          </div>
        )}
      </header>

      <main id="top">
        {/* ---------- hero ---------- */}
        <section className="hero" ref={heroRef}>
          <div className="hero-panel">
            <StreamsCanvas themeRef={themeRef} />
            <div className="vignette" aria-hidden />
            <motion.div className="hero-inner" style={{ opacity: headOpacity }}>
              <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
              >
                <span className="badge"><span className="badge-dot" /> v0.1 — Windows desktop app</span>
              </motion.div>
              <h1>
                <WordsReveal text="Parallel agents," />
                <br />
                <WordsReveal text="one window." grad />
              </h1>
              <BlurReveal delay={0.35} className="lede-wrap">
                <p className="lede">
                  Paralla runs <b>OpenCode, Claude Code, Hermes</b> and a plain{" "}
                  <b>Terminal</b> side by side in your project — every session
                  streaming in parallel, each on its own free-tier CLI login.
                  No API keys. No tab-switching between CLIs.
                </p>
              </BlurReveal>
              <motion.div
                className="cta-row"
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5, duration: 0.6 }}
              >
                <Magnetic><a className="btn primary" href="#download"><MonitorDown size={17} /> Download for Windows</a></Magnetic>
                <a className="btn ghost" href="#workflow">See how it works <ArrowRight size={16} /></a>
              </motion.div>
            </motion.div>
            <motion.div className="hero-mock" style={{ y: mockY }}>
              <TiltCard><AppMock /></TiltCard>
            </motion.div>
            <div className="hero-stats">
              <div><b><CountUp to={4} /></b><span>runners, parallel</span></div>
              <div><b>0</b><span>API keys needed</span></div>
              <div><b><CountUp to={1} /></b><span>settings.json to rule them</span></div>
            </div>
          </div>
        </section>

        {/* ---------- marquee ---------- */}
        <div className="marquee" aria-hidden>
          <div className="marquee-mask" />
          <div className="marquee-track">
            {[...MARQUEE, ...MARQUEE].map((m, i) => (
              <span key={i} className="mq-item"><i className="mq-dot" />{m}</span>
            ))}
          </div>
        </div>

        {/* ---------- agents ---------- */}
        <div id="demo" style={{ scrollMarginTop: 24 }}>
          <Suspense fallback={<div className="section"><div className="glass-card" style={{ height: 480 }} /></div>}>
            <DemoSection />
            <CodeDemo />
          </Suspense>
        </div>
        <section id="agents" className="section">
          <Reveal>
            <p className="kicker">The four runners</p>
            <h2>Your CLIs, already logged in.</h2>
            <p className="sub">Paralla doesn't re-host models — it drives the tools you installed, reusing each one's own auth. If it's on your PATH, it's live.</p>
          </Reveal>
          <div className="cards four">
            {AGENTS.map((a, i) => (
              <Reveal key={a.name} delay={i * 0.06} className={undefined}>
                <TiltCard>
                  <Spotlight className="card glass-card">
                    <div className="card-head"><span className={`dot ${i < 3 ? "on" : "idle"}`} /><h3>{a.name}</h3></div>
                    <code>{a.cmd}</code>
                    <p>{a.note}</p>
                  </Spotlight>
                </TiltCard>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ---------- bento features ---------- */}
        <section id="features" className="section">
          <Reveal>
            <p className="kicker">Why paralla</p>
            <h2>Built for the parallel workflow.</h2>
            <p className="sub">One brief, three agents, one terminal — compare output in real time instead of round-tripping through separate windows.</p>
          </Reveal>
          <div className="bento">
            {BENTO.map((f, i) => (
              <Reveal key={f.title} delay={(i % 2) * 0.06} className={`bento-item ${f.span}`}>
                <TiltCard>
                  <Spotlight className="card glass-card bento-card">
                    <div>
                      <f.icon size={20} className="fic" />
                      <h3>{f.title}</h3>
                      <p>{f.body}</p>
                    </div>
                    {f.stat && (
                      <div className="bento-stat"><b><CountUp to={Number(f.stat)} /></b><span>{f.statLabel}</span></div>
                    )}
                  </Spotlight>
                </TiltCard>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ---------- stats strip ---------- */}
        <section className="stats-strip">
          {[
            { v: 4, s: "", label: "parallel runners" },
            { v: 3, s: "", label: "CLI agents + terminal" },
            { v: 100, s: "%", label: "free-tier auth" },
            { v: 1, s: "", label: "settings file" },
          ].map((s, i) => (
            <Reveal key={s.label} delay={i * 0.06}>
              <div className="stat"><b><CountUp to={s.v} suffix={s.s} /></b><span>{s.label}</span></div>
            </Reveal>
          ))}
        </section>

        {/* ---------- use cases ---------- */}
        <section className="section">
          <Reveal>
            <p className="kicker">Use cases</p>
            <h2>Who vibes in parallel?</h2>
          </Reveal>
          <div className="cards three">
            {PERSONAS.map((p, i) => (
              <Reveal key={p.title} delay={i * 0.07}>
                <TiltCard>
                  <Spotlight className="card glass-card persona">
                    <span className="who"><p.icon size={13} /> {p.who}</span>
                    <h3>{p.title}</h3>
                    <p>{p.body}</p>
                    <div className="before-after">
                      <span className="before">✕ {p.before}</span>
                      <span className="after">✓ {p.after}</span>
                    </div>
                  </Spotlight>
                </TiltCard>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ---------- workflow ---------- */}
        <section id="workflow" className="section">
          <Reveal>
            <p className="kicker">Workflow</p>
            <h2>From folder to four sessions in a minute.</h2>
          </Reveal>
          <div className="steps">
            {STEPS.map((s, i) => (
              <Reveal key={s.n} delay={i * 0.08}>
                <div className="step glass-card">
                  <span className="step-n">{s.n}</span>
                  <h3>{s.title}</h3>
                  <p>{s.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ---------- settings ---------- */}
        <section id="settings" className="section">
          <div className="split">
            <Reveal>
              <p className="kicker">Custom templates</p>
              <h2>Every agent, your argv.</h2>
              <p className="sub left">
                <code>settings.json</code> holds a command template per agent with{" "}
                <code>{"{prompt}"}</code> <code>{"{cwd}"}</code> <code>{"{model_args}"}</code>{" "}
                placeholders. Edit it live in the ⚙ tab — new sessions pick it up
                immediately. Model override left empty means agent default / free tier.
              </p>
              <div className="mini-row">
                <span className="mini"><Blocks size={14} /> per-agent templates</span>
                <span className="mini"><GitCompareArrows size={14} /> diff + restore</span>
              </div>
            </Reveal>
            <Reveal delay={0.1}>
              <Spotlight className="glass-card code-card">
                <pre className="code"><code>{SETTINGS_SNIPPET}</code></pre>
              </Spotlight>
            </Reveal>
          </div>
        </section>

        {/* ---------- FAQ ---------- */}
        <section id="faq" className="section narrow">
          <Reveal>
            <p className="kicker">FAQ</p>
            <h2>Questions, answered.</h2>
          </Reveal>
          <Reveal delay={0.08}>
            <div className="faq-list">
              {FAQS.map((f, i) => (
                <FaqItem key={f.q} q={f.q} a={f.a} open={faqOpen === i} onToggle={() => setFaqOpen(faqOpen === i ? -1 : i)} />
              ))}
            </div>
          </Reveal>
        </section>

        {/* ---------- final CTA ---------- */}
        <section id="download" className="section narrow">
          <Reveal>
            <GlowBorder>
              <div className="cta-panel glass-card">
                <p className="kicker">Get paralla</p>
                <h2>Free. Windows. Your CLIs.</h2>
                <p className="sub">
                  Install and log in each CLI you want — <code>opencode</code>,{" "}
                  <code>claude</code>, <code>hermes</code> — then launch Paralla and
                  spawn parallel sessions. Terminal works out of the box.
                </p>
                <div className="cta-row center">
                  <Magnetic>
                    <a className="btn primary big" href="#top"><Download size={18} /> Download Paralla Setup (.exe)</a>
                  </Magnetic>
                </div>
                <p className="fine">Requires Windows 10/11 · bundled runtime, no Node needed · no Paralla account, no keys.</p>
              </div>
            </GlowBorder>
          </Reveal>
        </section>
      </main>

      <footer>
        <span className="brand"><span className="logo"><img src="/icon.ico" alt="Paralla logo" /></span> paralla</span>
        <p>Parallel agents, one window — OpenCode · Claude Code · Hermes · Terminal.</p>
        <div className="foot-links">
          <a href="#agents">Agents</a>
          <a href="#features">Features</a>
          <a href="#faq">FAQ</a>
          <a href="#download">Download</a>
        </div>
        <div className="giant-wrap" aria-hidden><span className="giant-word">PARALLA</span></div>
      </footer>
    </>
  );
}
