// Usage limits of the coding agents on this computer, one line per agent, under the Agents list.
// limits.sh beside this file reads them: Claude's statusline cache, Codex's session logs, the
// OpenCode service's Go allowance and Kiro's /usage. A line is the agent's icon and its windows;
// the icon and numbers are dimmed for agents not running now, and the bars are colored green,
// amber, then red as they fill.
// Resting the pointer on a line opens a card with every window, when it resets and how old the
// numbers are. A server check spins the refresh icon, fades the lines it is asking about, and the
// bars slide to the new numbers.
// The sliders button opens the settings (this mod again, as a popup, with props.settings). They
// live in shared state, so every copy follows them: which agents to show, how to show them,
// colors, and how often to ask the servers. The panel's block is fitted to its lines.

import { View, div, image, svg } from "gpui-kit";
import { v_flex, h_flex, HoverCard, Toggle } from "gpui-base";
import { agents, exec, appHome, theme, layout, props, run, shared, setShared, openOverlay } from "herdr";

const AGENTS = ["claude", "codex", "opencode", "kiro"];
const NAMES = { claude: "Claude", codex: "Codex", opencode: "OpenCode Go", kiro: "Kiro" };
// tint: a one-color glyph drawn in the text color, as the program table marks it.
const ICON = {
  claude: { path: "icons/claude.svg", tint: false },
  codex: { path: "icons/codex.svg", tint: false },
  opencode: { path: "icons/opencode.svg", tint: true },
  kiro: { path: "icons/kiro.svg", tint: false },
};
const KIND = { "claude-code": "claude", claude: "claude", codex: "codex", opencode: "opencode", kiro: "kiro", "kiro-cli": "kiro" };
// Kiro's check starts a session and takes a while; it is asked on its own so the others don't wait.
const SLOW = new Set(["kiro"]);

const KEY = "agent-limits.settings";
const DEFAULTS = {
  agents: { claude: true, codex: true, opencode: true, kiro: true },
  running_only: false,
  remaining: false,
  card: true,
  motion: true,
  colors: true,
  mid: 50,
  high: 80,
  every: 5,
};
function prefs() {
  const s = /** @type {any} */ (shared(KEY)) ?? {};
  return { ...DEFAULTS, ...s, agents: { ...DEFAULTS.agents, ...(s.agents ?? {}) } };
}
const savePrefs = (patch) => setShared(KEY, { ...prefs(), ...patch });

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const ICON_SIZE = 14;
const LABEL_W = 22;
const PCT_W = 30;
const HEAD_H = 41;
const ROW_H = 28;
const CARD = 256;
const CARD_PAD = 14;
const CARD_BAR = CARD - 2 * CARD_PAD - 2;
const SETTINGS_W = 300;
const SETTINGS_H = 600;
// One turn of the refresh icon, in ms.
const SPIN = 900;
const SLIDE = { duration: 700, easing: "ease-out" };
const FADE = { duration: 260, easing: "ease-out" };
const KNOB = { duration: 160, easing: "ease-out" };

const minutes = (w) => w.minutes ?? (w.label.endsWith("h") ? 300 : 10080);
const isShort = (w) => minutes(w) < 1440;
const clamp = (pct) => Math.max(0, Math.min(100, pct));
const fillWidth = (bar, pct) => (pct > 0 ? Math.max(3, (bar * clamp(pct)) / 100) : 0);

function find(node, test) {
  if (node && test(node)) return node;
  for (const child of node?.children ?? []) {
    const found = find(child, test);
    if (found) return found;
  }
  return null;
}

const sidebarWidth = () => find(layout(), (n) => n.id === "sidebar")?.size?.px;
// Same rule as the agents mod: the sidebar is a rail below 160 px.
const narrow = () => (sidebarWidth() ?? Infinity) < 160;

const pad = (n) => String(n).padStart(2, "0");

// 2000 → "2,000", 91.44 → "91.4".
function num(n) {
  const [i, d] = String(Math.round(n * 10) / 10).split(".");
  return i.replace(/\B(?=(\d{3})+(?!\d))/g, ",") + (d ? `.${d}` : "");
}

