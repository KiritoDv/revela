/* Revela · panel del anfitrión */
(function () {
  "use strict";
  const R = window.Revela;
  const { h, $, TEAMS } = R;
  const slug = R.param("e");
  const app = $("#app");
  const S = { ev: null, preds: [], news: [], tab: "resumen", key: null };
  const KEYSTORE = "revela_admin_" + slug;

  $("#brand").textContent = (window.REVELA_CONFIG || {}).BRAND || "Revela";
  $("#footer").append(R.brandFooter());

  if (!slug) { app.textContent = ""; app.append(h("div", { class: "card" }, h("h2", { text: "Falta el enlace del evento" }),
    h("p", { class: "muted" }, "Abre el panel con el enlace privado que recibiste al crear tu página, o ", h("a", { href: "panel.html?e=demo#k=demo", text: "prueba el panel de la demo" }), "."))); return; }
  const api = R.api(slug);
  const banner = R.demoBanner(slug); if (banner) $("#demo").append(banner);

  // La llave viaja en el #hash (no llega a ningún servidor); la quitamos de la barra de direcciones.
  let key = R.hashParam("k");
  if (key) { history.replaceState(null, "", location.pathname + location.search); }
  else { try { key = localStorage.getItem(KEYSTORE) || sessionStorage.getItem(KEYSTORE); } catch (e) {} }

  async function login(k, remember) {
    try {
      await api.admin.check(slug, k);
      S.key = k;
      try { sessionStorage.setItem(KEYSTORE, k); if (remember) localStorage.setItem(KEYSTORE, k); } catch (e) {}
      await load(); api.subscribe(S.ev.id, load);
    } catch (e) { loginForm(e.message); }
  }

  function loginForm(errMsg) {
    try { localStorage.removeItem(KEYSTORE); sessionStorage.removeItem(KEYSTORE); } catch (e) {}
    app.textContent = "";
    const inp = h("input", { class: "input", id: "k", autocomplete: "off", placeholder: "Pega aquí tu llave de anfitrión" });
    const rem = h("input", { type: "checkbox", id: "rem" });
    app.append(h("div", { class: "card", style: { maxWidth: "520px", margin: "20px auto" } },
      h("h2", { class: "display", text: "Entrar al panel" }),
      h("p", { class: "muted", text: "Usa la llave privada que se generó al crear tu página. Sin ella nadie puede revelar ni moderar." }),
      h("form", { onsubmit: e => { e.preventDefault(); login(inp.value.trim(), rem.checked); } },
        h("div", { class: "field" }, h("label", { for: "k", text: "Llave de anfitrión" }), inp),
        h("label", { class: "row small muted", style: { marginTop: "10px" } }, rem, "Recordar en este dispositivo"),
        h("div", { class: "error-msg", text: errMsg || "" }),
        h("button", { class: "btn primary block", type: "submit", text: "Entrar" }))));
  }

  async function load() {
    const ev = await api.getEvent(slug);
    if (!ev) { app.textContent = ""; app.append(h("div", { class: "card" }, h("h2", { text: "Este evento ya no existe." }))); return; }
    const [preds, news] = await Promise.all([api.admin.listPredictions(slug, S.key), api.listNews(ev.id)]);
    S.ev = ev; S.preds = preds || []; S.news = news || [];
    document.documentElement.dataset.theme = ev.theme || "clasico";
    if (ev.revealed_team) document.documentElement.dataset.revealed = ev.revealed_team; else delete document.documentElement.dataset.revealed;
    document.title = "Panel · " + ev.baby_name;
    render();
  }

  const TABS = [["resumen", "Resumen"], ["invitados", "Invitados"], ["noticias", "Noticias"], ["revelar", "Revelar"], ["detalles", "Detalles"], ["compartir", "Compartir"]];

  function render() {
    // Conserva lo que el anfitrión está escribiendo si llega una actualización en vivo
    const active = document.activeElement;
    if (active && active.closest && active.closest("form[data-keep]") && app.contains(active)) { renderHeaderOnly(); return; }
    app.textContent = "";
    app.append(header());
    const tabs = h("div", { class: "tabs", role: "tablist" }, TABS.map(([id, label]) => h("button", {
      role: "tab", type: "button", "aria-selected": String(S.tab === id), onclick: () => { S.tab = id; render(); } },
      label, id === "invitados" ? h("span", { class: "dot-count", text: String(S.preds.length) }) : null)));
    app.append(tabs);
    const sel = tabs.querySelector('[aria-selected="true"]');
    if (sel) tabs.scrollLeft = sel.offsetLeft - (tabs.clientWidth - sel.offsetWidth) / 2;
    const body = h("div", { class: "tabpanel stack", role: "tabpanel" });
    ({ resumen, invitados, noticias, revelar, detalles, compartir })[S.tab](body);
    app.append(body);
  }
  function renderHeaderOnly() { const old = app.querySelector(".hero"); if (old) old.replaceWith(header()); }

  function header() {
    const ev = S.ev;
    return h("section", { class: "hero", style: { textAlign: "left", padding: "20px 22px" } },
      h("div", { class: "row", style: { justifyContent: "space-between" } },
        h("div", null, h("div", { class: "eyebrow", text: "Tu revelación" }),
          h("h1", { style: { fontSize: "clamp(2rem,5vw,2.8rem)", margin: "4px 0" }, text: ev.baby_name }),
          h("div", { class: "muted small", text: "Parto estimado: " + R.fmtDate(ev.due_date) + " · " + ev.parents })),
        h("div", { class: "row" },
          ev.revealed_team ? h("span", { class: "chip " + ev.revealed_team, style: { fontSize: ".9rem", padding: "6px 12px" }, text: "Revelado: " + TEAMS[ev.revealed_team].short })
                           : h("span", { class: "chip date", style: { fontSize: ".9rem", padding: "6px 12px" }, text: ev.voting_open ? "Votación abierta" : "Votación cerrada" }),
          h("a", { class: "btn ghost sm", href: R.guestUrl(slug), target: "_blank", rel: "noopener", text: "Ver página ↗" }))));
  }

  async function act(fn, okMsg) {
    try { await fn(); if (okMsg) R.toast(okMsg); if (document.activeElement) document.activeElement.blur(); await load(); }
    catch (e) { R.toast(e.message || "Algo salió mal", "err"); }
  }

  // ------------------------------------------------------------- Resumen
  function resumen(b) {
    const st = R.stats(S.preds.filter(p => !p.hidden), S.ev);
    const msgs = S.preds.filter(p => p.message).length;
    b.append(h("div", { class: "kpis" },
      kpi(st.total, "predicciones"), kpi(st.pct("nina") + "%", "Equipo Niña"), kpi(st.pct("nino") + "%", "Equipo Niño"),
      kpi(st.pct("gemelos") + "%", "¿Gemelos?"), kpi(st.guesses.length, "fechas apostadas"), kpi(msgs, "mensajes")));
    const last = S.preds.slice(0, 5);
    b.append(h("div", { class: "grid two" },
      h("div", { class: "card" }, h("h2", { class: "display", text: "Últimos en votar" }),
        last.length ? h("ul", { class: "feed", style: { marginTop: "12px" } }, last.map(p => h("li", { class: "item" },
          h("div", { class: "avatar " + p.team, text: R.initials(p.name) }),
          h("div", null, h("div", { class: "who" }, h("b", { text: p.name }), h("span", { class: "chip " + p.team, text: TEAMS[p.team].short }),
            p.hidden ? h("span", { class: "chip date", text: "oculto" }) : null),
            p.message ? h("p", { text: "“" + p.message + "”" }) : null, h("div", { class: "when", text: R.timeAgo(p.created_at) })))))
          : h("div", { class: "empty", text: "Aún no hay votos. Comparte tu enlace para empezar." })),
      h("div", { class: "card" }, h("h2", { class: "display", text: "Siguientes pasos" }),
        h("ol", { class: "muted", style: { paddingLeft: "20px", lineHeight: "1.9" } },
          h("li", null, h("button", { class: "linkish", type: "button", text: "Comparte el enlace o el QR", onclick: () => { S.tab = "compartir"; render(); } }), " con familia y amigos."),
          h("li", null, h("button", { class: "linkish", type: "button", text: "Publica una noticia", onclick: () => { S.tab = "noticias"; render(); } }), " para que vuelvan a la página."),
          h("li", null, "El gran día, ", h("button", { class: "linkish", type: "button", text: "toca la campana", onclick: () => { S.tab = "revelar"; render(); } }), " y la página de todos cambia al instante."),
          h("li", null, "Cuando nazca, registra la fecha y verán quién se acercó más.")))));
  }
  const kpi = (v, k) => h("div", { class: "kpi" }, h("div", { class: "v", text: String(v) }), h("div", { class: "k", text: k }));

  // ------------------------------------------------------------- Invitados
  function invitados(b) {
    const card = h("div", { class: "card" });
    card.append(h("div", { class: "card-head" }, h("h2", { class: "display", text: "Predicciones y mensajes" }),
      h("button", { class: "btn ghost sm", type: "button", text: "⬇ Exportar CSV", disabled: !S.preds.length, onclick: exportCSV })));
    if (!S.preds.length) { card.append(h("div", { class: "empty", text: "Aún no hay predicciones." })); b.append(card); return; }
    card.append(h("p", { class: "small muted", text: "Ocultar quita el mensaje de la página pública sin borrarlo. Borrar es permanente." }));
    card.append(h("div", { class: "table-scroll" }, h("table", { class: "list" },
      h("thead", null, h("tr", null, ["Invitado", "Equipo", "Fecha", "Mensaje", ""].map(t => h("th", { text: t })))),
      h("tbody", null, S.preds.map(p => h("tr", { class: p.hidden ? "is-hidden" : "" },
        h("td", null, h("b", { text: p.name }), h("div", { class: "faint small", text: R.timeAgo(p.created_at) })),
        h("td", null, h("span", { class: "chip " + p.team, text: TEAMS[p.team].short })),
        h("td", { text: p.birth_guess ? R.fmtShort(p.birth_guess) : "—" }),
        h("td", { style: { maxWidth: "320px" }, text: p.message || "—" }),
        h("td", { style: { whiteSpace: "nowrap" } },
          h("button", { class: "btn ghost sm", type: "button", text: p.hidden ? "Mostrar" : "Ocultar",
            onclick: () => act(() => api.admin.setHidden(slug, S.key, p.id, !p.hidden), p.hidden ? "Visible de nuevo" : "Oculto de la página") }), " ",
          h("button", { class: "btn danger sm", type: "button", text: "Borrar",
            onclick: () => confirm("¿Borrar la predicción de " + p.name + "? No se puede deshacer.") && act(() => api.admin.deletePrediction(slug, S.key, p.id), "Borrada") }))))))));
    b.append(card);
  }
  function exportCSV() {
    const rows = [["Nombre", "Equipo", "Fecha apostada", "Mensaje", "Oculto", "Creado"]].concat(
      S.preds.map(p => [p.name, TEAMS[p.team].label, p.birth_guess || "", p.message || "", p.hidden ? "sí" : "no", new Date(p.created_at).toLocaleString()]));
    R.downloadCSV(rows, "predicciones-" + slug + ".csv");
  }

  // ------------------------------------------------------------- Noticias
  function noticias(b) {
    const EMOJIS = ["💌", "🩺", "🎉", "🍼", "👣", "🎁", "📸", "🏥", "🎂", "❤️"];
    let emoji = "💌";
    const emoBtns = EMOJIS.map(e => h("button", { type: "button", class: "btn ghost sm", "aria-pressed": String(e === emoji), style: { minWidth: "44px" }, text: e,
      onclick: ev => { emoji = e; emoBtns.forEach(x => { x.setAttribute("aria-pressed", String(x.textContent === e)); x.style.borderColor = x.textContent === e ? "var(--accent)" : ""; }); } }));
    emoBtns[0].style.borderColor = "var(--accent)";
    const title = h("input", { class: "input", id: "n-title", maxlength: "120", placeholder: "Ej. ¡Ya tenemos fecha para la revelación!" });
    const body = h("textarea", { class: "input", id: "n-body", maxlength: "2000", rows: "4", placeholder: "Cuéntales a tus invitados qué hay de nuevo…" });
    const btn = h("button", { class: "btn primary", type: "submit", text: "Publicar noticia" });
    b.append(h("div", { class: "card" },
      h("h2", { class: "display", text: "Publicar una noticia" }),
      h("p", { class: "muted small", text: "Aparece al instante en la página de invitados, marcada como NUEVA para quienes regresen." }),
      h("form", { "data-keep": "1", onsubmit: async e => { e.preventDefault(); if (!title.value.trim()) { title.focus(); return R.toast("Escribe un título", "err"); }
          btn.disabled = true; await act(() => api.admin.postNews(slug, S.key, { emoji, title: title.value, body: body.value }), "Noticia publicada"); } },
        h("div", { class: "field" }, h("span", { class: "label", text: "Ícono" }), h("div", { class: "row" }, emoBtns)),
        h("div", { class: "field" }, h("label", { for: "n-title", text: "Título" }), title),
        h("div", { class: "field" }, h("label", { for: "n-body", text: "Mensaje" }), body),
        h("div", { style: { marginTop: "14px" } }, btn))));
    const list = h("div", { class: "card" }, h("h2", { class: "display", text: "Publicadas" }));
    if (!S.news.length) list.append(h("div", { class: "empty", text: "Todavía no publicas noticias." }));
    else list.append(h("div", { class: "news", style: { marginTop: "12px" } }, S.news.map(n => h("article", null,
      h("div", { class: "emo", text: n.emoji || "💌" }), h("h3", { text: n.title }), h("time", { text: R.timeAgo(n.created_at) }),
      n.body ? h("p", { text: n.body }) : null,
      h("div", { style: { marginTop: "10px" } }, h("button", { class: "btn danger sm", type: "button", text: "Eliminar",
        onclick: () => confirm("¿Eliminar esta noticia?") && act(() => api.admin.deleteNews(slug, S.key, n.id), "Eliminada") }))))));
    b.append(list);
  }

  // ------------------------------------------------------------- Revelar
  function revelar(b) {
    const ev = S.ev; const st = R.stats(S.preds.filter(p => !p.hidden), ev);
    const reveal = h("div", { class: "card" });
    reveal.append(h("h2", { class: "display", text: "Toca la campana 🔔" }));
    if (ev.revealed_team) {
      const t = TEAMS[ev.revealed_team];
      reveal.append(h("div", { class: "notice", style: { margin: "12px 0" } }, h("b", { text: t.reveal + " " + t.icon }),
        " Revelado " + R.timeAgo(ev.revealed_at) + ". " + st.correct + " de " + st.total + " invitados acertaron."),
        h("button", { class: "btn ghost sm", type: "button", text: "Deshacer revelación",
          onclick: () => confirm("¿Ocultar de nuevo el resultado y reabrir las predicciones?") && act(() => api.admin.reveal(slug, S.key, null), "Revelación deshecha") }));
    } else {
      reveal.append(h("p", { class: "muted", text: "Elige la respuesta. En ese instante la página de todos los invitados gira al color del equipo ganador, aparece la animación y se cierran las predicciones. El resultado no se guarda en ningún lado hasta que pulses aquí." }),
        h("div", { class: "reveal-buttons" }, Object.values(TEAMS).map(t => h("button", { class: "btn " + t.key, type: "button", text: t.reveal,
          onclick: () => confirm("¿Revelar ahora: " + t.reveal + "?\nTodos los invitados lo verán al instante.") && act(() => api.admin.reveal(slug, S.key, t.key), "¡Revelado! 🎉") }))));
    }
    b.append(reveal);

    b.append(h("div", { class: "card" }, h("h2", { class: "display", text: "Predicciones" }),
      h("p", { class: "muted", text: ev.revealed_team ? "Las predicciones se cierran automáticamente al revelar." : (ev.voting_open ? "Los invitados pueden votar y cambiar su voto." : "Nadie puede votar por ahora; los invitados siguen viendo resultados y noticias.") }),
      ev.revealed_team ? null : h("button", { class: "btn ghost", type: "button", text: ev.voting_open ? "Pausar predicciones" : "Reabrir predicciones",
        onclick: () => act(() => api.admin.updateEvent(slug, S.key, { voting_open: !ev.voting_open }), ev.voting_open ? "Predicciones pausadas" : "Predicciones abiertas") })));

    const bd = h("input", { class: "input", type: "date", id: "bd", value: ev.birth_date || "", style: { maxWidth: "220px" } });
    b.append(h("div", { class: "card" }, h("h2", { class: "display", text: "¡Ya nació!" }),
      h("p", { class: "muted", text: "Registra la fecha real y la página mostrará el podio de quienes se acercaron más." }),
      h("form", { "data-keep": "1", class: "row", onsubmit: e => { e.preventDefault(); act(() => api.admin.setBirth(slug, S.key, bd.value || null), bd.value ? "Fecha guardada" : "Fecha borrada"); } },
        h("label", { class: "sr", for: "bd", text: "Fecha de nacimiento" }), bd,
        h("button", { class: "btn primary", type: "submit", text: "Guardar fecha" })),
      ev.birth_date && st.closest.length ? h("div", { class: "podium" }, st.closest.map((c, i) => h("div", { class: "p" },
        h("span", { class: "medal", text: ["🥇", "🥈", "🥉"][i] }), h("span", { style: { flex: "1" } }, h("b", { text: c.p.name }), " · " + R.fmtShort(c.p.birth_guess)),
        h("span", { class: "chip date", text: c.diff === 0 ? "¡Exacto!" : c.diff + " días" })))) : null));
  }

  // ------------------------------------------------------------- Detalles
  function detalles(b) {
    const ev = S.ev; let photo = ev.photo_data || "";
    const f = (id, label, input, hint) => h("div", { class: "field" }, h("label", { for: id, text: label }), input, hint ? h("span", { class: "hint", text: hint }) : null);
    const baby = h("input", { class: "input", id: "d-baby", maxlength: "100", value: ev.baby_name });
    const parents = h("input", { class: "input", id: "d-parents", maxlength: "100", value: ev.parents });
    const due = h("input", { class: "input", id: "d-due", type: "date", value: ev.due_date });
    const msg = h("textarea", { class: "input", id: "d-msg", maxlength: "400", rows: "3" }); msg.value = ev.message || "";
    const thumb = h("div", { class: "thumb" }); const setThumb = () => { thumb.textContent = ""; if (photo) thumb.append(h("img", { src: photo, alt: "", style: { width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" } })); else thumb.textContent = "🍼"; }; setThumb();
    const file = h("input", { type: "file", accept: "image/*", id: "d-photo", class: "sr", onchange: async e => {
      try { photo = await R.imageToDataUrl(e.target.files[0]); setThumb(); } catch (ex) { R.toast(ex.message, "err"); } } });
    const themes = themePicker(ev.theme);
    b.append(h("div", { class: "card" }, h("h2", { class: "display", text: "Detalles de la página" }),
      h("form", { "data-keep": "1", onsubmit: e => { e.preventDefault();
          act(() => api.admin.updateEvent(slug, S.key, { baby_name: baby.value, parents: parents.value, due_date: due.value, message: msg.value, photo_data: photo, theme: themes.value() }), "Cambios guardados"); } },
        f("d-baby", "Nombre del bebé", baby), f("d-parents", "Nombre(s) de los padres", parents), f("d-due", "Fecha estimada de parto", due),
        f("d-msg", "Mensaje para los invitados", msg),
        h("div", { class: "field" }, h("span", { class: "label", text: "Foto (ultrasonido, pancita…)" }),
          h("div", { class: "photo-drop" }, thumb, h("label", { for: "d-photo", class: "btn ghost sm", text: "Elegir foto" }), file,
            h("button", { type: "button", class: "btn ghost sm", text: "Quitar", onclick: () => { photo = ""; setThumb(); } })),
          h("span", { class: "hint", text: "Se reduce en tu navegador antes de guardarse." })),
        h("div", { class: "field" }, h("span", { class: "label", text: "Tema" }), themes.el),
        h("div", { style: { marginTop: "16px" } }, h("button", { class: "btn primary", type: "submit", text: "Guardar cambios" })))));
    b.append(h("div", { class: "card" }, h("h2", { class: "display", text: "Zona de cuidado" }),
      h("p", { class: "muted", text: "Eliminar la página borra para siempre predicciones, mensajes y noticias." }),
      h("button", { class: "btn danger", type: "button", text: "Eliminar esta página", onclick: async () => {
        if (prompt('Escribe "ELIMINAR" para confirmar') !== "ELIMINAR") return;
        try { await api.admin.deleteEvent(slug, S.key); localStorage.removeItem(KEYSTORE); location.href = "index.html"; } catch (e) { R.toast(e.message, "err"); } } })));
  }

  function themePicker(current) {
    const opts = [["clasico", "Clásico", "linear-gradient(90deg,#fbe3eb,#fffdf9,#e1edf9)"], ["noche", "Noche", "linear-gradient(90deg,#241f48,#17142e,#352d66)"], ["pastel", "Pastel", "linear-gradient(90deg,#fde8ef,#eef4f1,#e3f0fa)"]];
    const el = h("div", { class: "theme-pick" }, opts.map(([v, l, g]) => h("div", null,
      h("input", { type: "radio", name: "theme", id: "th-" + v, value: v, checked: v === (current || "clasico") }),
      h("label", { for: "th-" + v }, h("div", { class: "swatch", style: { background: g } }), l))));
    return { el, value: () => (el.querySelector("input:checked") || {}).value || "clasico" };
  }
  R.themePicker = themePicker;

  // ------------------------------------------------------------- Compartir
  function compartir(b) {
    const url = R.guestUrl(slug);
    const qrBox = h("div", { class: "qr" });
    b.append(h("div", { class: "grid two" },
      h("div", { class: "card" }, h("h2", { class: "display", text: "Enlace para invitados" }),
        h("p", { class: "muted small", text: "Mándalo por WhatsApp o ponlo en la invitación. Pueden volver con este mismo enlace a ver noticias." }),
        h("div", { class: "key-box", text: url }),
        h("div", { class: "row", style: { marginTop: "12px" } },
          h("button", { class: "btn primary sm", type: "button", text: "Copiar enlace", onclick: () => R.copy(url) }),
          h("a", { class: "btn ghost sm", href: "https://wa.me/?text=" + encodeURIComponent("¿Niño o niña? Deja tu predicción para " + S.ev.baby_name + " 👉 " + url), target: "_blank", rel: "noopener", text: "WhatsApp" }))),
      h("div", { class: "card" }, h("h2", { class: "display", text: "Código QR" }),
        h("p", { class: "muted small", text: "Imprímelo para la mesa de la fiesta." }), qrBox,
        h("button", { class: "btn ghost sm", type: "button", style: { marginTop: "12px" }, text: "Imprimir", onclick: () => printQR(qrBox, url) }))));
    R.renderQR(qrBox, url);

    const snippet = '<script src="' + R.guestUrl(slug).replace(/fiesta\.html.*/, "embed.js") + '" data-evento="' + slug + '" data-texto="Deja tu predicción" async><\/script>';
    const iframe = '<iframe src="' + R.widgetUrl(slug) + '" style="width:100%;max-width:440px;height:640px;border:0;border-radius:20px" title="Predicciones"></iframe>';
    b.append(h("div", { class: "card" }, h("h2", { class: "display", text: "Widget para otro sitio web" }),
      h("p", { class: "muted small", text: "Pega una de estas opciones en tu blog, landing o invitación digital." }),
      h("div", { class: "field" }, h("span", { class: "label", text: "Botón flotante (abre el formulario en una ventana)" }), h("code", { class: "block", text: snippet }),
        h("div", null, h("button", { class: "btn ghost sm", type: "button", text: "Copiar", onclick: () => R.copy(snippet) }))),
      h("div", { class: "field" }, h("span", { class: "label", text: "Formulario incrustado" }), h("code", { class: "block", text: iframe }),
        h("div", null, h("button", { class: "btn ghost sm", type: "button", text: "Copiar", onclick: () => R.copy(iframe) }), " ",
          h("a", { class: "btn ghost sm", href: R.widgetUrl(slug), target: "_blank", rel: "noopener", text: "Probar widget ↗" })))));

    b.append(h("div", { class: "card" }, h("h2", { class: "display", text: "Tu acceso al panel" }),
      h("p", { class: "muted small", text: "Este enlace contiene tu llave. Guárdalo en un lugar seguro y no lo compartas con invitados." }),
      h("button", { class: "btn ghost sm", type: "button", text: "Copiar enlace privado del panel", onclick: () => R.copy(R.panelUrl(slug, S.key)) }), " ",
      h("button", { class: "btn ghost sm", type: "button", text: "Cerrar sesión en este dispositivo", onclick: () => { try { localStorage.removeItem(KEYSTORE); sessionStorage.removeItem(KEYSTORE); } catch (e) {} location.reload(); } })));
  }
  function printQR(box, url) {
    const img = box.querySelector("img, canvas"); if (!img) return;
    const src = img.tagName === "CANVAS" ? img.toDataURL() : img.src;
    const w = window.open("", "_blank"); if (!w) return;
    const d = w.document; d.title = S.ev.baby_name;
    d.body.style.cssText = "font-family:Georgia,serif;text-align:center;padding:40px";
    const hh = d.createElement("h1"); hh.textContent = S.ev.baby_name + " · ¿Niño o niña?";
    const p = d.createElement("p"); p.textContent = "Escanea y deja tu predicción";
    const im = d.createElement("img"); im.src = src; im.style.width = "320px";
    const u = d.createElement("p"); u.textContent = url; u.style.cssText = "font:12px monospace;color:#666";
    d.body.append(hh, p, im, u); setTimeout(() => w.print(), 400);
  }

  // Si pegan otro enlace de panel en la misma pestaña, recarga con la nueva llave
  window.addEventListener("hashchange", () => { if (R.hashParam("k")) location.reload(); });

  if (key) login(key); else loginForm();
})();
