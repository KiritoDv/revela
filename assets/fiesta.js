/* Revela · página de invitados */
(function () {
  "use strict";
  const R = window.Revela;
  const { h, $, TEAMS } = R;
  const slug = R.param("e") || "demo";
  const api = R.api(slug);
  const app = $("#app");
  const S = { ev: null, preds: [], news: [], mine: null, showAll: false, formKey: null };
  const LS = k => "revela_" + k + "_" + slug;
  const lsGet = k => { try { return localStorage.getItem(LS(k)); } catch (e) { return null; } };
  const lsSet = (k, v) => { try { localStorage.setItem(LS(k), v); } catch (e) {} };

  $("#brand").textContent = (window.REVELA_CONFIG || {}).BRAND || "Revela";
  const banner = R.demoBanner(slug); if (banner) $("#demo").append(banner);
  $("#footer").append(R.brandFooter());

  // ---------- secciones (se crean una vez, se actualizan en cada render) ----------
  const el = {
    hero: h("section", { class: "hero", "aria-live": "polite" }),
    left: h("div", { class: "stack" }),
    right: h("div", { class: "stack" }),
    vote: h("section", { class: "card", id: "votar" }),
    voteBody: h("div"),
    news: h("section", { class: "card", id: "noticias" }),
    results: h("section", { class: "card", id: "resultados" }),
    dates: h("section", { class: "card", id: "fechas" }),
    recent: h("section", { class: "card", id: "muro" })
  };
  el.vote.append(h("div", { class: "card-head" }, h("h2", { class: "display", text: "Deja tu predicción" })), el.voteBody);

  async function load() {
    try {
      const ev = await api.getEvent(slug);
      if (!ev) return notFound();
      S.ev = ev;
      const [preds, news, mine] = await Promise.all([api.listPredictions(ev.id), api.listNews(ev.id), api.getMyPrediction(slug)]);
      S.preds = preds || []; S.news = news || []; S.mine = mine || null;
      render();
    } catch (e) {
      app.textContent = "";
      app.append(h("div", { class: "card" }, h("h2", { text: "No pudimos cargar la página" }), h("p", { class: "muted", text: e.message })));
    }
  }

  function notFound() {
    document.title = "Página no encontrada";
    app.textContent = "";
    app.append(h("div", { class: "card", style: { textAlign: "center" } },
      h("h2", { class: "display", text: "No encontramos esta revelación" }),
      h("p", { class: "muted", text: "Revisa que el enlace esté completo o pide a los papás que te lo envíen de nuevo." }),
      h("a", { class: "btn primary", href: "fiesta.html?e=demo", text: "Ver la demo" })));
  }

  // ---------------------------------------------------------------- render
  function render() {
    const ev = S.ev;
    document.documentElement.dataset.theme = ev.theme || "clasico";
    if (ev.revealed_team) document.documentElement.dataset.revealed = ev.revealed_team;
    else delete document.documentElement.dataset.revealed;
    document.title = ev.baby_name + " · " + (ev.revealed_team ? TEAMS[ev.revealed_team].reveal : "¿Niño o niña?");

    if (!app.contains(el.hero)) {
      app.textContent = "";
      app.append(el.hero, h("div", { class: "grid two" }, el.left, el.right));
    }
    renderHero(); renderVote(); renderNews(); renderResults(); renderDates(); renderRecent();

    // Invitados que regresan: noticias primero
    el.left.textContent = "";
    if (S.mine) el.left.append(el.news, el.vote); else el.left.append(el.vote, el.news);
    el.right.textContent = "";
    el.right.append(el.results, el.dates, el.recent);

    maybeShowReveal();
  }

  function renderHero() {
    const ev = S.ev; const x = el.hero; x.textContent = "";
    x.append(ev.photo_data ? h("img", { class: "photo", src: ev.photo_data, alt: "Foto de " + ev.baby_name })
                           : h("div", { class: "photo placeholder", "aria-hidden": "true", text: "🍼" }));
    x.append(h("div", { class: "eyebrow", text: "Bebé destacado" }),
      h("h1", { text: ev.baby_name }),
      h("div", { class: "meta" },
        h("span", null, "Fecha de parto · ", h("b", { text: R.fmtDate(ev.due_date) })),
        h("span", null, "Padres: ", h("b", { text: ev.parents }))));
    if (ev.birth_date) {
      x.append(h("div", { class: "countdown" }, "🎂 Nació el ", h("b", { text: R.fmtDate(ev.birth_date, { day: "numeric", month: "long" }) })));
    } else {
      const d = R.daysBetween(R.todayISO(), ev.due_date);
      x.append(h("div", { class: "countdown" }, d > 1 ? ["Faltan ", h("b", { text: String(d) }), " días"]
        : d === 1 ? ["¡Falta ", h("b", { text: "1" }), " día!"] : ["¡Ya ", h("b", { text: "casi" }), " llega!"]));
    }
    if (ev.message) x.append(h("blockquote", { class: "quote" }, h("span", { text: "“" + ev.message + "”" }), h("cite", { text: "— " + ev.parents })));
    if (ev.revealed_team) x.append(h("div", { class: "revealed-banner", text: TEAMS[ev.revealed_team].reveal + " " + TEAMS[ev.revealed_team].icon }));
    x.append(h("div", { class: "hero-actions" },
      h("button", { class: "btn primary", type: "button", text: "Compartir", onclick: () => R.share(R.guestUrl(slug), ev.baby_name) }),
      !ev.birth_date ? h("button", { class: "btn ghost", type: "button", text: "📅 Agregar al calendario", onclick: () => R.downloadICS(ev) }) : null,
      h("a", { class: "btn ghost", href: "#noticias", text: "Noticias" })));
  }

  function renderVote() {
    const ev = S.ev;
    const key = [ev.revealed_team, ev.voting_open, ev.due_date, !!S.mine].join("|");
    if (key !== S.formKey) {
      S.formKey = key;
      el.voteBody.textContent = "";
      el.voteBody.append(R.predictionForm({ slug, ev, mine: S.mine, onSaved: m => { S.mine = m; S.formKey = [ev.revealed_team, ev.voting_open, ev.due_date, true].join("|"); refresh(); } }));
    }
  }

  function renderNews() {
    const x = el.news; x.textContent = "";
    const seen = lsGet("news_seen") || "";
    const fresh = S.news.filter(n => n.created_at > seen).length;
    x.append(h("div", { class: "card-head" },
      h("h2", { class: "display" }, "Noticias de la familia", fresh && seen ? h("span", { class: "dot-count", style: { marginLeft: "8px" }, text: String(fresh) }) : null),
      h("span", { class: "small faint", text: S.news.length ? S.news.length + (S.news.length === 1 ? " publicación" : " publicaciones") : "" })));
    if (!S.news.length) {
      x.append(h("div", { class: "empty" }, "Aún no hay noticias.", h("br"), "Vuelve pronto: aquí los papás compartirán novedades."));
    } else {
      x.append(h("div", { class: "news" }, S.news.map(n => h("article", null,
        h("div", { class: "emo", "aria-hidden": "true", text: n.emoji || "💌" }),
        h("h3", null, n.title, seen && n.created_at > seen ? h("span", { class: "badge-new", text: "NUEVO" }) : null),
        h("time", { datetime: n.created_at, text: R.timeAgo(n.created_at) }),
        n.body ? h("p", { text: n.body }) : null))));
    }
    // Marca como vistas tras unos segundos en la página
    if (S.news.length) {
      const newest = S.news[0].created_at;
      clearTimeout(renderNews._t);
      renderNews._t = setTimeout(() => { if (!seen || newest > seen) lsSet("news_seen", newest); }, 6000);
      if (!seen) lsSet("news_seen", newest);
    }
  }

  function renderResults() {
    const ev = S.ev; const st = R.stats(S.preds, ev); const x = el.results; x.textContent = "";
    x.append(h("div", { class: "card-head" }, h("h2", { class: "display", text: "Predicciones actuales" }),
      h("span", { class: "small muted", text: st.total + (st.total === 1 ? " voto" : " votos") })));
    x.append(h("div", { class: "split", "aria-hidden": "true" }, ["nina", "nino", "gemelos"].map(k =>
      h("span", { style: { flexGrow: String(st.counts[k] || (st.total ? 0 : 1)), background: `var(--${k})`, opacity: st.total ? "1" : ".25" } }))));
    x.append(h("div", { class: "bars" }, Object.values(TEAMS).map(t => h("div", null,
      h("div", { class: "bar-top" },
        h("span", null, t.icon + " " + t.label, ev.revealed_team === t.key ? h("span", { class: "winner-tag", text: "Ganador" }) : null),
        h("b", { text: st.pct(t.key) + "% (" + st.counts[t.key] + ")" })),
      h("div", { class: "bar " + t.key, role: "progressbar", "aria-label": t.label, "aria-valuenow": String(st.pct(t.key)), "aria-valuemin": "0", "aria-valuemax": "100" },
        h("span", { style: { width: st.pct(t.key) + "%" } }))))));
    if (ev.revealed_team && st.total) {
      x.append(h("p", { class: "muted small", style: { marginTop: "14px" },
        text: st.correct + " de " + st.total + " invitados acertaron (" + st.pct(ev.revealed_team) + "%)." }));
    }
  }

  function renderDates() {
    const ev = S.ev; const st = R.stats(S.preds, ev); const x = el.dates; x.textContent = "";
    x.append(h("div", { class: "card-head" }, h("h2", { class: "display", text: "¿Cuándo llega?" }),
      h("span", { class: "small muted", text: st.guesses.length + (st.guesses.length === 1 ? " apuesta" : " apuestas") })));
    if (!st.guesses.length) { x.append(h("div", { class: "empty", text: "Nadie ha apostado una fecha todavía. ¡Sé el primero!" })); return; }
    x.append(h("div", { class: "date-stats" },
      h("div", { class: "date-stat" }, h("div", { class: "v", text: R.fmtShort(st.earliest) }), h("div", { class: "k", text: "La más temprana" })),
      h("div", { class: "date-stat" }, h("div", { class: "v", text: R.fmtShort(st.popular[0]) }), h("div", { class: "k", text: "Favorita (" + st.popular[1] + ")" })),
      h("div", { class: "date-stat" }, h("div", { class: "v", text: R.fmtShort(st.latest) }), h("div", { class: "k", text: "La más tardía" }))));

    // Histograma alrededor de la fecha de parto
    const start = st.earliest < R.addDays(ev.due_date, -21) ? st.earliest : R.addDays(ev.due_date, -21);
    const end = st.latest > R.addDays(ev.due_date, 14) ? st.latest : R.addDays(ev.due_date, 14);
    const span = R.daysBetween(start, end) + 1; const bins = Math.min(24, span); const per = span / bins;
    const counts = new Array(bins).fill(0);
    st.guesses.forEach(g => counts[Math.min(bins - 1, Math.floor(R.daysBetween(start, g) / per))]++);
    const max = Math.max(...counts, 1);
    const dueBin = Math.min(bins - 1, Math.floor(R.daysBetween(start, ev.due_date) / per));
    const mineBin = S.mine && S.mine.birth_guess ? Math.min(bins - 1, Math.floor(R.daysBetween(start, S.mine.birth_guess) / per)) : -1;
    x.append(h("div", { class: "hist", role: "img", "aria-label": "Distribución de fechas apostadas" },
      counts.map((c, i) => h("i", { class: i === mineBin ? "mine" : i === dueBin ? "due" : "", style: { height: (c / max * 100) + "%" },
        title: R.fmtShort(R.addDays(start, Math.floor(i * per))) + ": " + c }))));
    x.append(h("div", { class: "hist-axis" }, h("span", { text: R.fmtShort(start) }),
      h("span", null, "▮ fecha de parto", mineBin >= 0 ? h("span", { style: { color: "var(--gemelos)" }, text: "  ▮ tu apuesta" }) : null),
      h("span", { text: R.fmtShort(end) })));

    if (ev.birth_date && st.closest.length) {
      const medals = ["🥇", "🥈", "🥉"];
      x.append(h("h3", { style: { marginTop: "18px", fontSize: "1rem" }, text: "Los que más se acercaron" }),
        h("div", { class: "podium" }, st.closest.map((c, i) => h("div", { class: "p" },
          h("span", { class: "medal", text: medals[i] }),
          h("span", { style: { flex: "1" } }, h("b", { text: c.p.name }), " · " + R.fmtShort(c.p.birth_guess)),
          h("span", { class: "chip date", text: c.diff === 0 ? "¡Exacto!" : c.diff + (c.diff === 1 ? " día" : " días") })))));
    }
  }

  function renderRecent() {
    const ev = S.ev; const x = el.recent; x.textContent = "";
    x.append(h("div", { class: "card-head" }, h("h2", { class: "display", text: "Predicciones recientes" })));
    if (!S.preds.length) { x.append(h("div", { class: "empty" }, "Aún no hay votos.", h("br"), "¡Sé el primero en votar!")); return; }
    const list = S.showAll ? S.preds : S.preds.slice(0, 8);
    x.append(h("ul", { class: "feed" }, list.map(p => {
      const t = TEAMS[p.team];
      return h("li", { class: "item" },
        h("div", { class: "avatar " + p.team, "aria-hidden": "true", text: R.initials(p.name) }),
        h("div", null,
          h("div", { class: "who" }, h("b", { text: p.name }), h("span", { class: "chip " + p.team, text: t.label }),
            p.birth_guess ? h("span", { class: "chip date", text: "📅 " + R.fmtShort(p.birth_guess) }) : null,
            ev.revealed_team === p.team ? h("span", { class: "chip ok", text: "✓" }) : null),
          p.message ? h("p", { text: "“" + p.message + "”" }) : null,
          h("div", { class: "when", text: R.timeAgo(p.created_at) })));
    })));
    if (S.preds.length > 8) x.append(h("button", { class: "btn ghost sm more", type: "button",
      text: S.showAll ? "Ver menos" : "Ver las " + S.preds.length + " predicciones", onclick: () => { S.showAll = !S.showAll; renderRecent(); } }));
  }

  // ---------------------------------------------------------------- revelación
  function maybeShowReveal() {
    const ev = S.ev;
    if (!ev.revealed_team || lsGet("reveal_seen") === ev.revealed_at || document.querySelector(".reveal-overlay")) return;
    const t = TEAMS[ev.revealed_team];
    const hit = S.mine ? S.mine.team === ev.revealed_team : null;
    const close = () => { lsSet("reveal_seen", ev.revealed_at); ov.remove(); };
    const ov = h("div", { class: "reveal-overlay", role: "dialog", "aria-modal": "true", "aria-label": t.reveal },
      h("div", { class: "inner" },
        h("div", { class: "bell", "aria-hidden": "true", text: "🔔" }),
        h("p", { text: ev.baby_name }),
        h("h2", { text: t.reveal }),
        h("p", { text: hit === true ? "¡Acertaste! Tu predicción fue correcta 🎉" : hit === false ? "Esta vez no le atinaste… ¡pero la emoción es la misma!" : "¡Gracias por acompañar a la familia!" }),
        h("button", { class: "btn", type: "button", text: "Ver la página", onclick: close })));
    document.body.append(ov);
    ov.querySelector("button").focus();
    const colors = ev.revealed_team === "gemelos" ? [R.teamColor("nina"), R.teamColor("nino"), R.teamColor("gemelos"), "#fff"] : [R.teamColor(ev.revealed_team), "#ffffff", R.teamColor("gemelos")];
    R.confetti(colors, 4200);
    document.addEventListener("keydown", function esc(e) { if (e.key === "Escape") { close(); document.removeEventListener("keydown", esc); } });
  }

  // ---------------------------------------------------------------- tiempo real
  let refreshing = false;
  async function refresh() {
    if (refreshing || !S.ev) return; refreshing = true;
    try {
      const ev = await api.getEvent(slug); if (!ev) return notFound();
      const [preds, news, mine] = await Promise.all([api.listPredictions(ev.id), api.listNews(ev.id), api.getMyPrediction(slug)]);
      S.ev = ev; S.preds = preds || []; S.news = news || []; S.mine = mine || null;
      render();
    } catch (e) { /* reintenta en el siguiente evento */ } finally { refreshing = false; }
  }

  $("#share-top").addEventListener("click", () => R.share(R.guestUrl(slug), S.ev ? S.ev.baby_name : "Revelación"));
  load().then(() => { if (S.ev) api.subscribe(S.ev.id, refresh); });
})();
