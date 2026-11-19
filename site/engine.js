// AIML 1.x interpreter (Graphmaster, as described in Wallace's "The Anatomy of A.L.I.C.E.").
// Runs in a Web Worker in the browser; also loadable from Node for tests.

const THAT = "<THAT>", TOPIC = "<TOPIC>";
const MAX_DEPTH = 40;

function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

function compileSubs(pairs) {
  if (!pairs || !pairs.length) return null;
  const map = new Map();
  for (const [a, b] of pairs) if (!map.has(a.toLowerCase())) map.set(a.toLowerCase(), b);
  const keys = [...map.keys()].sort((a, b) => b.length - a.length).map(escapeRe);
  const re = new RegExp(`(?<![\\p{L}\\p{N}'])(?:${keys.join("|")})(?![\\p{L}\\p{N}'])`, "giu");
  return (s) => s.replace(re, (m) => map.get(m.toLowerCase()) ?? m);
}

class Bot {
  constructor(brain, config, state) {
    this.cfg = config;
    this.botProps = config.bot || {};
    this.defaultPred = config.defaultPredicate ?? "";
    this.locale = config.locale || "en-US";
    const subs = config.substitutions || {};
    this.subs = {};
    for (const k of ["normal", "person", "person2", "gender"]) this.subs[k] = compileSubs(subs[k]);
    this.templates = [];
    this.root = { c: new Map(), t: -1 };
    for (const [p, t, tp, tpl] of brain.c) this.add(p, t, tp, tpl);
    this.size = this.templates.length;
    this.reset(state);
  }

  greet() {
    const r = this.cfg.connect ? this.respond(this.cfg.connect, true) : "";
    const g = (this.cfg.ui && this.cfg.ui.greeting) || r;
    if (g) { this.thats.unshift(this.splitResponse(g)); this.responses.unshift(g); }
    return g;
  }

  reset(state) {
    state = state || {};
    this.preds = state.preds || {};
    this.inputs = state.inputs || [];   // most recent first, normalized sentences
    this.thats = state.thats || [];     // most recent first, each = array of sentences
    this.requests = state.requests || [];
    this.responses = state.responses || [];
  }

  state() {
    const cap = (a) => a.slice(0, 20);
    return { preds: this.preds, inputs: cap(this.inputs), thats: cap(this.thats), requests: cap(this.requests), responses: cap(this.responses) };
  }

  add(pattern, that, topic, tpl) {
    const words = [...pattern.split(" "), THAT, ...that.split(" "), TOPIC, ...topic.split(" ")];
    let n = this.root;
    for (const w of words) {
      let m = n.c.get(w);
      if (!m) { m = { c: new Map(), t: -1 }; n.c.set(w, m); }
      n = m;
    }
    if (n.t >= 0) this.templates[n.t] = tpl;
    else { n.t = this.templates.length; this.templates.push(tpl); }
  }

  // --- normalization ---
  fold(s) {
    s = s.toUpperCase();
    if (this.cfg.stripAccents) s = s.normalize("NFD").replace(/\p{Mn}/gu, "");
    return s;
  }

  sentences(text) {
    if (this.subs.normal) text = this.subs.normal(" " + text + " ");
    return text.split(/[.!?;。！？]+/u).map((s) => s.replace(/[^\p{L}\p{N}]+/gu, " ").trim()).filter(Boolean);
  }

  // --- Graphmaster match: priority _ > word > * ---
  match(tokens) {
    const caps = [];
    const rec = (node, i) => {
      if (i === tokens.length) return node.t >= 0 ? node.t : -1;
      const tok = tokens[i];
      const isSep = tok === THAT || tok === TOPIC;
      for (const wc of ["_", null, "*"]) {
        if (wc === null) {
          const m = node.c.get(tok);
          if (m) {
            if (isSep) caps.push(null);
            const r = rec(m, i + 1);
            if (r >= 0) return r;
            if (isSep) caps.pop();
          }
          continue;
        }
        const m = node.c.get(wc);
        if (!m || isSep) continue;
        for (let j = i + 1; j <= tokens.length; j++) {
          if (j > i + 1 && (tokens[j - 1] === THAT || tokens[j - 1] === TOPIC)) break;
          caps.push([i, j]);
          const r = rec(m, j);
          if (r >= 0) return r;
          caps.pop();
        }
      }
      return -1;
    };
    const t = rec(this.root, 0);
    if (t < 0) return null;
    const stars = { input: [], that: [], topic: [] };
    let sec = "input";
    for (const c of caps) {
      if (c === null) { sec = sec === "input" ? "that" : "topic"; continue; }
      stars[sec].push(c);
    }
    return { t, stars };
  }

