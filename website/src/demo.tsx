import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { useReducedMotion } from "motion/react";
import { RotateCcw, Expand, Send } from "lucide-react";
import { Reveal } from "./motion-primitives";

type AgentId = "opencode" | "claude" | "hermes" | "terminal";
type Tab = "agent" | "code" | "chat";

type Step =
  | { kind: "user"; text: string }
  | { kind: "thought"; text: string }
  | { kind: "tool"; icon: "search" | "run" | "draft" | "save"; title: string; detail: string }
  | { kind: "bullets"; items: string[] }
  | { kind: "agent"; text: string }
  | { kind: "term"; cmd: string; out: string };

interface AgentScript {
  id: AgentId;
  name: string;
  powered: string;
  task: string;
  color: string;
  steps: Step[];
  code: string;
}

const BRIEF = "Add rate limiting to the public API. Token bucket, 100 req/min, with tests.";

const SCRIPTS: AgentScript[] = [
  {
    id: "opencode",
    name: "OpenCode",
    powered: "opencode default · free tier",
    task: "Rate-limit middleware",
    color: "#6fd6ff",
    steps: [
      { kind: "user", text: BRIEF },
      { kind: "thought", text: "Thought for 9s" },
      { kind: "tool", icon: "search", title: "Search", detail: "express rate-limit middleware · token_bucket" },
      { kind: "bullets", items: ["412 packages mention token-bucket in README.", "96 updated in the last thirty days.", "41 ship middleware with tests included."] },
      { kind: "tool", icon: "run", title: "Run", detail: "vitest src/middleware --watch=false" },
      { kind: "agent", text: "3 files changed · 14 tests green. Diff is in the Code tab." },
    ],
    code: `+ src/middleware/rateLimit.ts     (token bucket, 100 req/min)
+ src/middleware/rateLimit.test.ts  (14 cases)
~ src/routes/api.ts                 (mounted on /v1/*)`,
  },
  {
    id: "claude",
    name: "Claude Code",
    powered: "Claude subscription via CLI",
    task: "Rate-limit middleware",
    color: "#ff9d6e",
    steps: [
      { kind: "user", text: BRIEF },
      { kind: "thought", text: "Thought for 14s" },
      { kind: "tool", icon: "search", title: "Search", detail: "token bucket vs fixed window · redis_backed" },
      { kind: "bullets", items: ["Fixed window leaks at boundaries.", "Token bucket smooths bursts.", "Redis store keeps it shared across instances."] },
      { kind: "tool", icon: "draft", title: "Draft", detail: "middleware + tests · awaiting approval" },
      { kind: "agent", text: "Draft held at the gateway — approve to apply, or restore the checkpoint." },
    ],
    code: `+ src/middleware/rateLimit.ts     (redis token bucket)
+ src/middleware/rateLimit.test.ts  (11 cases)
  ⏸ awaiting approval — nothing applied yet`,
  },
  {
    id: "hermes",
    name: "Hermes",
    powered: "mimo-v2.5-free via OpenCode Zen",
    task: "Rate-limit middleware",
    color: "#b3a4ff",
    steps: [
      { kind: "user", text: BRIEF },
      { kind: "tool", icon: "save", title: "Checkpoint", detail: "repo snapshot saved · restore anytime" },
      { kind: "tool", icon: "run", title: "Run", detail: "hermes plan --dir C:/work/my-app" },
      { kind: "bullets", items: ["41 lines across 2 files.", "No existing tests touched.", "Rollback is one click."] },
      { kind: "agent", text: "Plan ready — smallest diff of the three. Your call which one ships." },
    ],
    code: `+ src/middleware/rateLimit.ts     (in-memory bucket, 41 lines)
~ src/routes/api.ts                 (mounted on /v1/*)`,
  },
  {
    id: "terminal",
    name: "Terminal",
    powered: "plain shell · no cost",
    task: "Verify the build",
    color: "#6effbe",
    steps: [
      { kind: "term", cmd: "npm run build", out: "built in 4.2s · 0 errors" },
      { kind: "term", cmd: "git status --short", out: "M src/routes/api.ts · ?? src/middleware/" },
      { kind: "term", cmd: "git diff --stat", out: "3 files changed, 156 insertions(+)" },
    ],
    code: `$ git diff --stat\n  3 files changed, 156 insertions(+)`,
  },
];

