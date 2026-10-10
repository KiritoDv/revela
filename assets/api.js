/*
 * Revela · capa de datos
 * Una misma interfaz con dos motores:
 *   - SupabaseStore: producción (datos compartidos, tiempo real)
 *   - DemoStore: guarda en localStorage de este navegador (sin servidor)
 * Las páginas solo hablan con `Revela.api(slug)`.
 */
(function () {
  "use strict";
  const CFG = window.REVELA_CONFIG || {};
  const configured = !!(CFG.SUPABASE_URL && CFG.SUPABASE_ANON_KEY);

  // ---------- identificador anónimo de este dispositivo ----------
  function deviceId() {
    const K = "revela_device";
    let id = null;
    try { id = localStorage.getItem(K); } catch (e) {}
    if (!id) {
      const b = new Uint8Array(16);
      crypto.getRandomValues(b);
      id = "dev-" + Array.from(b, x => x.toString(16).padStart(2, "0")).join("");
      try { localStorage.setItem(K, id); } catch (e) {}
    }
    return id;
  }

  // =================================================================
  //  Supabase
  // =================================================================
  let _client = null;
  function client() {
    if (!_client) {
      if (!window.supabase) throw new Error("No se pudo cargar Supabase. Revisa tu conexión.");
      _client = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY, {
        auth: { persistSession: false, autoRefreshToken: false }
      });
    }
    return _client;
  }
  async function unwrap(p) {
    const { data, error } = await p;
    if (error) throw new Error(friendly(error.message));
    return data;
  }
  function friendly(msg) {
    if (/Failed to fetch|NetworkError/i.test(msg)) return "Sin conexión. Intenta de nuevo.";
    return msg;
  }
  const PRED_COLS = "id,event_id,name,team,birth_guess,message,created_at,updated_at";

  const SupabaseStore = {
    mode: "supabase",
    getEvent: slug => unwrap(client().from("events").select("*").eq("slug", slug).maybeSingle()),
    listPredictions: eventId => unwrap(client().from("predictions").select(PRED_COLS)
      .eq("event_id", eventId).order("created_at", { ascending: false }).limit(1000)),
    listNews: eventId => unwrap(client().from("news").select("*")
      .eq("event_id", eventId).order("created_at", { ascending: false }).limit(200)),
    submitPrediction: (slug, p) => unwrap(client().rpc("submit_prediction", {
      p_slug: slug, p_device: deviceId(), p_name: p.name, p_team: p.team,
      p_birth_guess: p.birth_guess || null, p_message: p.message || null })),
    getMyPrediction: slug => unwrap(client().rpc("get_my_prediction", { p_slug: slug, p_device: deviceId() })),
    createEvent: d => unwrap(client().rpc("create_event", {
      p_baby_name: d.baby_name, p_parents: d.parents, p_due_date: d.due_date,
      p_message: d.message || null, p_photo_data: d.photo_data || null,
      p_email: d.email || null, p_theme: d.theme || "clasico" })),
    subscribe(eventId, onChange) {
      let timer = null;
      const fire = () => { clearTimeout(timer); timer = setTimeout(onChange, 250); };
      const ch = client().channel("evento-" + eventId)
        .on("postgres_changes", { event: "*", schema: "public", table: "events", filter: "id=eq." + eventId }, fire)
        .on("postgres_changes", { event: "*", schema: "public", table: "predictions", filter: "event_id=eq." + eventId }, fire)
        .on("postgres_changes", { event: "*", schema: "public", table: "news", filter: "event_id=eq." + eventId }, fire)
        .subscribe();
      // Respaldo: refresca cada 45 s y al volver a la pestaña
      const poll = setInterval(() => { if (!document.hidden) onChange(); }, 45000);
      const vis = () => { if (!document.hidden) onChange(); };
      document.addEventListener("visibilitychange", vis);
      return () => { client().removeChannel(ch); clearInterval(poll); document.removeEventListener("visibilitychange", vis); };
    },
    admin: {
      check: (s, k) => unwrap(client().rpc("admin_check", { p_slug: s, p_key: k })),
      updateEvent: (s, k, p) => unwrap(client().rpc("admin_update_event", { p_slug: s, p_key: k, p })),
      reveal: (s, k, team) => unwrap(client().rpc("admin_reveal", { p_slug: s, p_key: k, p_team: team })),
      setBirth: (s, k, d) => unwrap(client().rpc("admin_set_birth", { p_slug: s, p_key: k, p_date: d || null })),
      listPredictions: (s, k) => unwrap(client().rpc("admin_list_predictions", { p_slug: s, p_key: k })),
      setHidden: (s, k, id, h) => unwrap(client().rpc("admin_set_hidden", { p_slug: s, p_key: k, p_id: id, p_hidden: h })),
      deletePrediction: (s, k, id) => unwrap(client().rpc("admin_delete_prediction", { p_slug: s, p_key: k, p_id: id })),
      postNews: (s, k, n) => unwrap(client().rpc("admin_post_news", { p_slug: s, p_key: k, p_emoji: n.emoji, p_title: n.title, p_body: n.body })),
      deleteNews: (s, k, id) => unwrap(client().rpc("admin_delete_news", { p_slug: s, p_key: k, p_id: id })),
      deleteEvent: (s, k) => unwrap(client().rpc("admin_delete_event", { p_slug: s, p_key: k }))
    }
  };

  // =================================================================
  //  Demo (localStorage) — mismas reglas que el esquema SQL
  // =================================================================
  const DB_KEY = "revela_demo_db_v1";
  const chan = ("BroadcastChannel" in window) ? new BroadcastChannel("revela-demo") : null;
  const listeners = new Set();

  function uid() { return (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2)); }
  function addDays(iso, n) { const d = new Date(iso + "T12:00:00"); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); }
  function today() { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); }
  function ago(min) { return new Date(Date.now() - min * 60000).toISOString(); }

  function seed() {
    const due = addDays(today(), 92);
    const ev = {
      id: "ev-demo", slug: "demo", baby_name: "Bebé Sol", parents: "Marina & Teo", due_date: due,
      message: "¡No vemos la hora de conocerte! Deja tu predicción, adivina el día que llegará y una notita para nuestro libro de recuerdos.",
      photo_data: null, theme: "clasico", voting_open: true, revealed_team: null, revealed_at: null,
      birth_date: null, created_at: ago(60 * 24 * 6)
    };
    const P = (name, team, off, msg, min) => ({ id: uid(), event_id: ev.id, name, team,
      birth_guess: off === null ? null : addDays(due, off), message: msg, hidden: false, created_at: ago(min), updated_at: ago(min) });
    return {
      events: [ev],
      secrets: { demo: "demo" },
      devices: {},
      predictions: [
        P("Abuela Lu", "nina", -4, "¡El corazón de la abuela dice niña! ❤️", 35),
        P("Tío Nico", "nino", 3, "Esa pancita es 100% equipo niño.", 80),
        P("Bia", "nina", -9, null, 140),
        P("Marcos", "nino", 0, null, 200),
        P("Prima Vale", "gemelos", -14, "¿Y si son dos? 😱 Ya me imagino la ropa doble.", 300),
        P("Don Ernesto", "nino", 6, "Va a ser futbolista, ya patea mucho.", 600),
        P("Sofi", "nina", -2, "Se me antoja un vestidito amarillo 🌻", 900)
      ],
      news: [
        { id: uid(), event_id: ev.id, emoji: "🩺", title: "Todo va de maravilla en la consulta",
          body: "Hoy fue el ultrasonido de las 28 semanas. Bebé Sol está creciendo perfecto y se movió muchísimo. ¡Gracias por todos sus mensajes!", created_at: ago(60 * 26) },
        { id: uid(), event_id: ev.id, emoji: "🎉", title: "La revelación será el sábado",
          body: "Abriremos la página a las 6:00 pm. Dejen su predicción antes, porque cuando suene la campana se cierran los votos.", created_at: ago(60 * 24 * 4) }
      ]
    };
  }
  function load() {
    try { const raw = localStorage.getItem(DB_KEY); if (raw) return JSON.parse(raw); } catch (e) {}
    const s = seed(); save(s, true); return s;
  }
  function save(db, silent) {
    try { localStorage.setItem(DB_KEY, JSON.stringify(db)); }
    catch (e) { throw new Error("El almacenamiento local está lleno (¿una foto muy grande?)."); }
    if (!silent) notify();
  }
  function notify() { listeners.forEach(fn => fn()); if (chan) chan.postMessage("changed"); }
  if (chan) chan.onmessage = () => listeners.forEach(fn => fn());
  window.addEventListener("storage", e => { if (e.key === DB_KEY) listeners.forEach(fn => fn()); });

  const delay = v => new Promise(r => setTimeout(() => r(v), 120));
  const clone = v => JSON.parse(JSON.stringify(v));
  function adminEvent(db, slug, key) {
    const ev = db.events.find(e => e.slug === slug);
    if (!ev || db.secrets[slug] !== key) throw new Error("Llave de anfitrión inválida");
    return ev;
  }
  function slugify(s) {
    return (s || "bebe").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
      .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "bebe";
  }
  function check(cond, msg) { if (!cond) throw new Error(msg); }
  const TEAMS = ["nina", "nino", "gemelos"];

  const DemoStore = {
    mode: "demo",
    async getEvent(slug) { const db = load(); return delay(clone(db.events.find(e => e.slug === slug) || null)); },
    async listPredictions(eventId) {
      const db = load();
      return delay(clone(db.predictions.filter(p => p.event_id === eventId && !p.hidden)
        .sort((a, b) => b.created_at.localeCompare(a.created_at))));
    },
    async listNews(eventId) {
      const db = load();
      return delay(clone(db.news.filter(n => n.event_id === eventId).sort((a, b) => b.created_at.localeCompare(a.created_at))));
    },
    async submitPrediction(slug, p) {
      const db = load(); const ev = db.events.find(e => e.slug === slug);
      check(ev, "Evento no encontrado");
      check(!ev.revealed_team && ev.voting_open, "Las predicciones ya están cerradas");
      check(p.name && p.name.trim().length <= 60, "Escribe tu nombre (máx. 60 caracteres)");
      check(TEAMS.includes(p.team), "Elige un equipo");
      check(!p.message || p.message.length <= 500, "El mensaje es demasiado largo");
      const dev = deviceId(); const now = new Date().toISOString();
      let pred = db.predictions.find(x => x.event_id === ev.id && db.devices[x.id] === dev);
      if (pred) Object.assign(pred, { name: p.name.trim(), team: p.team, birth_guess: p.birth_guess || null, message: (p.message || "").trim() || null, updated_at: now });
      else {
        pred = { id: uid(), event_id: ev.id, name: p.name.trim(), team: p.team, birth_guess: p.birth_guess || null,
          message: (p.message || "").trim() || null, hidden: false, created_at: now, updated_at: now };
        db.predictions.push(pred); db.devices[pred.id] = dev;
      }
      save(db); return delay({ id: pred.id });
    },
    async getMyPrediction(slug) {
      const db = load(); const ev = db.events.find(e => e.slug === slug); if (!ev) return null;
      const dev = deviceId();
      return delay(clone(db.predictions.find(x => x.event_id === ev.id && db.devices[x.id] === dev) || null));
    },
    async createEvent(d) {
      const db = load();
      const slug = slugify(d.baby_name) + "-" + Math.random().toString(16).slice(2, 8);
      const key = Array.from(crypto.getRandomValues(new Uint8Array(18)), x => x.toString(16).padStart(2, "0")).join("");
      db.events.push({ id: uid(), slug, baby_name: d.baby_name.trim(), parents: d.parents.trim(), due_date: d.due_date,
        message: d.message || null, photo_data: d.photo_data || null, theme: d.theme || "clasico", voting_open: true,
        revealed_team: null, revealed_at: null, birth_date: null, created_at: new Date().toISOString() });
      db.secrets[slug] = key; save(db);
      return delay({ slug, admin_key: key });
    },
    subscribe(eventId, onChange) { listeners.add(onChange); return () => listeners.delete(onChange); },
    admin: {
      async check(s, k) { const db = load(); const ev = adminEvent(db, s, k); return delay({ ok: true, event_id: ev.id, email: null }); },
      async updateEvent(s, k, p) {
        const db = load(); const ev = adminEvent(db, s, k);
        ["baby_name", "parents", "due_date", "theme"].forEach(f => { if (p[f]) ev[f] = p[f]; });
        if ("message" in p) ev.message = p.message || null;
        if ("photo_data" in p) ev.photo_data = p.photo_data || null;
        if ("voting_open" in p) ev.voting_open = !!p.voting_open;
        save(db); return delay(null);
      },
      async reveal(s, k, team) { const db = load(); const ev = adminEvent(db, s, k);
        ev.revealed_team = team; ev.revealed_at = team ? new Date().toISOString() : null; save(db); return delay(null); },
      async setBirth(s, k, d) { const db = load(); const ev = adminEvent(db, s, k); ev.birth_date = d || null; save(db); return delay(null); },
      async listPredictions(s, k) { const db = load(); const ev = adminEvent(db, s, k);
        return delay(clone(db.predictions.filter(p => p.event_id === ev.id).sort((a, b) => b.created_at.localeCompare(a.created_at)))); },
      async setHidden(s, k, id, h) { const db = load(); const ev = adminEvent(db, s, k);
        const p = db.predictions.find(x => x.id === id && x.event_id === ev.id); if (p) p.hidden = h; save(db); return delay(null); },
      async deletePrediction(s, k, id) { const db = load(); const ev = adminEvent(db, s, k);
        db.predictions = db.predictions.filter(x => !(x.id === id && x.event_id === ev.id)); save(db); return delay(null); },
      async postNews(s, k, n) { const db = load(); const ev = adminEvent(db, s, k);
        check(n.title && n.title.trim(), "Escribe un título");
        db.news.push({ id: uid(), event_id: ev.id, emoji: n.emoji || null, title: n.title.trim(), body: (n.body || "").trim() || null, created_at: new Date().toISOString() });
        save(db); return delay(null); },
      async deleteNews(s, k, id) { const db = load(); const ev = adminEvent(db, s, k);
        db.news = db.news.filter(x => !(x.id === id && x.event_id === ev.id)); save(db); return delay(null); },
      async deleteEvent(s, k) { const db = load(); const ev = adminEvent(db, s, k);
        db.events = db.events.filter(e => e.id !== ev.id); db.predictions = db.predictions.filter(p => p.event_id !== ev.id);
        db.news = db.news.filter(n => n.event_id !== ev.id); delete db.secrets[s]; save(db); return delay(null); }
    },
    resetDemo() { localStorage.removeItem(DB_KEY); load(); notify(); }
  };

  window.Revela = window.Revela || {};
  window.Revela.configured = configured;
  window.Revela.deviceId = deviceId;
  // El evento "demo" siempre usa el motor demo; el resto usa Supabase si está configurado.
  window.Revela.api = function (slug) { return (!configured || slug === "demo") ? DemoStore : SupabaseStore; };
  window.Revela.isDemo = function (slug) { return !configured || slug === "demo"; };
})();
