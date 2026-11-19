const $ = (id) => document.getElementById(id);
const log = $("log"), input = $("input"), send = $("send"), langSel = $("lang");
const store = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  del(k) { try { localStorage.removeItem(k); } catch {} },
};

let worker = null, lang = null, transcript = [], pending = null;
let currentUI = {}, loadVersion = 0;

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
  const version = ++loadVersion;
  let loaded = false;
  lang = code;
  currentUI = code === "es" ? { loading: "Cargando el cerebro de ALICE…", error: "No se pudo cargar ALICE. Probá cambiar de idioma o recargar la página." } : {};
  store.set("alice:lang", code);
  document.documentElement.lang = code;
  worker && worker.terminate();
  pending = null;
  log.innerHTML = "";
  setEnabled(false);
  $("reset").disabled = true;
  const loading = add("note", currentUI.loading || "Loading…", false);
  transcript = store.get(`alice:${code}:log`) || [];
  const state = store.get(`alice:${code}:state`);
  worker = new Worker("/engine.js");
  worker.onmessage = ({ data }) => {
    if (version !== loadVersion) return;
    if (data.type === "ready") {
      loaded = true;
      loading && loading.remove();
      const ui = currentUI = data.config.ui || {};
      document.title = ui.title || "A.L.I.C.E. · Chat with the original 1995 chatbot";
      if (ui.description) document.querySelector('meta[name="description"]').content = ui.description;
      langSel.setAttribute("aria-label", ui.language || "Language");
      input.setAttribute("aria-label", ui.inputLabel || "Your message");
      input.placeholder = ui.placeholder || "";
      send.textContent = ui.send || "Send";
      $("reset").textContent = ui.reset || "Reset";
      $("reset").disabled = false;
      $("about").innerHTML = "";
      $("about").append(ui.about || "", " ",
        Object.assign(document.createElement("a"), { href: ui.wikipedia || "https://en.wikipedia.org/wiki/Artificial_Linguistic_Internet_Computer_Entity", target: "_blank", rel: "noopener", textContent: "Wikipedia" }),
        ` · ${data.size.toLocaleString(data.config.locale)} ${ui.categories || "categories"}`);
      if (ui.sourcesUrl) $("about").append(" · ", Object.assign(document.createElement("a"), {
        href: ui.sourcesUrl, target: "_blank", rel: "noopener", textContent: ui.sources || "Sources and credits",
      }));
      store.set(`alice:${code}:state`, data.state);
      if (transcript.length) transcript.forEach(([w, t]) => add(w, t, false));
      else add("bot", data.greeting || ui.greeting || "Hello.");
      setEnabled(true);
    } else if (data.type === "reply") {
      pending && pending.remove(); pending = null;
      add("bot", data.reply || "…");
      store.set(`alice:${code}:state`, data.state);
      setEnabled(true);
      $("reset").disabled = false;
    } else if (data.type === "error") {
      pending && pending.remove(); pending = null;
      add("note", currentUI.error || "ALICE could not process this request. Try switching language or reloading the page.", false);
      console.error(data.error);
      if (loaded) { setEnabled(true); $("reset").disabled = false; }
    }
  };
  worker.onerror = (event) => {
    if (version !== loadVersion) return;
    loading && loading.remove();
    pending && pending.remove(); pending = null;
    add("note", currentUI.error || "ALICE could not load. Try switching language or reloading the page.", false);
    console.error(event.message);
  };
  worker.postMessage({ type: "load", brain: `/bots/${code}/brain.json`, config: `/bots/${code}/config.json`, state });
  fetch(`/bots/${code}/config.json`).then((r) => r.json()).then((c) => {
    if (version !== loadVersion) return;
    currentUI = c.ui || {};
    if (loading && loading.isConnected) loading.textContent = currentUI.loading || "Loading…";
  }).catch(() => {});
}

$("form").addEventListener("submit", (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text || input.disabled) return;
  input.value = "";
  add("user", text);
  setEnabled(false);
  $("reset").disabled = true;
  pending = add("note", currentUI.thinking || "…", false);
  worker.postMessage({ type: "say", text });
});

$("reset").addEventListener("click", () => {
  pending && pending.remove(); pending = null;
  store.del(`alice:${lang}:log`); store.del(`alice:${lang}:state`);
  transcript = [];
  log.innerHTML = "";
  setEnabled(false);
  $("reset").disabled = true;
  worker.postMessage({ type: "reset" });
});

langSel.addEventListener("change", () => {
  setEnabled(false);
  window.location.assign(langSel.value === "en" ? "/en/" : "/");
});

fetch("/bots/index.json", { cache: "no-cache" }).then((r) => r.json()).then((langs) => {
  for (const l of langs) langSel.append(new Option(l.label, l.code));
  langSel.hidden = langs.length < 2;
  const saved = store.get("alice:lang");
  const browser = (navigator.language || "en").slice(0, 2);
  const pageLanguage = document.documentElement.dataset.botLanguage;
  const pick = [pageLanguage, saved, browser, langs[0].code].find((c) => langs.some((l) => l.code === c));
  langSel.value = pick;
  load(pick);
});
