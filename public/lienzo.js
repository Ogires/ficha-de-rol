// Imagen vertical de 1080×1350 (la que mejor luce en el feed de LinkedIn), montada en el navegador.
// Sin el trasfondo, que se lee en la web
import { ATRIBUTOS, fraccion, vertice } from "/ficha.js";

const W = 1080, H = 1350;
const RETRATO = { cx: W / 2, cy: 260, r: 200 };

function cargarImagen(url) {
  return new Promise((ok, ko) => {
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = ko;
    img.src = url; // mismo origen: el canvas no queda "tainted"
  });
}

function lineas(ctx, texto, ancho, max) {
  const palabras = texto.split(/\s+/);
  const salida = [];
  let actual = "";
  for (const p of palabras) {
    const prueba = actual ? `${actual} ${p}` : p;
    if (ctx.measureText(prueba).width > ancho && actual) {
      salida.push(actual);
      actual = p;
    } else actual = prueba;
  }
  if (actual) salida.push(actual);
  if (salida.length > max) {
    salida.length = max;
    salida[max - 1] = salida[max - 1].replace(/\s*\S*$/, "…");
  }
  return salida;
}

// Recorta un texto de una línea con «…» si no cabe
function ajustar(ctx, texto, ancho) {
  if (ctx.measureText(texto).width <= ancho) return texto;
  let t = texto;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > ancho) t = t.slice(0, -1);
  return `${t.trimEnd()}…`;
}

function hexagono(ctx, f, cx, cy, r, c) {
  const camino = (t) => {
    ctx.beginPath();
    ATRIBUTOS.forEach((_, i) => {
      const [x, y] = vertice(i, t, cx, cy, r);
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    });
    ctx.closePath();
  };
  ctx.strokeStyle = c.borde;
  ctx.lineWidth = 1.5;
  for (const t of [0.25, 0.5, 0.75, 1]) {
    camino(t);
    ctx.stroke();
  }
  ATRIBUTOS.forEach((_, i) => {
    const [x, y] = vertice(i, 1, cx, cy, r);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(x, y);
    ctx.stroke();
  });
  const puntos = ATRIBUTOS.map((a, i) => vertice(i, fraccion(f.atributos[a].valor), cx, cy, r));
  ctx.beginPath();
  puntos.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  ctx.fillStyle = "rgba(217, 180, 74, 0.32)";
  ctx.fill();
  ctx.strokeStyle = c.oro;
  ctx.lineWidth = 4;
  ctx.lineJoin = "round";
  ctx.stroke();
  ctx.fillStyle = c.oro;
  for (const [x, y] of puntos) {
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.fill();
  }
  ATRIBUTOS.forEach((a, i) => {
    const [x, y] = vertice(i, 1, cx, cy, r + 42);
    ctx.textAlign = Math.abs(x - cx) < 1 ? "center" : x > cx ? "left" : "right";
    const dx = ctx.textAlign === "left" ? -10 : ctx.textAlign === "right" ? 10 : 0;
    ctx.fillStyle = c.suave;
    ctx.font = "700 22px Cinzel";
    ctx.fillText(a, x + dx, y - 6);
    ctx.fillStyle = c.texto;
    ctx.font = "700 34px Cinzel";
    ctx.fillText(String(f.atributos[a].valor), x + dx, y + 28);
  });
}

export async function dibujarFicha(f, retratoUrl, nombre = "") {
  await Promise.all([document.fonts.load("700 60px Cinzel"), document.fonts.load("400 28px Cinzel")]);
  const lienzo = document.createElement("canvas");
  lienzo.width = W;
  lienzo.height = H;
  const ctx = lienzo.getContext("2d");
  const css = getComputedStyle(document.documentElement);
  const color = (v, defecto) => css.getPropertyValue(v).trim() || defecto;
  const c = {
    fondo: color("--lienzo-fondo", "#1d1712"),
    oro: color("--lienzo-oro", "#d9b44a"),
    texto: color("--lienzo-texto", "#f3e9d2"),
    suave: "#c9b99a",
    borde: "#5a4630",
  };

  ctx.fillStyle = c.fondo;
  ctx.fillRect(0, 0, W, H);
  const halo = ctx.createRadialGradient(W / 2, 0, 50, W / 2, 0, 900);
  halo.addColorStop(0, "rgba(217, 180, 74, 0.18)");
  halo.addColorStop(1, "rgba(217, 180, 74, 0)");
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = c.oro;
  ctx.lineWidth = 6;
  ctx.strokeRect(24, 24, W - 48, H - 48);
  ctx.lineWidth = 1.5;
  ctx.strokeRect(38, 38, W - 76, H - 76);

  // Retrato en medallón: deja fuera las esquinas, donde Flux pinta firmas falsas
  const img = await cargarImagen(retratoUrl);
  const { cx, cy, r } = RETRATO;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.drawImage(img, cx - r, cy - r, r * 2, r * 2);
  ctx.restore();
  ctx.strokeStyle = c.oro;
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.arc(cx, cy, r + 4, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, r + 16, 0, Math.PI * 2);
  ctx.stroke();

  ctx.textAlign = "center";
  ctx.fillStyle = c.texto;
  let y = cy + r + 80;
  if (nombre) {
    ctx.font = "400 32px Cinzel";
    ctx.fillText(ajustar(ctx, nombre, W - 160), W / 2, y);
    y += 56;
  }
  ctx.font = "700 60px Cinzel";
  ctx.fillStyle = c.oro;
  for (const l of lineas(ctx, f.clase, W - 160, 2)) {
    ctx.fillText(l, W / 2, y);
    y += 68;
  }
  ctx.font = "400 34px Cinzel";
  ctx.fillStyle = c.texto;
  ctx.fillText(`Nivel ${f.nivel.valor}`, W / 2, y);
  const arriba = y + 40;

  hexagono(ctx, f, 300, arriba + 185, 130, c);

  ctx.textAlign = "left";
  const x = 610, ancho = W - 80 - x;
  let yl = arriba + 40;
  const columna = (titulo, nombres) => {
    if (!nombres.length) return;
    ctx.fillStyle = c.oro;
    ctx.font = "700 28px Cinzel";
    ctx.fillText(titulo, x, yl);
    ctx.fillStyle = c.texto;
    ctx.font = "400 26px system-ui, sans-serif";
    nombres.forEach((n, i) => ctx.fillText(ajustar(ctx, `· ${n}`, ancho), x, yl + 38 + i * 34));
    yl += 38 + nombres.length * 34 + 30;
  };
  columna("Hechizos", f.hechizos.map((h) => h.nombre));
  columna("Objetos", f.objetos.map((o) => o.nombre));

  ctx.textAlign = "center";
  ctx.fillStyle = c.texto;
  ctx.font = "italic 28px system-ui, sans-serif";
  let yd = arriba + 440;
  for (const l of lineas(ctx, `Defecto: ${f.defecto}`, W - 180, 2)) {
    ctx.fillText(l, W / 2, yd);
    yd += 38;
  }
  ctx.fillStyle = c.oro;
  ctx.font = "400 26px Cinzel";
  ctx.fillText("rol.webninja.fyi", W / 2, H - 58);
  return new Promise((ok) => lienzo.toBlob(ok, "image/png"));
}

export async function descargarPng(f, retratoUrl, nombre) {
  const blob = await dibujarFicha(f, retratoUrl, nombre);
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), { href: url, download: "ficha-de-rol.png" });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