  respondSentence(words, depth) {
    const thatSent = (this.thats[0] || []).slice(-1)[0] || "";
    const thatW = this.sentencesWords(thatSent);
    const topicW = this.fold(this.getPred("topic")).replace(/[^\p{L}\p{N}*_]+/gu, " ").trim().split(" ").filter(Boolean);
    const inW = words.map((w) => this.fold(w));
    const tokens = [...inW, THAT, ...(thatW.length ? thatW : ["*"]), TOPIC, ...(topicW.length && topicW[0] !== this.fold(this.defaultPred) ? topicW : ["*"])];
    const m = this.match(tokens);
    if (!m) return "";
    const sl = (arr, src) => arr.map(([a, b]) => src.slice(a, b).join(" "));
    const ctx = {
      depth,
      star: sl(m.stars.input, words),
      thatstar: m.stars.that.map(([a, b]) => tokens.slice(a, b).join(" ")),
      topicstar: m.stars.topic.map(([a, b]) => tokens.slice(a, b).join(" ")),
    };
    return this.eval(this.templates[m.t], ctx);
  }

  sentencesWords(s) {
    return s ? this.fold(s).replace(/[^\p{L}\p{N}]+/gu, " ").trim().split(" ").filter(Boolean) : [];
  }

  srai(text, depth) {
    if (depth > MAX_DEPTH) return "";
    return this.sentences(text).map((s) => this.respondSentence(s.split(" "), depth + 1)).join(" ");
  }

  respond(text, hidden = false) {
    const out = [];
    for (const s of this.sentences(text)) {
      const r = clean(this.respondSentence(s.split(" "), 0));
      if (!hidden) this.inputs.unshift(s);
      this.thats.unshift(this.splitResponse(r));
      out.push(r);
    }
    const resp = clean(out.join(" "));
    if (!hidden) { this.requests.unshift(text); this.responses.unshift(resp); }
    return resp;
  }

  splitResponse(r) {
    const s = (this.subs.normal ? this.subs.normal(" " + r + " ") : r).split(/[.!?;]+/u).map((x) => x.trim()).filter(Boolean);
    return s.length ? s : [""];
  }

  getPred(name) {
    const v = this.preds[name];
    return v === undefined || v === "" ? this.defaultPred : v;
  }

  // --- template evaluation ---
  eval(nodes, ctx) {
    let s = "";
    for (const n of nodes) s += typeof n === "string" ? n : this.tag(n, ctx);
    return s;
  }

  idx(a, def = 1) { const v = parseInt(a, 10); return isNaN(v) ? def : v; }

  starOf(list, attrs) { return list[this.idx(attrs && attrs.index) - 1] || ""; }

  sub(kind, s) { const f = this.subs[kind]; return f ? f(" " + s + " ").trim() : s; }

  tag([name, attrs, kids], ctx) {
    attrs = attrs || {};
    const inner = () => this.eval(kids, ctx);
    const innerOrStar = () => (kids.length ? inner() : ctx.star[0] || "");
    switch (name) {
      case "star": return this.starOf(ctx.star, attrs);
      case "thatstar": case "thastar": return this.starOf(ctx.thatstar, attrs);
      case "topicstar": return this.starOf(ctx.topicstar, attrs);
      case "srai": return this.srai(inner(), ctx.depth);
      case "sr": return this.srai(ctx.star[0] || "", ctx.depth);
      case "think": inner(); return "";
      case "set": {
        const v = clean(inner());
        this.preds[attrs.name] = v;
        return v;
      }
      case "get": return this.getPred(attrs.name);
      case "bot": return this.botProps[attrs.name] ?? "";
      case "random": {
        const lis = kids.filter((k) => Array.isArray(k) && k[0] === "li");
        if (!lis.length) return "";
        return this.eval(lis[Math.floor(Math.random() * lis.length)][2], ctx);
      }
      case "condition": return this.condition(attrs, kids, ctx);
      case "person": case "peron": return this.sub("person", innerOrStar());
      case "person2": return this.sub("person2", innerOrStar());
      case "gender": return this.sub("gender", innerOrStar());
      case "uppercase": return inner().toUpperCase();
      case "lowercase": return inner().toLowerCase();
      case "formal": return inner().toLowerCase().replace(/(^|\s)(\p{L})/gu, (m, a, b) => a + b.toUpperCase());
      case "sentence": { const t = inner().trim(); return t.charAt(0).toUpperCase() + t.slice(1); }
      case "that": {
        const [a, b] = (attrs.index || "1,1").split(",").map((x) => this.idx(x));
        const r = this.thats[a - 1] || [];
        return r[r.length - (b || 1)] || "";
      }
      case "input": return this.inputs[this.idx(attrs.index) - 1] || "";
      case "request": return this.requests[this.idx(attrs.index) - 1] || "";
      case "response": return this.responses[this.idx(attrs.index) - 1] || "";
      case "date": return strftime(attrs.format || "%c", new Date(), this.locale);
      case "id": return "web-user";
      case "size": return String(this.size);
      case "version": return this.botProps.version || "web";
      case "br": case "p": return "\n";
      case "img": case "learn": case "eval": case "system": case "javascript": case "gossip": return "";
      case "li": return "\n• " + inner();
      case "ul": case "ol": return inner() + "\n";
      default: return inner(); // em, a, typos, unknown tags
    }
  }

