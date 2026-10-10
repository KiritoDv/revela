/* Revela · utilidades de interfaz compartidas */
(function () {
  "use strict";
  const CFG = window.REVELA_CONFIG || {};
  const LOCALE = CFG.LOCALE || "es-MX";

  const TEAMS = {
    nina:    { key: "nina",    label: "Equipo Niña", short: "Niña",     reveal: "¡Es una niña!",   icon: "🎀" },
    nino:    { key: "nino",    label: "Equipo Niño", short: "Niño",     reveal: "¡Es un niño!",    icon: "🧸" },
    gemelos: { key: "gemelos", label: "¿Gemelos?",   short: "Gemelos",  reveal: "¡Son gemelos!",   icon: "👶" }
  };

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  /** Crea elementos sin innerHTML para contenido de usuarios (anti-XSS). */
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    if (attrs) for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === "class") el.className = v;
      else if (k === "text") el.textContent = v;
      else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
      else if (k === "style" && typeof v === "object") Object.assign(el.style, v);
      else el.setAttribute(k, v === true ? "" : v);
    }
    for (const kid of kids.flat()) if (kid != null && kid !== false)
      el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
    return el;
  }

  function parseDate(iso) { return iso ? new Date(iso.length <= 10 ? iso + "T12:00:00" : iso) : null; }
  function fmtDate(iso, opts) {
    const d = parseDate(iso); if (!d) return "";
    return d.toLocaleDateString(LOCALE, opts || { day: "numeric", month: "long", year: "numeric" });
  }
  function fmtShort(iso) { return fmtDate(iso, { day: "numeric", month: "short" }); }
  function daysBetween(a, b) { return Math.round((parseDate(b) - parseDate(a)) / 86400000); }
  function todayISO() { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); }
  function addDays(iso, n) { const d = parseDate(iso); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); }
  function timeAgo(iso) {
    const s = (Date.now() - new Date(iso)) / 1000;
    if (s < 60) return "hace un momento";
    if (s < 3600) return "hace " + Math.floor(s / 60) + " min";
    if (s < 86400) return "hace " + Math.floor(s / 3600) + " h";
    if (s < 86400 * 7) { const d = Math.floor(s / 86400); return "hace " + d + (d === 1 ? " día" : " días"); }
    return fmtDate(iso, { day: "numeric", month: "short", year: "numeric" });
  }
  function initials(name) { return (name || "?").trim().split(/\s+/).slice(0, 2).map(w => w[0]).join("").toUpperCase(); }

  function param(name) { return new URLSearchParams(location.search).get(name); }
  function hashParam(name) { return new URLSearchParams(location.hash.slice(1)).get(name); }
  function baseUrl() { return location.href.replace(/[^/]*([?#].*)?$/, ""); }
  function guestUrl(slug) { return baseUrl() + "fiesta.html?e=" + encodeURIComponent(slug); }
  function panelUrl(slug, key) { return baseUrl() + "panel.html?e=" + encodeURIComponent(slug) + "#k=" + key; }
  function widgetUrl(slug) { return baseUrl() + "widget.html?e=" + encodeURIComponent(slug); }

  function toast(msg, kind) {
    let box = $(".toasts"); if (!box) { box = h("div", { class: "toasts", role: "status", "aria-live": "polite" }); document.body.append(box); }
    const t = h("div", { class: "toast " + (kind || ""), text: msg });
    box.append(t); setTimeout(() => t.classList.add("out"), 3200); setTimeout(() => t.remove(), 3700);
  }

  async function copy(text) {
    try { await navigator.clipboard.writeText(text); toast("Copiado al portapapeles"); }
    catch (e) { prompt("Copia este texto:", text); }
  }

  async function share(url, title) {
    if (navigator.share) { try { await navigator.share({ title, url }); return; } catch (e) { if (e.name === "AbortError") return; } }
    copy(url);
  }

  /** Reduce una imagen a JPEG ≤ ~320 KB como data URL (sin subir a ningún servidor de terceros). */
  function imageToDataUrl(file, max = 1000) {
    return new Promise((resolve, reject) => {
      if (!file || !/^image\//.test(file.type)) return reject(new Error("Elige una imagen (JPG o PNG)."));
      const img = new Image(); const url = URL.createObjectURL(file);
      img.onload = () => {
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        let q = 0.85, out = c.toDataURL("image/jpeg", q);
        while (out.length > 430000 && q > 0.35) { q -= 0.1; out = c.toDataURL("image/jpeg", q); }
        if (out.length > 440000) return reject(new Error("La imagen es demasiado grande."));
        resolve(out);
      };
      img.onerror = () => reject(new Error("No se pudo leer la imagen."));
      img.src = url;
    });
  }

  /** Archivo .ics para agregar la fecha de parto al calendario. */
  function downloadICS(ev) {
    const d = ev.due_date.replace(/-/g, "");
    const next = addDays(ev.due_date, 1).replace(/-/g, "");
    const ics = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Revela//ES", "BEGIN:VEVENT",
      "UID:" + ev.slug + "@revela", "DTSTAMP:" + new Date().toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z",
      "DTSTART;VALUE=DATE:" + d, "DTEND;VALUE=DATE:" + next,
      "SUMMARY:Fecha estimada de " + ev.baby_name.replace(/[,;]/g, " "),
      "URL:" + guestUrl(ev.slug), "END:VEVENT", "END:VCALENDAR"].join("\r\n");
    const a = h("a", { href: URL.createObjectURL(new Blob([ics], { type: "text/calendar" })), download: ev.slug + ".ics" });
    document.body.append(a); a.click(); a.remove();
  }

  function downloadCSV(rows, filename) {
    const esc = v => '"' + String(v ?? "").replace(/"/g, '""') + '"';
    const csv = "﻿" + rows.map(r => r.map(esc).join(",")).join("\r\n");
    const a = h("a", { href: URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" })), download: filename });
    document.body.append(a); a.click(); a.remove();
  }

  /** Estadísticas compartidas por la página de invitados y el panel. */
  function stats(preds, ev) {
    const counts = { nina: 0, nino: 0, gemelos: 0 };
    preds.forEach(p => { if (counts[p.team] != null) counts[p.team]++; });
    const total = preds.length;
    const pct = k => total ? Math.round(counts[k] * 100 / total) : 0;
    const guesses = preds.filter(p => p.birth_guess).map(p => p.birth_guess).sort();
    const freq = {}; guesses.forEach(g => freq[g] = (freq[g] || 0) + 1);
    let popular = null; Object.entries(freq).forEach(([d, n]) => { if (!popular || n > popular[1]) popular = [d, n]; });
    let closest = [];
    if (ev && ev.birth_date) {
      closest = preds.filter(p => p.birth_guess)
        .map(p => ({ p, diff: Math.abs(daysBetween(p.birth_guess, ev.birth_date)) }))
        .sort((a, b) => a.diff - b.diff || a.p.created_at.localeCompare(b.p.created_at)).slice(0, 3);
    }
    let correct = 0; if (ev && ev.revealed_team) correct = counts[ev.revealed_team] || 0;
    return { counts, total, pct, guesses, earliest: guesses[0], latest: guesses[guesses.length - 1], popular, closest, correct };
  }

  /** Confeti ligero sin dependencias. */
  function confetti(colors, ms = 3200) {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const c = h("canvas", { class: "confetti-canvas", "aria-hidden": "true" }); document.body.append(c);
    const ctx = c.getContext("2d"); const dpr = devicePixelRatio || 1;
    const fit = () => { c.width = innerWidth * dpr; c.height = innerHeight * dpr; };
    fit(); addEventListener("resize", fit);
    const N = Math.min(220, Math.round(innerWidth / 4));
    const parts = Array.from({ length: N }, () => ({
      x: Math.random() * c.width, y: -Math.random() * c.height * 0.6, w: (6 + Math.random() * 6) * dpr, hgt: (8 + Math.random() * 10) * dpr,
      vy: (2 + Math.random() * 3) * dpr, vx: (Math.random() - 0.5) * 2 * dpr, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.2,
      col: colors[Math.floor(Math.random() * colors.length)] }));
    const end = performance.now() + ms;
    (function tick(t) {
      ctx.clearRect(0, 0, c.width, c.height);
      parts.forEach(p => { p.x += p.vx; p.y += p.vy; p.r += p.vr; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r);
        ctx.fillStyle = p.col; ctx.globalAlpha = t > end ? Math.max(0, 1 - (t - end) / 800) : 1; ctx.fillRect(-p.w / 2, -p.hgt / 2, p.w, p.hgt); ctx.restore(); });
      if (t < end + 800) requestAnimationFrame(tick); else { c.remove(); removeEventListener("resize", fit); }
    })(performance.now());
  }

  function teamColor(k) { return getComputedStyle(document.documentElement).getPropertyValue("--" + k).trim(); }

  function renderQR(el, text) {
    el.textContent = "";
    if (!window.QRCode) { el.append(h("p", { class: "muted small", text: "QR no disponible sin conexión." })); return; }
    new window.QRCode(el, { text, width: 180, height: 180, colorDark: "#1f1a3d", colorLight: "#ffffff", correctLevel: window.QRCode.CorrectLevel.M });
  }

  function brandFooter() {
    return h("footer", { class: "foot" }, "Hecho con ♥ en ", h("a", { href: "index.html", text: CFG.BRAND || "Revela" }),
      " · ", h("a", { href: "index.html", text: "Crea la tuya" }));
  }

  function demoBanner(slug) {
    if (!window.Revela.isDemo(slug)) return null;
    return h("div", { class: "demo-banner" },
      h("span", { text: "🎪 Modo demo — los datos se guardan solo en este navegador." }),
      slug === "demo" ? h("button", { class: "linkish", type: "button", text: "Reiniciar demo",
        onclick: () => { if (confirm("¿Reiniciar los datos de la demo?")) { window.Revela.api("demo").resetDemo(); location.reload(); } } }) : null);
  }

  window.Revela = window.Revela || {};
  Object.assign(window.Revela, { TEAMS, $, $$, h, fmtDate, fmtShort, daysBetween, todayISO, addDays, timeAgo, initials,
    param, hashParam, guestUrl, panelUrl, widgetUrl, toast, copy, share, imageToDataUrl, downloadICS, downloadCSV,
    stats, confetti, teamColor, renderQR, brandFooter, demoBanner, parseDate });
})();