// "5-hour", "Weekly", "Monthly": what the card calls a window.
function windowName(w) {
  const m = minutes(w);
  if (m < 1440) return `${Math.round(m / 60)}-hour`;
  return { 1440: "Daily", 10080: "Weekly", 43200: "Monthly" }[m] ?? w.label;
}

// "today 14:35", "tomorrow 09:00", "Mon 09:00" within the week, else "Dec 3 15:26".
function at(ts, now) {
  const d = new Date(ts * 1000);
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const day = (x) => Math.floor((x.getTime() - x.getTimezoneOffset() * 60000) / 86400000);
  const days = day(d) - day(new Date(now * 1000));
  if (days <= 0) return `today ${time}`;
  if (days === 1) return `tomorrow ${time}`;
  if (days < 7) return `${DAYS[d.getDay()]} ${time}`;
  return `${MONTHS[d.getMonth()]} ${d.getDate()} ${time}`;
}

// "in 45m", "in 4h 28m", "in 4d 23h".
function until(seconds) {
  const m = Math.max(1, Math.ceil(seconds / 60));
  if (m < 60) return `in ${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return m % 60 ? `in ${h}h ${m % 60}m` : `in ${h}h`;
  const d = Math.floor(h / 24);
  return h % 24 ? `in ${d}d ${h % 24}h` : `in ${d}d`;
}

function ago(seconds) {
  const m = Math.floor(seconds / 60);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`;
}

export default class AgentLimits extends View {
  init(_props, cx) {
    if (props()?.settings) return;
    this.data = {};
    this.applied = {};
    this.pending = new Set();
    this.liveErrors = {};
    this.localError = null;
    this.spinning = false;
    this.spinFrom = 0;
    this.lastLive = 0;
    this.seq = 0;
    this.enabled = null;
    this.fitted = null;
    // Local data shows at once and every 30 s (agents update it as they work); the servers are
    // asked at start, every few minutes as the settings say, and from the refresh button.
    this.refresh(cx);
    this.refresh(cx, true);
    cx.timer.every(30000, (cx) => {
      this.refresh(cx);
      const every = prefs().every;
      if (every > 0 && Date.now() - this.lastLive >= every * 60000 - 5000) this.refresh(cx, true);
    });
  }

  // live: ask the servers first; force: Kiro too, even if it was asked recently (the button).
  refresh(cx, live = false, force = false) {
    const on = AGENTS.filter((a) => prefs().agents[a]);
    const groups = (live ? [on.filter((a) => !SLOW.has(a)), on.filter((a) => SLOW.has(a))] : [on])
      .filter((g) => g.length > 0 && !(live && g.some((a) => this.pending.has(a))));
    if (groups.length === 0) return;
    if (live) {
      this.lastLive = Date.now();
      // A spin still finishing its last turn carries on from where it is.
      if (!this.spinning) {
        this.spinning = true;
        this.spinFrom = Date.now();
      }
      for (const g of groups) {
        g.forEach((a) => this.pending.add(a));
        delete this.liveErrors[g.join(",")];
      }
      cx.notify();
    }
    for (const group of groups) {
      const seq = ++this.seq;
      cx.spawn(async (cx) => {
        let error = null;
        try {
          const args = [`${appHome()}/mods/agent-limits/limits.sh`, "--agents", group.join(",")];
          if (live) args.push("--live");
          if (force) args.push("--force");
          const r = await exec("sh", args);
          if (r.code !== 0) throw new Error(r.stderr.trim() || `limits.sh exited ${r.code}`);
          const got = JSON.parse(r.stdout || "[]");
          for (const a of group) {
            // A server answer is the newest data there is; a local read that started before
            // another applied run must not put older numbers back.
            if (!live && seq <= (this.applied[a] ?? 0)) continue;
            const row = got.find((x) => x.agent === a);
            if (row) this.data[a] = row;
            else delete this.data[a];
            this.applied[a] = Math.max(this.applied[a] ?? 0, seq);
          }
          error = r.stderr.trim() || null;
        } catch (e) {
          error = String(e?.message ?? e);
        }
        if (live) {
          if (error) this.liveErrors[group.join(",")] = error;
          group.forEach((a) => this.pending.delete(a));
          if (this.pending.size === 0) {
            // Stop on a whole turn, so the icon comes to rest upright instead of jumping back.
            const left = SPIN - ((Date.now() - this.spinFrom) % SPIN);
            cx.timer.after(left, (cx) => {
              if (this.pending.size > 0) return;
              this.spinning = false;
              cx.notify();
            });
          }
        } else {
          this.localError = error;
        }
        cx.notify();
      });
    }
  }