const MAX_STEPS = Math.max(...SCRIPTS.map((s) => s.steps.length));

function ToolIcon({ icon }: { icon: "search" | "run" | "draft" | "save" }) {
  const glyph = icon === "search" ? "⌕" : icon === "run" ? "▷" : icon === "draft" ? "✎" : "⛨";
  return <span className="tool-ic">{glyph}</span>;
}

function StepsView({ script, upto }: { script: AgentScript; upto: number }) {
  return (
    <div className="demo-flow">
      {script.steps.slice(0, upto).map((st, i) => {
        switch (st.kind) {
          case "user":
            return <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="bubble user">{st.text}</motion.div>;
          case "thought":
            return <div key={i} className="thought">› {st.text}</div>;
          case "tool":
            return (
              <motion.div key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="toolrow" title={st.detail}>
                <span className="tool-left"><ToolIcon icon={st.icon} /> <b>{st.title}</b> <span className="tool-detail">{st.detail}</span></span>
                <span className="tool-check">✓ ›</span>
              </motion.div>
            );
          case "bullets":
            return (
              <ul key={i} className="reslist">
                {st.items.map((b, j) => <motion.li key={j} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>• {b}</motion.li>)}
              </ul>
            );
          case "agent":
            return <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="bubble agent"><span className="who-dot" style={{ background: script.color }} />{st.text}</motion.div>;
          case "term":
            return (
              <div key={i} className="termblock">
                <div className="termcmd"><span className="prompt">$</span> {st.cmd}</div>
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="termout">{st.out}</motion.div>
              </div>
            );
        }
      })}
      {upto < script.steps.length && <span className="caret">▍</span>}
    </div>
  );
}

