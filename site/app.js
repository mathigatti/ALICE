const $ = (id) => document.getElementById(id);
const log = $("log"), input = $("input"), send = $("send"), langSel = $("lang");
const store = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  del(k) { try { localStorage.removeItem(k); } catch {} },
};

let worker = null, lang = null, transcript = [], pending = null;

function linkify(el, text) {
  const parts = text.split(/((?:https?:\/\/|www\.)[^\s<>"]+[^\s<>".,!?)])/);
  parts.forEach((p, i) => {
    if (i % 2) {
      const a = document.createElement("a");
      a.href = p.startsWith("http") ? p : "https://" + p;
      a.target = "_blank"; a.rel = "noopener";
      a.textContent = p;
      el.append(a);
    } else el.append(p);
  });
}

function add(who, text, save = true) {
  if (!text) return;
  const el = document.createElement("div");
  el.className = "msg " + who;
  linkify(el, text);
  log.append(el);
  log.scrollTop = log.scrollHeight;
  if (save && who !== "note") { transcript.push([who, text]); store.set(`alice:${lang}:log`, transcript.slice(-200)); }
  return el;
}

function setEnabled(on) { input.disabled = send.disabled = !on; if (on) input.focus(); }

function load(code) {
  lang = code;
  store.set("alice:lang", code);
  document.documentElement.lang = code;
  worker && worker.terminate();
  log.innerHTML = "";
  setEnabled(false);
  const loading = add("note", "Loading…", false);
  transcript = store.get(`alice:${code}:log`) || [];
  const state = store.get(`alice:${code}:state`);
  worker = new Worker("engine.js");
  worker.onmessage = ({ data }) => {
    if (data.type === "ready") {
      loading && loading.remove();
      const ui = data.config.ui || {};
      input.placeholder = ui.placeholder || "";
      send.textContent = ui.send || "Send";
      $("reset").textContent = ui.reset || "Reset";
      $("about").innerHTML = "";
      $("about").append(ui.about || "", " ",
        Object.assign(document.createElement("a"), { href: "https://en.wikipedia.org/wiki/Artificial_Linguistic_Internet_Computer_Entity", target: "_blank", rel: "noopener", textContent: "Wikipedia" }),
        ` · ${data.size.toLocaleString()} categories`);
      store.set(`alice:${code}:state`, data.state);
      if (transcript.length) transcript.forEach(([w, t]) => add(w, t, false));
      else add("bot", data.greeting || "Hello.");
      setEnabled(true);
    } else if (data.type === "reply") {
      pending && pending.remove(); pending = null;
      add("bot", data.reply || "…");
      store.set(`alice:${code}:state`, data.state);
      setEnabled(true);
    } else if (data.type === "error") {
      pending && pending.remove(); pending = null;
      add("note", "Error: " + data.error.split("\n")[0], false);
      console.error(data.error);
      setEnabled(true);
    }
  };
  worker.postMessage({ type: "load", brain: `bots/${code}/brain.json`, config: `bots/${code}/config.json`, state });
  fetch(`bots/${code}/config.json`).then((r) => r.json()).then((c) => {
    if (loading && loading.isConnected) loading.textContent = (c.ui && c.ui.loading) || "Loading…";
  }).catch(() => {});
}

$("form").addEventListener("submit", (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text || input.disabled) return;
  input.value = "";
  add("user", text);
  setEnabled(false);
  pending = add("note", "…", false);
  worker.postMessage({ type: "say", text });
});

$("reset").addEventListener("click", () => {
  store.del(`alice:${lang}:log`); store.del(`alice:${lang}:state`);
  transcript = [];
  log.innerHTML = "";
  setEnabled(false);
  worker.postMessage({ type: "reset" });
});

langSel.addEventListener("change", () => load(langSel.value));

fetch("bots/index.json").then((r) => r.json()).then((langs) => {
  for (const l of langs) langSel.append(new Option(l.label, l.code));
  langSel.hidden = langs.length < 2;
  const saved = store.get("alice:lang");
  const browser = (navigator.language || "en").slice(0, 2);
  const pick = [saved, browser, langs[0].code].find((c) => langs.some((l) => l.code === c));
  langSel.value = pick;
  load(pick);
});
