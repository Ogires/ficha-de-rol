// Render compartido por la portada y /f/{id}. Solo textContent y createElement: nunca innerHTML
export const ATRIBUTOS = ["FUE", "DES", "CON", "INT", "SAB", "CAR"];
export const NOMBRE_ATRIBUTO = { FUE: "Fuerza", DES: "Destreza", CON: "Constitución", INT: "Inteligencia", SAB: "Sabiduría", CAR: "Carisma" };
export const MAX_ATRIBUTO = 20;

const SVG = "http://www.w3.org/2000/svg";

function el(etiqueta, clase, texto) {
  const e = document.createElement(etiqueta);
  if (clase) e.className = clase;
  if (texto !== undefined) e.textContent = texto;
  return e;
}

function svg(etiqueta, atributos = {}, texto) {
  const e = document.createElementNS(SVG, etiqueta);
  for (const [k, v] of Object.entries(atributos)) e.setAttribute(k, String(v));
  if (texto !== undefined) e.textContent = texto;
  return e;
}

export const urlRetrato = (f) => (f.retrato.tipo === "propio" ? `/f/${f.id}/retrato.jpg` : f.retrato.ruta);

// Vértice i del hexágono (FUE arriba y en el sentido de las agujas del reloj) a la fracción t del radio
export function vertice(i, t, cx, cy, r) {
  const angulo = ((-90 + 60 * i) * Math.PI) / 180;
  return [cx + Math.cos(angulo) * r * t, cy + Math.sin(angulo) * r * t];
}

export const fraccion = (valor) => Math.max(0, Math.min(1, valor / MAX_ATRIBUTO));

function hexagono(f) {
  const C = 130, R = 86, ETIQUETA = 108;
  const lista = (t) => ATRIBUTOS.map((_, i) => vertice(i, t, C, C, R).map((n) => n.toFixed(1)).join(",")).join(" ");
  const resumen = ATRIBUTOS.map((a) => `${NOMBRE_ATRIBUTO[a]} ${f.atributos[a].valor}`).join(", ");
  const s = svg("svg", { class: "hexagono", viewBox: "0 0 260 260", role: "img", "aria-label": `Atributos: ${resumen}` });
  for (const t of [0.25, 0.5, 0.75, 1]) s.append(svg("polygon", { class: "hexagono__anillo", points: lista(t) }));
  ATRIBUTOS.forEach((_, i) => {
    const [x, y] = vertice(i, 1, C, C, R);
    s.append(svg("line", { class: "hexagono__eje", x1: C, y1: C, x2: x.toFixed(1), y2: y.toFixed(1) }));
  });
  const puntos = ATRIBUTOS.map((a, i) => vertice(i, fraccion(f.atributos[a].valor), C, C, R));
  s.append(svg("polygon", { class: "hexagono__area", points: puntos.map((p) => p.map((n) => n.toFixed(1)).join(",")).join(" ") }));
  for (const [x, y] of puntos) s.append(svg("circle", { class: "hexagono__punto", cx: x.toFixed(1), cy: y.toFixed(1), r: 3.5 }));
  ATRIBUTOS.forEach((a, i) => {
    const [x, y] = vertice(i, 1, C, C, ETIQUETA);
    const ancla = Math.abs(x - C) < 1 ? "middle" : x > C ? "start" : "end";
    const dx = ancla === "start" ? -6 : ancla === "end" ? 6 : 0;
    s.append(svg("text", { class: "hexagono__sigla", x: (x + dx).toFixed(1), y: (y - 6).toFixed(1), "text-anchor": ancla }, a));
    s.append(svg("text", { class: "hexagono__valor", x: (x + dx).toFixed(1), y: (y + 11).toFixed(1), "text-anchor": ancla }, String(f.atributos[a].valor)));
  });
  return s;
}

export function pintarFicha(contenedor, f, { nombre = "", retratoUrl = urlRetrato(f) } = {}) {
  contenedor.replaceChildren();
  const tarjeta = el("article", "ficha");

  const lado = el("div", "ficha__lado");
  const img = el("img", "ficha__retrato");
  img.src = retratoUrl;
  img.alt = `Retrato de ${f.clase}`;
  img.width = 512;
  img.height = 512;
  lado.append(img, hexagono(f));

  const cuerpo = el("div", "ficha__cuerpo");
  const cabecera = el("header", "ficha__cabecera");
  if (nombre) cabecera.append(el("p", "ficha__nombre", nombre));
  cabecera.append(el("h3", "ficha__clase", f.clase));
  const nivel = el("details", "ficha__nivel");
  nivel.append(el("summary", "", `Nivel ${f.nivel.valor}`), el("p", "", f.nivel.motivo));
  cabecera.append(nivel);
  if (f.origen === "manual") cabecera.append(el("p", "ficha__sello", "Tirada a mano: el oráculo descansa"));
  cuerpo.append(cabecera);

  const lista = el("ul", "ficha__atributos");
  lista.setAttribute("aria-label", "Atributos y por qué");
  for (const a of ATRIBUTOS) {
    const li = el("li");
    const d = el("details");
    const s = el("summary");
    const sigla = el("abbr", "", a);
    sigla.title = NOMBRE_ATRIBUTO[a];
    s.append(sigla, el("span", "ficha__valor", String(f.atributos[a].valor)));
    d.append(s, el("p", "", `¿Por qué? ${f.atributos[a].motivos.join(", ")}`));
    li.append(d);
    lista.append(li);
  }
  cuerpo.append(lista);

  const seccion = (titulo, items) => {
    if (!items.length) return;
    const s = el("section", "ficha__seccion");
    s.append(el("h4", "", titulo));
    const ul = el("ul");
    for (const { nombre: n, efecto } of items) {
      const li = el("li");
      li.append(el("strong", "", n), document.createTextNode(` · ${efecto}`));
      ul.append(li);
    }
    s.append(ul);
    cuerpo.append(s);
  };
  seccion("Hechizos", f.hechizos);
  seccion("Objetos", f.objetos);

  const trasfondo = el("section", "ficha__seccion");
  trasfondo.append(el("h4", "", "Trasfondo"), el("p", "", f.trasfondo));
  const defecto = el("section", "ficha__seccion ficha__defecto");
  defecto.append(el("h4", "", "Defecto"), el("p", "", f.defecto));
  cuerpo.append(trasfondo, defecto);

  tarjeta.append(lado, cuerpo);
  contenedor.append(tarjeta);
}