  condMatch(name, value) {
    const v = this.fold(this.getPred(name)).trim();
    const re = new RegExp("^" + this.fold(value).trim().split(/[*_]/).map(escapeRe).join(".+") + "$", "u");
    return re.test(v);
  }

  condition(attrs, kids, ctx) {
    if (attrs.name !== undefined && attrs.value !== undefined)
      return this.condMatch(attrs.name, attrs.value) ? this.eval(kids, ctx) : "";
    const lis = kids.filter((k) => Array.isArray(k) && k[0] === "li");
    for (const [, la, lk] of lis) {
      const a = la || {};
      const name = a.name ?? attrs.name;
      if (a.value === undefined) return this.eval(lk, ctx);
      if (name !== undefined && this.condMatch(name, a.value)) return this.eval(lk, ctx);
    }
    return "";
  }
}

function clean(s) {
  return s.replace(/[ \t]+/g, " ").replace(/ *\n */g, "\n").replace(/ ([,.!?;:])/g, "$1").trim();
}

function strftime(fmt, d, locale) {
  const f = (o) => new Intl.DateTimeFormat(locale, o).format(d);
  const p2 = (n) => String(n).padStart(2, "0");
  const map = {
    A: () => f({ weekday: "long" }), a: () => f({ weekday: "short" }),
    B: () => f({ month: "long" }), b: () => f({ month: "short" }),
    d: () => p2(d.getDate()), m: () => p2(d.getMonth() + 1), Y: () => String(d.getFullYear()), y: () => p2(d.getFullYear() % 100),
    H: () => p2(d.getHours()), I: () => p2(d.getHours() % 12 || 12), M: () => p2(d.getMinutes()), S: () => p2(d.getSeconds()),
    p: () => (d.getHours() < 12 ? "AM" : "PM"),
    x: () => f({ dateStyle: "short" }), X: () => f({ timeStyle: "medium" }), c: () => f({ dateStyle: "full", timeStyle: "short" }),
    Z: () => Intl.DateTimeFormat().resolvedOptions().timeZone, "%": () => "%",
  };
  return fmt.replace(/%(.)/g, (m, c) => (map[c] ? map[c]() : m));
}

if (typeof module !== "undefined") module.exports = { Bot };

if (typeof self !== "undefined" && typeof WorkerGlobalScope !== "undefined") {
  let bot = null;
  self.onmessage = async ({ data }) => {
    try {
      if (data.type === "load") {
        const [brain, config] = await Promise.all([fetch(data.brain).then((r) => r.json()), fetch(data.config).then((r) => r.json())]);
        bot = new Bot(brain, config, data.state);
        const greeting = data.state ? "" : bot.greet();
        self.postMessage({ type: "ready", config, size: bot.size, greeting, state: bot.state() });
      } else if (data.type === "say") {
        const reply = bot.respond(data.text);
        self.postMessage({ type: "reply", id: data.id, reply, state: bot.state() });
      } else if (data.type === "reset") {
        bot.reset();
        const greeting = bot.greet();
        self.postMessage({ type: "ready", config: bot.cfg, size: bot.size, greeting, state: bot.state() });
      }
    } catch (e) {
      self.postMessage({ type: "error", id: data.id, error: String(e && e.stack || e) });
    }
  };
}
