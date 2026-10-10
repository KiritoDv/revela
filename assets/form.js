/*
 * Revela · formulario de predicción (componente reutilizable)
 * Lo usan fiesta.html y widget.html.
 *   Revela.predictionForm({ slug, ev, mine, onSaved, compact })  →  HTMLElement
 */
(function () {
  "use strict";
  const R = window.Revela;
  const { h, TEAMS } = R;

  function closedNotice(ev) {
    if (ev.revealed_team) {
      const t = TEAMS[ev.revealed_team];
      return h("div", { class: "notice" }, h("b", { text: t.reveal + " " + t.icon }), " Las predicciones se cerraron con la revelación.");
    }
    return h("div", { class: "notice warn" }, "Los padres cerraron las predicciones por ahora. ¡Vuelve pronto por noticias!");
  }

  function mineCard(ev, mine, onEdit) {
    const t = TEAMS[mine.team];
    const hit = ev.revealed_team ? ev.revealed_team === mine.team : null;
    return h("div", { class: "mine" },
      h("div", { class: "big", "aria-hidden": "true", text: t.icon }),
      h("div", { style: { flex: "1" } },
        h("div", { class: "eyebrow", text: "Tu predicción" }),
        h("div", null, h("b", { text: t.label }),
          mine.birth_guess ? " · llega el " + R.fmtDate(mine.birth_guess, { day: "numeric", month: "long" }) : "",
          hit === true ? h("span", { class: "chip ok", style: { marginLeft: "8px" }, text: "¡Acertaste!" }) : null),
        mine.message ? h("div", { class: "small muted", text: "“" + mine.message + "”" }) : null),
      onEdit ? h("button", { class: "btn ghost sm", type: "button", text: "Editar", onclick: onEdit }) : null);
  }

  function predictionForm(opts) {
    const { slug, ev, onSaved, compact } = opts;
    let mine = opts.mine || null;
    const root = h("div", { class: "pred-form" });
    const open = !ev.revealed_team && ev.voting_open;

    function renderSummary() {
      root.textContent = "";
      root.append(mineCard(ev, mine, open ? renderForm : null));
      if (!open) root.append(h("div", { style: { marginTop: "12px" } }, closedNotice(ev)));
    }

    function renderForm() {
      root.textContent = "";
      if (!open) { root.append(closedNotice(ev)); return; }
      let team = mine ? mine.team : null;
      let savedName = ""; try { savedName = localStorage.getItem("revela_name") || ""; } catch (e) {}

      const teamBtns = Object.values(TEAMS).map(t => h("button", {
        type: "button", class: "team", "data-team": t.key, "aria-pressed": String(team === t.key),
        onclick: () => { team = t.key; teamBtns.forEach(b => b.setAttribute("aria-pressed", String(b.dataset.team === team))); err.textContent = ""; }
      }, h("span", { class: "ico", "aria-hidden": "true", text: t.icon }), h("span", { class: "lbl", text: t.label })));

      const name = h("input", { class: "input", id: "f-name", maxlength: "60", autocomplete: "name", required: true,
        placeholder: "Ej. Tía Carmen", value: mine ? mine.name : savedName });
      const date = h("input", { class: "input", id: "f-date", type: "date",
        min: R.addDays(ev.due_date, -120), max: R.addDays(ev.due_date, 60), value: mine && mine.birth_guess ? mine.birth_guess : "" });
      const msg = h("textarea", { class: "input", id: "f-msg", maxlength: "500", rows: compact ? "2" : "3",
        placeholder: "Un deseo, un consejo o una porra para los papás…" });
      msg.value = mine && mine.message ? mine.message : "";
      const count = h("div", { class: "counter", text: msg.value.length + "/500" });
      msg.addEventListener("input", () => count.textContent = msg.value.length + "/500");
      const err = h("div", { class: "error-msg", role: "alert" });
      const submit = h("button", { class: "btn primary block", type: "submit", text: mine ? "Guardar cambios" : "Enviar mi predicción" });

      const form = h("form", { novalidate: true, onsubmit: async e => {
        e.preventDefault(); err.textContent = "";
        if (!team) { err.textContent = "Elige un equipo: Niña, Niño o ¿Gemelos?"; return; }
        if (!name.value.trim()) { err.textContent = "Escribe tu nombre para que los papás sepan quién eres."; name.focus(); return; }
        if (date.value && (date.value < date.min || date.value > date.max)) { err.textContent = "Elige una fecha cercana al día de parto."; date.focus(); return; }
        submit.disabled = true; submit.textContent = "Enviando…";
        try {
          const api = R.api(slug);
          await api.submitPrediction(slug, { name: name.value.trim(), team, birth_guess: date.value || null, message: msg.value.trim() });
          try { localStorage.setItem("revela_name", name.value.trim()); } catch (e2) {}
          mine = await api.getMyPrediction(slug);
          R.toast(opts.mine ? "¡Predicción actualizada!" : "¡Gracias! Tu predicción quedó registrada 🎉");
          renderSummary();
          if (onSaved) onSaved(mine);
        } catch (ex) {
          err.textContent = ex.message || "No se pudo enviar. Intenta de nuevo.";
          submit.disabled = false; submit.textContent = mine ? "Guardar cambios" : "Enviar mi predicción";
        }
      } },
        h("div", { class: "label", style: { marginBottom: "8px" }, text: "Creo que es…" }),
        h("div", { class: "teams", role: "group", "aria-label": "Elige tu equipo" }, teamBtns),
        h("div", { class: "field" }, h("label", { for: "f-name", text: "Tu nombre" }), name),
        h("div", { class: "field" }, h("label", { for: "f-date", text: "¿Qué día crees que nacerá?" }), date,
          h("span", { class: "hint", text: "Fecha estimada: " + R.fmtDate(ev.due_date) + ". Opcional." })),
        h("div", { class: "field" }, h("label", { for: "f-msg", text: "Mensaje para el libro de recuerdos" }), msg, count),
        err,
        h("div", { style: { marginTop: "10px" } }, submit),
        mine ? h("div", { style: { textAlign: "center", marginTop: "8px" } },
          h("button", { class: "linkish small muted", type: "button", text: "Cancelar", onclick: renderSummary })) : null,
        h("p", { class: "small faint", style: { marginTop: "10px", textAlign: "center" },
          text: "Tu predicción se guarda en este dispositivo: vuelve con el mismo enlace para verla o cambiarla." })
      );
      root.append(form);
    }

    if (mine) renderSummary(); else renderForm();
    return root;
  }

  R.predictionForm = predictionForm;
  R.mineCard = mineCard;
})();