export function DemoSection() {
  const reduce = useReducedMotion();
  const [tick, setTick] = useState(0);
  const [sel, setSel] = useState<AgentId>("opencode");
  const [tab, setTab] = useState<Tab>("agent");
  const [compare, setCompare] = useState(false);
  const [draft, setDraft] = useState("");
  const [notes, setNotes] = useState<string[]>([]);
  const done = tick >= MAX_STEPS;

  useEffect(() => {
    if (reduce) {
      setTick(MAX_STEPS);
      return;
    }
    setTick(0);
    const id = setInterval(() => setTick((t) => (t >= MAX_STEPS ? t : t + 1)), 1500);
    return () => clearInterval(id);
  }, [reduce]);

  const reset = () => {
    setNotes([]);
    if (reduce) {
      setTick(MAX_STEPS);
      return;
    }
    setTick(0);
  };

  const script = useMemo(() => SCRIPTS.find((s) => s.id === sel)!, [sel]);

  const send = () => {
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    setNotes((n) => [...n, text]);
  };

  const chatMsgs = useMemo(() => {
    const out: { who: string; color: string; text: string }[] = [];
    for (const s of SCRIPTS) {
      for (const st of s.steps.slice(0, tick)) {
        if (st.kind === "user") out.push({ who: "you", color: "#8a93ab", text: st.text });
        if (st.kind === "agent") out.push({ who: s.name, color: s.color, text: st.text });
      }
    }
    return out;
  }, [tick]);

  return (
    <section className="section demo-sec">
      <Reveal>
        <p className="kicker">Interactive demo · sample data</p>
        <h2>One brief, three agents, live.</h2>
        <p className="sub">Scripted with sample data so you can feel the parallel workflow. Pick a runner, switch tabs, hit reset to replay.</p>
      </Reveal>
      <Reveal delay={0.1}>
        <div className="demo-topbar">
          <span className="demo-label"><span className="live-dot" /> Interactive demo <em>· Sample data</em></span>
          <span className="demo-actions">
            <button className="mini-btn" onClick={reset}><RotateCcw size={13} /> Reset</button>
            <button className={`mini-btn${compare ? " on" : ""}`} onClick={() => { setCompare((c) => !c); setTab("agent"); }}><Expand size={13} /> {compare ? "Single" : "Compare"}</button>
          </span>
        </div>
        <div className="demo-win">
          <div className="demo-chrome">
            <span className="mock-dots"><i /><i /><i /></span>
            <span className="demo-title">◫ Paralla — my-app</span>
            <span className="preview-pill">app preview · always dark</span>
            <span className="demo-conn" />
          </div>
          <div className="demo-body">
            <aside className="demo-rail">
              <p className="rail-head">Runners</p>
              {SCRIPTS.map((s) => (
                <button key={s.id} className={`rail-item${sel === s.id && !compare ? " sel" : ""}`} onClick={() => { setSel(s.id); setCompare(false); }}>
                  <span className="rail-dot" style={{ background: s.color }} />
                  <span className="rail-txt"><b>{s.name}</b><i>{tick >= s.steps.length ? "done" : tick > 0 ? "working…" : "queued"}</i></span>
                  {tick > 0 && tick < s.steps.length && <span className="rail-badge">{s.steps.length - tick}</span>}
                </button>
              ))}
              <p className="rail-foot">◫ paralla demo</p>
            </aside>
            <div className="demo-main">
              <div className="demo-agenthead">
                <span className="demo-av" style={{ background: `${script.color}22`, color: script.color }}>◫</span>
                <span><b>{compare ? "All runners" : script.name}</b><i>{compare ? "same brief, side by side" : script.powered}</i></span>
                <span className="demo-tabs">
                  {(["agent", "code", "chat"] as Tab[]).map((t) => (
                    <button key={t} className={tab === t ? "on" : ""} onClick={() => setTab(t)}>{t === "agent" ? "Agent" : t === "code" ? "Code" : "Chat"}</button>
                  ))}
                </span>
              </div>
              {tab === "agent" && !compare && <StepsView script={script} upto={tick} />}
              {tab === "agent" && compare && (
                <div className="compare-grid">
                  {SCRIPTS.filter((s) => s.id !== "terminal").map((s) => (
                    <div key={s.id} className="compare-col">
                      <p className="compare-head"><span className="rail-dot" style={{ background: s.color }} />{s.name}</p>
                      <StepsView script={s} upto={tick} />
                    </div>
                  ))}
                </div>
              )}
              {tab === "code" && (
                <pre className="code demo-code"><code>{tick === 0 ? "…waiting for the runners" : compare ? SCRIPTS.map((s) => `## ${s.name}\n${s.code}`).join("\n\n") : script.code}</code></pre>
              )}
              {tab === "chat" && (
                <div className="demo-flow">
                  {chatMsgs.length === 0 && <p className="muted">…waiting for the runners</p>}
                  {chatMsgs.map((m, i) => (
                    <div key={i} className={`bubble ${m.who === "you" ? "user" : "agent"}`}>
                      <span className="who-dot" style={{ background: m.color }} />{m.who === "you" ? m.text : `${m.who}: ${m.text}`}
                    </div>
                  ))}
                  {notes.map((n, i) => <div key={`n${i}`} className="bubble user">{n}</div>)}
                  {notes.length > 0 && <div className="bubble agent"><span className="who-dot" style={{ background: "#8a93ab" }} />Noted — in the real app that goes straight to the CLI. This demo runs on sample data.</div>}
                </div>
              )}
              <div className="composer">
                <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Ask anything… (demo inbox)" aria-label="Demo message" />
                <button onClick={send} aria-label="Send"><Send size={15} /></button>
              </div>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

/* ================= code-mode demo ================= */

type PaneLine =
  | { kind: "prompt"; text: string }
  | { kind: "op"; icon: "read" | "edit" | "run" | "explore"; text: string }
  | { kind: "result"; text: string }
  | { kind: "summary"; text: string }
  | { kind: "idle"; text: string };

interface CodePane {
  id: string;
  runner: string;
  detail: string;
  color: string;
  lines: PaneLine[];
}

const CODE_PANES: CodePane[] = [
  {
    id: "opencode",
    runner: "opencode",
    detail: "default · free tier",
    color: "#6fd6ff",
    lines: [
      { kind: "prompt", text: "tighten the subscription guard so a cancelled tier cannot read a PRO route" },
      { kind: "op", icon: "read", text: "Read  src/common/guards/subscription.guard.ts" },
      { kind: "op", icon: "edit", text: "Edit  src/common/guards/subscription.guard.ts" },
      { kind: "op", icon: "run", text: "+14 -6  ·  vitest subscription" },
      { kind: "op", icon: "run", text: "Run  npm run test -- subscription" },
      { kind: "result", text: "Tests  18 passed · 0 failed" },
      { kind: "summary", text: "A cancelled subscription now fails closed at the guard instead of at the controller. Regression test added." },
    ],
  },
  {
    id: "claude",
    runner: "claude",
    detail: "sonnet · subscription",
    color: "#ff9d6e",
    lines: [
      { kind: "prompt", text: "write the e2e for the cancelled-tier path" },
      { kind: "op", icon: "explore", text: "Explored  test/auth/cancelled-tier.e2e-spec.ts" },
      { kind: "op", icon: "edit", text: "Edited  test/auth/cancelled-tier.e2e-spec.ts  +41" },
      { kind: "op", icon: "run", text: "Ran  npm run test:e2e -- cancelled-tier" },
      { kind: "result", text: "✓ 3 passed" },
      { kind: "summary", text: "Added the cancelled-tier regression. Runs green." },
    ],
  },
];

const CODE_MAX = Math.max(...CODE_PANES.map((p) => p.lines.length));

const WORKSPACES = [
  { name: "my-app", badge: "3", sessions: ["OpenCode", "Claude Code", "localhost:3000"] },
  { name: "my-app-api", badge: "1", sessions: ["Hermes"] },
  { name: "my-app-web", badge: "", sessions: ["Terminal"] },
];

const OP_GLYPH: Record<string, string> = { read: "●", edit: "●", run: "●", explore: "●" };

function CodePaneView({ pane, project, upto }: { pane: CodePane; project: string; upto: number }) {
  return (
    <div className="codepane">
      <div className="codepane-head">
        <span className="prompt" style={{ color: pane.color }}>›</span>
        <b>{pane.runner}</b>
        <i>{pane.detail} · {project}</i>
      </div>
      <div className="codepane-body">
        {pane.lines.slice(0, upto).map((l, i) => {
          switch (l.kind) {
            case "prompt":
              return <motion.p key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="pline prompt-line"><span className="prompt" style={{ color: pane.color }}>›</span> {l.text}</motion.p>;
            case "op":
              return <motion.p key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="pline op-line"><span className="opdot" style={{ color: pane.color }}>{OP_GLYPH[l.icon]}</span> {l.text}</motion.p>;
            case "result":
              return <motion.p key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="pline res-line">{l.text}</motion.p>;
            case "summary":
              return <motion.p key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="pline sum-line">{l.text}</motion.p>;
            default:
              return null;
          }
        })}
        {upto < pane.lines.length && <span className="caret">▍</span>}
        {upto === 0 && <p className="pline idle-line"><span className="prompt">›</span> Type help to explore</p>}
      </div>
    </div>
  );
}

export function CodeDemo() {
  const reduce = useReducedMotion();
  const [tick, setTick] = useState(0);
  const [ws, setWs] = useState(0);
  const [showBrowser, setShowBrowser] = useState(true);

  useEffect(() => {
    if (reduce) {
      setTick(CODE_MAX);
      return;
    }
    setTick(0);
    const id = setInterval(() => setTick((t) => (t >= CODE_MAX ? t : t + 1)), 1400);
    return () => clearInterval(id);
  }, [reduce]);

  const reset = () => setTick(reduce ? CODE_MAX : 0);
  const project = WORKSPACES[ws].name;

  return (
    <section className="section demo-sec">
      <Reveal>
        <h2 className="left-h">Built for parallel coding.</h2>
        <p className="sub left">You describe the work; the agents in these panes write it. OpenCode, Claude Code, Hermes, Terminal — whatever is on your PATH, launched here and billed through your own accounts.</p>
      </Reveal>
      <Reveal delay={0.1}>
        <div className="demo-topbar">
          <span className="demo-label"><span className="live-dot" /> Interactive demo <em>· Sample data</em></span>
          <span className="demo-actions">
            <button className="mini-btn" onClick={reset}><RotateCcw size={13} /> Reset</button>
            <button className={`mini-btn${showBrowser ? " on" : ""}`} onClick={() => setShowBrowser((s) => !s)}><Expand size={13} /> Preview</button>
          </span>
        </div>
        <div className="demo-win">
          <div className="demo-chrome">
            <span className="mock-dots"><i /><i /><i /></span>
            <span className="demo-title">◫ Paralla — {project}</span>
            <span className="preview-pill">app preview · always dark</span>
            <span className="demo-conn" />
          </div>
          <div className="demo-body code-body">
            <aside className="demo-rail">
              <p className="rail-head">Workspaces</p>
              {WORKSPACES.map((w, i) => (
                <div key={w.name}>
                  <button className={`rail-item${ws === i ? " sel" : ""}`} onClick={() => setWs(i)}>
                    <span className="rail-txt"><b>{w.name}</b></span>
                    {w.badge && <span className="rail-badge">{w.badge}</span>}
                  </button>
                  {ws === i && w.sessions.map((s) => (
                    <p key={s} className="rail-sess"><span className="rail-dot" style={{ background: "#3ddc84" }} />{s}</p>
                  ))}
                </div>
              ))}
              <p className="rail-foot">◫ paralla demo</p>
            </aside>
            <div className="codedemo-grid">
              {CODE_PANES.map((p) => (
                <CodePaneView key={p.id} pane={p} project={project} upto={tick} />
              ))}
              {showBrowser && (
                <div className="browserpane">
                  <div className="browserbar"><span className="browser-url">⌂ localhost:3000</span><span className="live-dot" /></div>
                  <div className="browserpage">
                    <p className="bp-brand">⬦ my-app <span>Acme workspace <i className="bp-avatar">JD</i></span></p>
                    <p className="bp-tabs"><b className="on">Overview</b><b>Activity</b><b>Releases</b></p>
                    <p className="bp-ok">● All systems operational</p>
                    <p className="bp-h">Your next release starts here.</p>
                    <p className="bp-sub">Guard patched · e2e green · preview live.</p>
                    <div className="bp-stats">
                      <div><b>18/18</b><span>unit tests</span></div>
                      <div><b>3/3</b><span>e2e tests</span></div>
                      <div><b>4.2s</b><span>build</span></div>
                    </div>
                    <div className="bp-feed">
                      <p><i style={{ background: "#6fd6ff" }} />opencode edited subscription.guard.ts <span>+14 −6</span></p>
                      <p><i style={{ background: "#ff9d6e" }} />claude added cancelled-tier e2e <span>+41</span></p>
                      <p><i style={{ background: "#3ddc84" }} />main merged to release/0.1.26 <span>✓</span></p>
                    </div>
                    <p className="bp-cta"><span>Open release checklist</span></p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
