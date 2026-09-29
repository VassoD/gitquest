/* Single dark theme on purpose: GitHub dark with arcade gold. */
export const REPORT_STYLES = `
:root {
  --bg: #0b0f14; --panel: #121820; --panel-2: #18202b; --line: #273140;
  --fg: #e3e9f0; --muted: #8a97a8;
  --g0: #161d26; --g1: #0e4429; --g2: #006d32; --g3: #26a641; --g4: #39d353;
  --gold: #f2b53a; --deleted: #f47067;
  --font-display: "Pixelify Sans", "Courier New", monospace;
  --font-body: "IBM Plex Mono", ui-monospace, "SFMono-Regular", Menlo, monospace;
  color-scheme: dark;
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--fg); font-family: var(--font-body); font-size: 14px; line-height: 1.55; }
.wrap { max-width: 1040px; margin: 0 auto; padding-inline: 20px; padding-block: 28px 64px; display: grid; gap: 28px; }
h1, h2, h3 { font-family: var(--font-display); font-weight: 700; margin: 0; text-wrap: balance; }
h2 { font-size: 22px; display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 12px; }
h2 small { font-family: var(--font-body); font-size: 12px; color: var(--muted); font-weight: 400; }
.label { font-size: 11px; text-transform: uppercase; letter-spacing: .12em; color: var(--muted); }
.panel { background: var(--panel); border: 1px solid var(--line); border-radius: 6px; padding: 20px; }
section, .stack { display: grid; gap: 14px; }
[hidden] { display: none !important; }
.topbar { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; }
.brand { font-family: var(--font-display); font-size: 20px; color: var(--gold); }
.brand span { color: var(--fg); }
.stamp { font-size: 11px; color: var(--muted); }
.sheet { display: grid; grid-template-columns: auto 1fr; gap: 24px; align-items: center; }
.avatar { width: 112px; height: 112px; border-radius: 6px; border: 2px solid var(--gold); background: var(--panel-2); display: block; }
.who { display: grid; gap: 10px; min-width: 0; }
.who h1 { font-size: clamp(28px, 5vw, 44px); line-height: 1; overflow-wrap: anywhere; }
.class { color: var(--gold); font-family: var(--font-display); font-size: 16px; }
.xp { display: grid; gap: 6px; }
.xp-row { display: flex; justify-content: space-between; flex-wrap: wrap; gap: 4px 12px; font-size: 12px; color: var(--muted); font-variant-numeric: tabular-nums; }
.xp-bar { height: 14px; background: var(--g0); border: 1px solid var(--line); border-radius: 3px; overflow: hidden; }
.xp-fill { height: 100%; background: repeating-linear-gradient(90deg, var(--gold) 0 10px, #d99a1f 10px 12px); }
.stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1px; background: var(--line); border: 1px solid var(--line); border-radius: 6px; overflow: hidden; }
.stat { background: var(--panel); padding: 14px 16px; display: grid; gap: 2px; }
.stat b { font-family: var(--font-display); font-size: 24px; font-weight: 500; font-variant-numeric: tabular-nums; }
.add { color: var(--g4); } .del { color: var(--deleted); }
.map { overflow-x: auto; }
.map-grid { display: grid; grid-template-columns: 44px repeat(53, 12px); gap: 3px; min-width: max-content; align-items: center; }
.yr { font-size: 11px; color: var(--muted); font-variant-numeric: tabular-nums; }
.cell { width: 12px; height: 12px; border-radius: 2px; background: var(--g0); }
.l1 { background: var(--g1); } .l2 { background: var(--g2); } .l3 { background: var(--g3); } .l4 { background: var(--g4); }
.boss { background: var(--gold); box-shadow: 0 0 6px var(--gold); }
.legend { display: flex; gap: 16px; flex-wrap: wrap; font-size: 12px; color: var(--muted); }
.legend i { display: inline-block; width: 12px; height: 12px; border-radius: 2px; vertical-align: -2px; margin-right: 6px; }
.ach-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 12px; }
.ach { display: grid; grid-template-columns: 48px 1fr; gap: 12px; align-items: start; padding: 14px; background: var(--panel); border: 1px solid var(--line); border-radius: 6px; transition: transform .15s, border-color .15s; }
.ach:hover { transform: translateY(-2px); border-color: var(--r); }
.ico { width: 48px; height: 48px; border-radius: 4px; display: grid; place-items: center; background: var(--panel-2); border: 2px solid var(--r); }
.ach h3 { font-size: 15px; font-weight: 500; }
.ach p { margin: 2px 0 6px; color: var(--muted); font-size: 12px; }
.meta { display: flex; justify-content: space-between; gap: 8px; font-size: 11px; font-variant-numeric: tabular-nums; }
.rar { color: var(--r); text-transform: uppercase; letter-spacing: .1em; }
.locked { opacity: .55; }
.prog { height: 4px; background: var(--g0); border-radius: 2px; margin-top: 6px; overflow: hidden; }
.prog i { display: block; height: 100%; background: var(--muted); }
.quest { display: grid; grid-template-columns: 70px 1fr; gap: 16px; padding-block: 14px; border-top: 1px solid var(--line); }
.quest:first-child { border-top: 0; padding-top: 0; }
.quest:last-child { padding-bottom: 0; }
.quest .y { font-family: var(--font-display); font-size: 20px; color: var(--gold); }
.quest h3 { font-size: 16px; font-weight: 500; }
.quest p { margin: 4px 0 8px; color: var(--muted); max-width: 65ch; }
.chips { display: flex; flex-wrap: wrap; gap: 6px; }
.chip { font-size: 11px; padding: 2px 8px; border-radius: 99px; border: 1px solid var(--line); background: var(--panel-2); }
.chip.new { border-color: var(--g3); color: var(--g4); }
.tabs { display: flex; gap: 6px; flex-wrap: wrap; }
.tab { font: inherit; font-size: 12px; background: var(--panel-2); color: var(--muted); border: 1px solid var(--line); border-radius: 4px; padding: 6px 12px; cursor: pointer; }
.tab[aria-selected="true"] { color: var(--bg); background: var(--gold); border-color: var(--gold); font-weight: 600; }
.stage { background: #0d1117; border: 1px solid var(--line); border-radius: 6px; padding: 24px 16px; display: grid; place-items: center; overflow-x: auto; }
.stage svg { max-width: 100%; height: auto; }
.code { display: flex; gap: 8px; }
.code pre { flex: 1; min-width: 0; margin: 0; padding: 12px 14px; background: var(--panel-2); border: 1px solid var(--line); border-radius: 4px; overflow-x: auto; font-size: 12px; color: var(--g4); }
.copy { font: inherit; font-size: 12px; font-weight: 600; background: var(--gold); color: var(--bg); border: 0; border-radius: 4px; padding: 0 16px; cursor: pointer; }
.note { font-size: 12px; color: var(--muted); margin: 0; max-width: 75ch; }
button:focus-visible { outline: 2px solid var(--gold); outline-offset: 2px; }
@media (max-width: 720px) {
  .stats { grid-template-columns: repeat(2, 1fr); }
  .sheet, .quest { grid-template-columns: 1fr; }
  .quest { gap: 4px; }
  .code { flex-direction: column; }
  .copy { padding: 10px; }
}
@media (prefers-reduced-motion: reduce) { .ach { transition: none; } }
`;
