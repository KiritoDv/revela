# Revela · mini app de revelación de género

Réplica funcional de WonderReveal, como sitio estático + Supabase. Sin servidor propio, sin cuentas para invitados.

## Qué incluye

| Archivo | Para quién | Qué hace |
|---|---|---|
| `index.html` | Anfitrión | Asistente de 3 pasos (detalles → foto/mensaje/tema → revisar) con vista previa en vivo. Genera el enlace de invitados y el enlace privado del panel. |
| `fiesta.html?e=<evento>` | Invitados | Predicción (Niña / Niño / ¿Gemelos?), apuesta de fecha de nacimiento, mensaje, resultados en vivo, histograma de fechas, muro de mensajes y **noticias de la familia** (marcadas como NUEVO al regresar). Animación de revelación con confeti. |
| `panel.html?e=<evento>#k=<llave>` | Anfitrión | Resumen, moderación (ocultar/borrar), exportar CSV, publicar noticias, **tocar la campana**, pausar votos, registrar fecha real de nacimiento (podio de los más cercanos), editar detalles, QR imprimible y código del widget. |
| `widget.html?e=<evento>` | Cualquier sitio | Formulario compacto para incrustar en iframe. |
| `embed.js` | Cualquier sitio | Botón flotante que abre el widget en una ventana. |
| `supabase/schema.sql` | Base de datos | Tablas, seguridad y funciones. |

**Invitados que regresan:** cada dispositivo recibe un identificador anónimo (localStorage). Al volver con el mismo enlace ven su predicción, pueden cambiarla hasta la revelación, y las noticias aparecen primero.

## Pruébala ya (modo demo)

Sin configurar nada, todo corre en el navegador:

```bash
cd revela
npx serve .          # o: python3 -m http.server 8080
```

- Invitado: `http://localhost:8080/fiesta.html?e=demo`
- Panel: `http://localhost:8080/panel.html?e=demo#k=demo`

Abre ambas en pestañas lado a lado: al publicar una noticia o revelar, la página del invitado cambia sola.

## Publicarla de verdad (≈15 min)

1. **Supabase** → crea un proyecto en [supabase.com](https://supabase.com) (plan gratuito).
2. **SQL Editor** → pega `supabase/schema.sql` → *Run*.
3. **Project Settings → API** → copia *Project URL* y *anon public key* en `config.js`.
   Nunca uses la *service_role key* en el navegador.
4. **Hosting estático** → arrastra la carpeta a [Netlify Drop](https://app.netlify.com/drop), o súbela a Vercel / Cloudflare Pages / GitHub Pages. Puedes apuntar un subdominio (ej. `revela.tudominio.mx`).
5. Abre `index.html` en tu dominio y crea la primera página.

El tiempo real (votos y revelación instantáneos) se activa solo con el esquema. Si tu proyecto no lo tiene, la página igual se actualiza cada 45 s y al volver a la pestaña.

## Seguridad y privacidad

- El navegador **solo lee** eventos, predicciones visibles y noticias. No existen permisos de escritura directa; todo pasa por funciones que validan longitudes, fechas y estado.
- La llave del anfitrión y el identificador de cada dispositivo se guardan **como hash SHA-256** en tablas sin acceso público. La llave viaja en el `#` del enlace (los navegadores no lo envían a servidores) y se borra de la barra de direcciones al entrar.
- **El resultado no existe en la base de datos hasta que tocas la campana**, así que nadie puede espiarlo en el código ni en la red.
- El correo del anfitrión es opcional y nunca es legible desde el navegador.
- Las fotos se reducen en el navegador (≤ ~320 KB) y se guardan en la propia base; no se usan servicios de terceros.
- Una predicción por dispositivo (quien borre su navegador podría votar de nuevo; para una fiesta familiar es el equilibrio razonable).
- Borrar la página desde el panel elimina en cascada predicciones, mensajes y noticias.

Recomendado si la publicas abierta al público: en Supabase activa *Auth → Rate limits* y considera un captcha (Cloudflare Turnstile) en `create_event` para evitar creación masiva de páginas.

## Personalizar

- Marca y región: `config.js` (`BRAND`, `LOCALE`).
- Colores y temas: variables al inicio de `assets/app.css` (`clasico`, `noche`, `pastel`).
- Textos de equipos: `TEAMS` en `assets/ui.js`.
- Lógica de datos: `assets/api.js` (misma interfaz para Supabase y demo; puedes cambiar de backend sin tocar las páginas).

## Ideas para la siguiente versión

- Pago (Stripe / Mercado Pago) en el paso 3, como el original.
- Notificación por correo al anfitrión con sus enlaces (Supabase Edge Function + Resend).
- Libro de recuerdos en PDF con todos los mensajes.
- Cuenta regresiva programada: revelación automática a una hora fija.
