/*
 * Revela · widget embebible
 * Pega en cualquier sitio:
 *   <script src="https://TU-DOMINIO/embed.js" data-evento="bebe-sol-a1b2c3"
 *           data-texto="Deja tu predicción" data-color="#6b4fd8" async></script>
 * Muestra un botón flotante que abre el formulario en una ventana.
 */
(function () {
  "use strict";
  var s = document.currentScript || document.querySelector('script[src*="embed.js"][data-evento]');
  if (!s) return;
  var slug = s.getAttribute("data-evento") || "demo";
  var label = s.getAttribute("data-texto") || "Deja tu predicción";
  var color = s.getAttribute("data-color") || "#6b4fd8";
  var pos = s.getAttribute("data-posicion") === "izquierda" ? "left" : "right";
  var base = s.src.replace(/embed\.js.*$/, "");
  var url = base + "widget.html?e=" + encodeURIComponent(slug);

  var css = ".rv-btn{position:fixed;bottom:20px;" + pos + ":20px;z-index:2147483000;display:flex;align-items:center;gap:8px;" +
    "padding:13px 20px;border:0;border-radius:999px;background:" + color + ";color:#fff;font:600 15px/1 system-ui,-apple-system,sans-serif;" +
    "box-shadow:0 10px 30px -8px rgba(0,0,0,.45);cursor:pointer;transition:transform .15s}" +
    ".rv-btn:hover{transform:translateY(-2px)}.rv-dot{width:18px;height:18px;border-radius:50%;background:conic-gradient(#f28cb0 0 50%,#7cb6f2 50% 100%);border:2px solid #fff}" +
    ".rv-ov{position:fixed;inset:0;z-index:2147483001;background:rgba(20,16,40,.55);display:flex;align-items:flex-end;justify-content:center;padding:12px}" +
    "@media(min-width:600px){.rv-ov{align-items:center}}" +
    ".rv-box{position:relative;width:100%;max-width:460px;height:min(720px,92vh);border-radius:24px;overflow:hidden;background:#f7f2ea;box-shadow:0 30px 80px -20px rgba(0,0,0,.6)}" +
    ".rv-box iframe{width:100%;height:100%;border:0}" +
    ".rv-x{position:absolute;top:10px;right:10px;width:36px;height:36px;border-radius:50%;border:0;background:rgba(255,255,255,.9);font:20px/1 system-ui;cursor:pointer;z-index:1}";
  var st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);

  var btn = document.createElement("button");
  btn.type = "button"; btn.className = "rv-btn"; btn.setAttribute("aria-haspopup", "dialog");
  var dot = document.createElement("span"); dot.className = "rv-dot"; dot.setAttribute("aria-hidden", "true");
  btn.appendChild(dot); btn.appendChild(document.createTextNode(label));

  function open() {
    var ov = document.createElement("div"); ov.className = "rv-ov"; ov.setAttribute("role", "dialog"); ov.setAttribute("aria-modal", "true"); ov.setAttribute("aria-label", label);
    var box = document.createElement("div"); box.className = "rv-box";
    var x = document.createElement("button"); x.className = "rv-x"; x.type = "button"; x.setAttribute("aria-label", "Cerrar"); x.textContent = "×";
    var fr = document.createElement("iframe"); fr.src = url; fr.title = label; fr.loading = "lazy";
    box.appendChild(x); box.appendChild(fr); ov.appendChild(box); document.body.appendChild(ov); x.focus();
    function close() { ov.remove(); document.removeEventListener("keydown", esc); btn.focus(); }
    function esc(e) { if (e.key === "Escape") close(); }
    x.onclick = close; ov.onclick = function (e) { if (e.target === ov) close(); };
    document.addEventListener("keydown", esc);
  }
  btn.onclick = open;
  (document.body ? Promise.resolve() : new Promise(function (r) { document.addEventListener("DOMContentLoaded", r); }))
    .then(function () { document.body.appendChild(btn); });
})();
