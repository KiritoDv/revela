/* Revela · asistente de creación (3 pasos) */
(function () {
  "use strict";
  const R = window.Revela;
  const { h, $ } = R;
  const app = $("#app");
  const api = R.api(null);
  const D = { parents: "", baby_name: "", due_date: "", email: "", message: "", photo_data: "", theme: "clasico" };
  let step = 1;

  $("#brand").textContent = (window.REVELA_CONFIG || {}).BRAND || "Revela";
  $("#footer").append(R.brandFooter());
  if (!R.configured) $("#demo").append(h("div", { class: "demo-banner" },
    "🎪 Modo demo: Supabase aún no está configurado, así que tu página se guardará solo en este navegador. Revisa el README para publicarla."));

  // ---------- vista previa ----------
  const pv = { photo: h("div", { class: "photo placeholder", "aria-hidden": "true", text: "🍼" }), name: h("h1"), meta: h("div", { class: "meta" }), quote: h("div") };
  const preview = h("div", { class: "stack" },
    h("div", { class: "eyebrow", text: "Vista previa en vivo" }),
    h("div", { class: "hero" }, pv.photo, h("div", { class: "eyebrow", text: "Bebé destacado" }), pv.name, pv.meta,
      h("div", { class: "teams", style: { marginTop: "18px" }, "aria-hidden": "true" }, Object.values(R.TEAMS).map(t =>
        h("div", { class: "team", style: { cursor: "default" } }, h("span", { class: "ico", text: t.icon }), h("span", { class: "lbl", text: t.label })))),
      pv.quote));
  function updatePreview() {
    pv.name.textContent = D.baby_name || "Bebé Sam";
    pv.meta.textContent = "";
    pv.meta.append(h("span", null, "Fecha de parto · ", h("b", { text: D.due_date ? R.fmtDate(D.due_date) : "por definir" })),
      h("span", null, "Padres: ", h("b", { text: D.parents || "Ana y João" })));
    pv.photo.replaceWith(pv.photo = D.photo_data ? h("img", { class: "photo", src: D.photo_data, alt: "" }) : h("div", { class: "photo placeholder", "aria-hidden": "true", text: "🍼" }));
    pv.quote.textContent = "";
    const m = D.message || "No vemos la hora de compartir este momento con la gente que queremos. ¡Haz tu predicción y déjanos un mensaje!";
    pv.quote.append(h("blockquote", { class: "quote", style: { textAlign: "left" } }, h("span", { text: "“" + m + "”" }), h("cite", { text: "— " + (D.parents || "Ana y João") })));
    document.documentElement.dataset.theme = D.theme;
  }

  // ---------- pasos ----------
  const STEPS = [["Detalles básicos", "Padres y bebé"], ["Personalizar", "Foto y mensaje"], ["Revisar", "Confirmar y crear"]];
  function stepper() {
    return h("div", { class: "steps", "aria-label": "Paso " + step + " de 3" }, STEPS.map(([t, s], i) =>
      h("div", { class: "s" + (i + 1 === step ? " on" : i + 1 < step ? " done" : "") },
        h("span", { class: "n", text: i + 1 < step ? "✓" : String(i + 1) }), h("span", { class: "t" }, h("b", { text: t }), h("br"), h("span", { class: "small", text: s })))));
  }

  function bind(input, key) { input.value = D[key] || ""; input.addEventListener("input", () => { D[key] = input.value; updatePreview(); }); return input; }
  function field(id, label, input, hint) { return h("div", { class: "field" }, h("label", { for: id, text: label }), input, hint ? h("span", { class: "hint", text: hint }) : null); }

  function render() {
    app.textContent = "";
    const left = h("div", { class: "card" });
    left.append(h("div", { class: "eyebrow", text: "Paso " + step + " de 3 · toma 2 minutos" }),
      h("h1", { class: "display", style: { fontSize: "2rem", margin: "6px 0 4px" }, text: STEPS[step - 1][0] }), stepper());
    const err = h("div", { class: "error-msg", role: "alert" });
    const minDue = R.addDays(R.todayISO(), -60), maxDue = R.addDays(R.todayISO(), 400);

    if (step === 1) {
      const parents = bind(h("input", { class: "input", id: "c-parents", maxlength: "100", placeholder: "Ej. Marina & Teo", autocomplete: "name" }), "parents");
      const baby = bind(h("input", { class: "input", id: "c-baby", maxlength: "100", placeholder: "Ej. Bebé Sol" }), "baby_name");
      const due = bind(h("input", { class: "input", id: "c-due", type: "date", min: minDue, max: maxDue }), "due_date");
      const email = bind(h("input", { class: "input", id: "c-email", type: "email", maxlength: "200", placeholder: "tu@correo.com", autocomplete: "email" }), "email");
      left.append(h("form", { novalidate: true, onsubmit: e => { e.preventDefault();
          if (!D.parents.trim()) return fail(err, parents, "Escribe el nombre de los padres.");
          if (!D.baby_name.trim()) return fail(err, baby, "Escribe el nombre del bebé (o un apodo como «Bebé Sol»).");
          if (!D.due_date || D.due_date < minDue || D.due_date > maxDue) return fail(err, due, "Elige una fecha estimada de parto válida.");
          if (D.email && !/^\S+@\S+\.\S+$/.test(D.email)) return fail(err, email, "Revisa el correo.");
          step = 2; render(); } },
        field("c-parents", "Nombre(s) de los padres *", parents),
        field("c-baby", "Nombre del bebé *", baby, "¿Aún no lo eligen? Usa un apodo cariñoso."),
        field("c-due", "Fecha estimada de parto *", due),
        field("c-email", "Tu correo (opcional)", email, "Solo como respaldo de contacto; nunca se muestra en la página."),
        err, h("button", { class: "btn primary block", type: "submit", style: { marginTop: "8px" }, text: "Continuar" })));
    }

    if (step === 2) {
      const msg = bind(h("textarea", { class: "input", id: "c-msg", maxlength: "400", rows: "3", placeholder: "Un mensaje de bienvenida para tus invitados" }), "message");
      const thumb = h("div", { class: "thumb" }, D.photo_data ? h("img", { src: D.photo_data, alt: "", style: { width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" } }) : "🍼");
      const file = h("input", { type: "file", accept: "image/*", id: "c-photo", class: "sr", onchange: async e => {
        try { D.photo_data = await R.imageToDataUrl(e.target.files[0]); updatePreview(); render(); } catch (ex) { err.textContent = ex.message; } } });
      const themeOpts = [["clasico", "Clásico", "linear-gradient(90deg,#fbe3eb,#fffdf9,#e1edf9)"], ["noche", "Noche", "linear-gradient(90deg,#241f48,#17142e,#352d66)"], ["pastel", "Pastel", "linear-gradient(90deg,#fde8ef,#eef4f1,#e3f0fa)"]];
      const themes = h("div", { class: "theme-pick" }, themeOpts.map(([v, l, g]) => h("div", null,
        h("input", { type: "radio", name: "theme", id: "t-" + v, value: v, checked: D.theme === v, onchange: () => { D.theme = v; updatePreview(); } }),
        h("label", { for: "t-" + v }, h("div", { class: "swatch", style: { background: g } }), l))));
      left.append(h("form", { novalidate: true, onsubmit: e => { e.preventDefault(); step = 3; render(); } },
        h("div", { class: "field" }, h("span", { class: "label", text: "Foto (opcional)" }),
          h("div", { class: "photo-drop" }, thumb, h("label", { for: "c-photo", class: "btn ghost sm", text: D.photo_data ? "Cambiar foto" : "Elegir foto" }), file,
            D.photo_data ? h("button", { type: "button", class: "btn ghost sm", text: "Quitar", onclick: () => { D.photo_data = ""; updatePreview(); render(); } }) : null),
          h("span", { class: "hint", text: "Un ultrasonido o foto de la pancita. Se reduce en tu navegador." })),
        field("c-msg", "Mensaje para los invitados", msg),
        h("div", { class: "field" }, h("span", { class: "label", text: "Tema" }), themes),
        err,
        h("div", { class: "row", style: { marginTop: "8px" } },
          h("button", { class: "btn ghost", type: "button", text: "Atrás", onclick: () => { step = 1; render(); } }),
          h("button", { class: "btn primary grow", type: "submit", text: "Continuar" }))));
    }

    if (step === 3) {
      const btn = h("button", { class: "btn primary grow", type: "submit", text: "Crear mi página" });
      const row = (k, v) => h("tr", null, h("th", { text: k }), h("td", { text: v || "—" }));
      left.append(h("form", { onsubmit: async e => { e.preventDefault(); btn.disabled = true; btn.textContent = "Creando…";
          try { const res = await api.createEvent(D); done(res); }
          catch (ex) { err.textContent = ex.message; btn.disabled = false; btn.textContent = "Crear mi página"; } } },
        h("table", { class: "list" }, h("tbody", null,
          row("Padres", D.parents), row("Bebé", D.baby_name), row("Parto estimado", R.fmtDate(D.due_date)),
          row("Correo", D.email), row("Mensaje", D.message), row("Foto", D.photo_data ? "Sí" : "No"), row("Tema", { clasico: "Clásico", noche: "Noche", pastel: "Pastel" }[D.theme]))),
        h("p", { class: "small muted", style: { marginTop: "12px" }, text: "Al crearla recibirás dos enlaces: uno para invitados y otro privado para tu panel (con tu llave de anfitrión)." }),
        err,
        h("div", { class: "row", style: { marginTop: "8px" } },
          h("button", { class: "btn ghost", type: "button", text: "Atrás", onclick: () => { step = 2; render(); } }), btn)));
    }

    app.append(h("div", { class: "grid two", style: { marginTop: "8px" } }, left, preview));
    updatePreview();
    const first = left.querySelector("input:not([type=radio]):not([type=file]), textarea"); if (first && step !== 3) first.focus({ preventScroll: true });
  }
  function fail(err, input, msg) { err.textContent = msg; input.focus(); }

  function done(res) {
    const g = R.guestUrl(res.slug), p = R.panelUrl(res.slug, res.admin_key);
    const qr = h("div", { class: "qr" });
    app.textContent = "";
    app.append(h("div", { class: "stack", style: { maxWidth: "720px", margin: "0 auto" } },
      h("div", { class: "hero" }, h("div", { style: { fontSize: "3rem" }, text: "🎉" }),
        h("h1", { text: "¡Tu página está lista!" }), h("p", { class: "muted", text: D.baby_name + " · " + R.fmtDate(D.due_date) })),
      h("div", { class: "card" }, h("h2", { class: "display", text: "1. Enlace para invitados" }),
        h("p", { class: "muted small", text: "Compártelo con familia y amigos." }), h("div", { class: "key-box", text: g }),
        h("div", { class: "row", style: { marginTop: "12px" } },
          h("button", { class: "btn primary sm", type: "button", text: "Copiar", onclick: () => R.copy(g) }),
          h("a", { class: "btn ghost sm", href: g, text: "Abrir página" })), h("div", { style: { marginTop: "14px" } }, qr)),
      h("div", { class: "card" }, h("h2", { class: "display", text: "2. Tu enlace privado de anfitrión" }),
        h("div", { class: "notice warn", style: { margin: "8px 0 12px" } }, h("b", { text: "Guárdalo ahora. " }),
          "Contiene tu llave y es la única forma de revelar, publicar noticias y moderar. No se puede recuperar."),
        h("div", { class: "key-box", text: p }),
        h("div", { class: "row", style: { marginTop: "12px" } },
          h("button", { class: "btn primary sm", type: "button", text: "Copiar enlace privado", onclick: () => R.copy(p) }),
          h("a", { class: "btn ghost sm", href: p, text: "Ir a mi panel" })))));
    R.renderQR(qr, g);
    window.scrollTo(0, 0);
  }

  render();
})();