  // The panel's block, when the layout gives it a fixed height, is kept just tall enough.
  fit(cx, px) {
    const node = find(layout(), (n) => n.content?.mod === "agent-limits");
    if (!node?.id || node.size?.px == null) return;
    if (Math.round(node.size.px) === px || this.fitted === px) return;
    this.fitted = px;
    cx.timer.after(16, () => run("layout.resize", { id: node.id, px }));
  }

  render(cx) {
    const t = theme();
    if (props()?.settings) return this.settingsView(t);
    const p = prefs();
    const now = Date.now() / 1000;
    const motion = p.motion;
    const running = new Set(agents().map((a) => KIND[a.app] ?? KIND[a.program?.key]).filter(Boolean));

    // An agent turned on gets its numbers at once instead of at the next timed check.
    const enabled = AGENTS.filter((a) => p.agents[a]);
    if (this.enabled && enabled.some((a) => !this.enabled.includes(a))) {
      cx.timer.after(16, (cx) => {
        this.refresh(cx);
        this.refresh(cx, true);
      });
    }
    this.enabled = enabled;

    // Green under mid, amber under high, red from there or once the limit is hit; gray with
    // colors off.
    const tone = (pct, limited, on) =>
      !p.colors ? (on ? t.muted : t.dim) : limited || pct >= p.high ? t.blocked : pct >= p.mid ? t.working : t.ansi2;
    const hot = (w) => w.limited || w.pct >= p.high;
    // What a number shows: used, or what is left.
    const shown = (pct) => (p.remaining ? 100 - clamp(pct) : clamp(pct));

    // A window whose reset time has passed starts again from zero.
    const rows = enabled
      .filter((a) => this.data[a])
      .map((a) => {
        const r = this.data[a];
        return {
          ...r,
          on: running.has(a),
          windows: r.windows.map((w) =>
            w.resets_at != null && w.resets_at <= now ? { ...w, pct: 0, limited: false, past: true } : w),
        };
      })
      .filter((r) => !p.running_only || r.on);
    const problem = [...Object.values(this.liveErrors), this.localError].filter(Boolean).join("\n");
    const empty = enabled.length === 0
      ? "Every agent is off in settings."
      : p.running_only && Object.keys(this.data).length > 0
        ? "No agent with limits is running."
        : "No limit data yet.";

    const pic = (r, full = r.on) => {
      const i = ICON[r.agent];
      if (!i) return div().w(ICON_SIZE).h(ICON_SIZE).flex_none();
      const el = i.tint ? svg(i.path).size(ICON_SIZE).text_color(t.foreground) : image(i.path).w(ICON_SIZE).h(ICON_SIZE);
      return el.flex_none().when(!full, (e) => e.opacity(0.5));
    };
    const slide = (el) => (motion ? el.transition("width", SLIDE) : el);
    // Lines being asked about fade back a little, then return with the new numbers.
    const fading = (el, agent) => el.opacity(this.pending.has(agent) ? 0.5 : 1).when(motion, (e) => e.transition("opacity", FADE));

    // One window in the card: its name and use, a bar, the amount if the server gives one, and
    // when it starts over.
    const meter = (r, w, i) => {
      const c = tone(w.pct, w.limited, true);
      const amount = w.used != null && w.limit != null ? `${num(w.used)} of ${num(w.limit)} ${w.unit ?? ""} used`.trim() : null;
      const reset = w.past
        ? "New window started"
        : w.resets_at == null
          ? null
          : `Resets ${at(w.resets_at, now)} · ${until(w.resets_at - now)}`;
      return v_flex().gap(5)
        .child(h_flex().items_center().justify_between()
          .child(div().text_size(12).text_color(t.muted).child(windowName(w)))
          .child(h_flex().gap(6).items_center()
            .when(Boolean(w.limited), (el) => el.child(div().text_size(11).font_medium().text_color(t.blocked).child("Limit reached")))
            .child(div().text_size(13).font_semibold().child(`${Math.floor(shown(w.pct))}%${p.remaining ? " left" : ""}`))))
        .child(div().w(CARD_BAR).h(6).rounded(3).bg(t.border)
          .child(slide(div().id(`lim-cfill-${r.agent}-${i}`).h_full().w(fillWidth(CARD_BAR, shown(w.pct))).rounded(3).bg(c))))
        .when(amount != null, (el) => el.child(div().text_size(11.5).text_color(t.muted).child(amount)))
        .when(reset != null, (el) => el.child(div().text_size(11.5).text_color(t.dim).child(reset)));
    };

    const card = (r) => {
      const foot = [r.on ? "In use now" : null, r.updated_at ? `Updated ${ago(now - r.updated_at)}` : null]
        .filter(Boolean).join(" · ");
      return v_flex().w(CARD).p(CARD_PAD).gap(12).bg(t.popover).border(1).border_color(t.border).rounded(10).shadow_lg()
        .text_size(12.5).text_color(t.foreground)
        .child(h_flex().items_center().gap(8)
          .child(pic(r, true))
          .child(div().flex_1().min_w(0).truncate().text_size(13).font_semibold().child(r.name))
          .when(Boolean(r.detail), (el) => el.child(div().flex_none().text_size(11.5).text_color(t.dim).child(r.detail))))
        .when(r.unlimited, (el) => el.child(div().text_size(12).text_color(t.muted).child("No usage limit on this plan.")))
        .when(!r.unlimited, (el) => el.child(v_flex().gap(12).children(r.windows.map((w, i) => meter(r, w, i)))))
        .when(Boolean(foot), (el) => el.child(div().pt(10).border_t(1).border_color(t.border).text_size(11).text_color(t.dim).child(foot)));
    };

    // The card opens above the line: the panel sits at the bottom of the sidebar. With the card
    // off, a plain label names the agent and its numbers.
    const withCard = (r, trigger) => {
      trigger = trigger.accessibility_label(r.name);
      if (!p.card) {
        const nums = r.unlimited ? "no limit" : r.windows.map((w) => `${w.label} ${Math.floor(shown(w.pct))}%`).join(" · ");
        return trigger.tooltip(`${r.name} · ${nums}${p.remaining ? " left" : ""}`);
      }
      return HoverCard.new(`lim-card-${r.agent}`)
        .anchor("bottom_left")
        .open_delay(350)
        .close_delay(150)
        .trigger(trigger)
        .content(card(r));
    };

    const header = (el) => el
      .child(h_flex().px(16).h(HEAD_H).pt(14).pb(5).flex_none().items_center().justify_between()
        .child(div().text_size(11.5).font_medium().text_color(t.dim).child("Limits"))
        .child(h_flex().gap(10).items_center()
          .when(Boolean(problem), (el) => el.child(div().id("lim-error").text_size(11).font_semibold().text_color(t.blocked).tooltip(problem).child("!")))
          .child(div()
            .id("lim-settings")
            .text_color(t.dim)
            .hover((s) => s.text_color(t.foreground))
            .on_click(() => openOverlay({ mod: "agent-limits", kind: "popup", width: SETTINGS_W, height: SETTINGS_H, props: { settings: true } }))
            .tooltip("Limits settings")
            .child(svg("mods/agent-limits/sliders.svg").size(14)))
          .child(div()
            .id("lim-refresh")
            .text_color(this.spinning ? t.foreground : t.dim)
            .hover((s) => s.text_color(t.foreground))
            .on_click((_e, cx) => this.refresh(cx, true, true))
            .tooltip("Check usage now")
            .child(svg("mods/agent-limits/refresh.svg").size(14).when(this.spinning && motion, (el) => el.spin(SPIN))))));

    if (narrow()) {
      this.fit(cx, 20 + Math.max(rows.length, 1) * 30 + Math.max(rows.length - 1, 0) * 8);
      return v_flex().size_full().bg(t.chrome).border_t(1).border_color(t.border).pt(10).gap(8).items_center()
        .when(rows.length === 0, (el) => el.child(div().id("lim-empty").text_size(10).text_color(t.dim).tooltip(empty).child("–")))
        .children(rows.map((r) => {
          const top = r.windows.length > 0 ? Math.max(...r.windows.map((w) => w.pct)) : null;
          const lim = r.windows.some((w) => w.limited);
          return withCard(r, fading(v_flex().id(`lim-${r.agent}`).items_center().gap(2), r.agent)
            .child(pic(r))
            .child(div().text_size(10).text_color(t.dim)
              .when(top != null && (lim || top >= p.high), (el) => el.font_semibold())
              .child(top == null ? "–" : `${Math.floor(shown(top))}%`)));
        }));
    }

    this.fit(cx, HEAD_H + Math.max(rows.length, 1) * ROW_H + 8);

    // The line's two slots split what the icon leaves: a short window (under a day, usually 5h)
    // and a long one (7d, 30d), so plans without one still line up; a missing window leaves its
    // slot empty. With more than one long window (OpenCode Go has 7d and 30d) the slot shows the
    // fuller one; the card lists them all.
    // The sidebar's width is in the same units as these sizes (zoom applies to both); the block
    // spans it less the 1 px divider.
    const width = (sidebarWidth() ?? 240) - 1;
    const cellW = Math.max(70, Math.floor((width - 32 - ICON_SIZE - 10 - 12) / 2));
    const barW = cellW - LABEL_W - PCT_W - 10;
    const cell = (w, id, on) => {
      if (!w) return div().w(cellW).flex_none();
      return h_flex().w(cellW).flex_none().gap(5).items_center()
        .child(div().w(LABEL_W).whitespace_nowrap().text_size(11).text_color(t.dim).child(w.label))
        .child(div().w(barW).h(4).rounded(2).bg(t.border)
          .child(slide(div().id(id).h_full().w(fillWidth(barW, shown(w.pct))).rounded(2).bg(tone(w.pct, w.limited, on)))))
        .child(div().w(PCT_W).whitespace_nowrap().text_right().text_size(11.5).text_color(on ? t.muted : t.dim)
          .when(hot(w), (el) => el.font_semibold())
          .child(`${Math.floor(shown(w.pct))}%`));
    };
    const fullest = (ws) => ws.reduce((a, w) => (a == null || w.pct > a.pct ? w : a), null);

    const row = (r) => withCard(r, fading(h_flex().id(`lim-${r.agent}`), r.agent)
      .px(8).h(ROW_H).flex_none().rounded(8).items_center().gap(10)
      .hover((s) => s.bg(t.hover))
      .child(pic(r))
      .when(r.unlimited, (el) => el.child(div().flex_1().text_size(11.5).text_color(t.dim).child("No limit")))
      .when(!r.unlimited, (el) => el.child(h_flex().flex_1().gap(12)
        .child(cell(r.windows.find(isShort), `lim-fill-${r.agent}-short`, r.on))
        .child(cell(fullest(r.windows.filter((w) => !isShort(w))), `lim-fill-${r.agent}-long`, r.on)))));

    return header(v_flex().size_full().min_h(0).bg(t.chrome).border_t(1).border_color(t.border).text_size(12.5))
      .when(rows.length === 0, (el) => el.child(div().px(16).text_size(12).text_color(t.dim).child(empty)))
      .child(v_flex().px(8).children(rows.map(row)));
  }

  // The settings popup. Every change is saved at once in shared state.
  settingsView(t) {
    const p = prefs();
    const motion = p.motion;

    const toggle = (id, on, change, label) => Toggle.new(`set-${id}`)
      .w(30).h(18).flex_none().relative().rounded_full().cursor_pointer()
      .bg(on ? t.accent : t.input)
      .pressed(on)
      .accessibility_label(label)
      .on_change((next) => change(next))
      .child(div().id(`set-${id}-knob`).absolute().top(2).left(on ? 14 : 2).size(14).rounded_full()
        .bg(on ? t.accent_foreground : t.popover).shadow_sm()
        .when(motion, (el) => el.transition("left", KNOB)));

    const title = (text) => div().px(10).pt(12).pb(4).text_size(11).font_medium().text_color(t.dim).child(text);

    const line = (id, label, on, change, { lead = null, hint = null } = {}) => h_flex().min_h(30).py(4).px(10).gap(10).items_center()
      .when(lead != null, (el) => el.child(lead))
      .child(v_flex().flex_1().min_w(0)
        .child(div().text_size(12.5).text_color(t.foreground).child(label))
        .when(hint != null, (el) => el.child(div().text_size(11).text_color(t.dim).child(hint))))
      .child(toggle(id, on, change, label));

    const choice = (id, label, options, value, change, enabled = true) => h_flex().min_h(32).px(10).gap(10).items_center()
      .when(!enabled, (el) => el.opacity(0.45))
      .child(div().flex_1().min_w(0).text_size(12.5).text_color(t.foreground).child(label))
      .child(h_flex().flex_none().p(2).gap(2).rounded(7).bg(t.hover).children(options.map(([v, text]) => {
        const picked = v === value;
        return h_flex().id(`set-${id}-${v}`).h(22).px(8).items_center().rounded(5).text_size(11.5)
          .text_color(picked ? t.foreground : t.muted)
          .when(picked, (el) => el.bg(t.popover).border(1).border_color(t.border).font_medium())
          .when(!picked && enabled, (el) => el.cursor_pointer().hover((s) => s.text_color(t.foreground)).on_click(() => change(v)))
          .child(text);
      })));

    const icon = (a) => {
      const i = ICON[a];
      return i.tint ? svg(i.path).size(ICON_SIZE).flex_none().text_color(t.foreground) : image(i.path).w(ICON_SIZE).h(ICON_SIZE).flex_none();
    };
    const MIDS = [40, 50, 60, 70];
    const HIGHS = [70, 80, 90, 95];

    return v_flex().id("set-root").size_full().bg(t.popover).p(4).pb(8).text_size(12.5).overflow_y_scrollbar()
      .child(div().px(10).pt(6).text_size(13).font_semibold().text_color(t.foreground).child("Limits"))

      .child(title("Agents"))
      .children(AGENTS.map((a) => line(`agent-${a}`, NAMES[a], p.agents[a],
        (on) => savePrefs({ agents: { ...p.agents, [a]: on } }),
        { lead: icon(a), hint: a === "kiro" ? "Checked every 15 min; ↻ asks now" : null })))

      .child(title("Display"))
      .child(line("running", "Only agents running now", p.running_only, (on) => savePrefs({ running_only: on })))
      .child(line("remaining", "Show what's left, not what's used", p.remaining, (on) => savePrefs({ remaining: on })))
      .child(line("card", "Details card on hover", p.card, (on) => savePrefs({ card: on })))
      .child(line("motion", "Animations", p.motion, (on) => savePrefs({ motion: on })))

      .child(title("Colors"))
      .child(line("colors", "Color bars by use", p.colors, (on) => savePrefs({ colors: on })))
      .child(choice("mid", "Amber from", MIDS.map((v) => [v, `${v}%`]), p.mid,
        (v) => savePrefs({ mid: v, high: p.high > v ? p.high : HIGHS.find((h) => h > v) }), p.colors))
      .child(choice("high", "Red from", HIGHS.map((v) => [v, `${v}%`]), p.high,
        (v) => savePrefs({ high: v, mid: p.mid < v ? p.mid : [...MIDS].reverse().find((m) => m < v) }), p.colors))

      .child(title("Refresh"))
      .child(choice("every", "Check servers", [[0, "Off"], [5, "5m"], [15, "15m"], [30, "30m"]], p.every,
        (v) => savePrefs({ every: v })))

      .child(h_flex().px(10).pt(12).justify_end()
        .child(div().id("set-reset").text_size(11.5).text_color(t.muted).cursor_pointer()
          .hover((s) => s.text_color(t.foreground))
          .on_click(() => setShared(KEY, null))
          .child("Reset to defaults")));
  }
}
