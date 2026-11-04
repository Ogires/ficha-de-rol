import { textoDePdf } from "/pdf.js";
import { pintarFicha, urlRetrato } from "/ficha.js";
import { descargarPng } from "/lienzo.js";

const MAX = 12000;
const $ = (id) => document.getElementById(id);
const texto = $("texto"), contador = $("contador"), estado = $("estado"), boton = $("tirar");
let ultima = null;

const avisar = (mensaje) => (estado.textContent = mensaje);
const contar = () => (contador.textContent = `${texto.value.length.toLocaleString("es-ES")} / 12.000`);
texto.addEventListener("input", contar);

$("pdf").addEventListener("change", async (e) => {
  const archivo = e.target.files?.[0];
  if (!archivo) return;
  avisar("Leyendo el PDF en tu navegador…");
  try {
    let t = await textoDePdf(archivo);
    if (t.length < 200) return avisar("Este PDF no tiene texto (¿está escaneado?). Pega tu CV a mano.");
    if (t.length > MAX) {
      avisar(`Tu CV tiene ${t.length.toLocaleString("es-ES")} caracteres: uso los primeros 12.000.`);
      t = t.slice(0, MAX);
    } else avisar("PDF leído. Revisa el texto y tira iniciativa.");
    texto.value = t;
    contar();
  } catch (err) {
    avisar(`No he podido leer el PDF: ${err.message}. Pega tu CV a mano.`);
  }
});

const MENSAJES = {
  400: "Pega entre 200 y 12.000 caracteres y elige raza y aspecto.",
  422: "No encuentro tecnologías en el texto. ¿Seguro que es un CV?",
  429: "Has tirado demasiados dados por hoy. Vuelve mañana.",
};

let tirando = false;

$("formulario").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (tirando) return;
  const datos = new FormData(e.target);
  if (texto.value.trim().length < 200) {
    texto.setAttribute("aria-invalid", "true");
    texto.focus();
    return avisar("Pega al menos 200 caracteres de tu CV: con tan poco no hay ficha.");
  }
  texto.removeAttribute("aria-invalid");
  // aria-disabled y no disabled: el botón conserva el foco de quien navega con teclado
  tirando = true;
  boton.setAttribute("aria-disabled", "true");
  document.body.classList.add("tirando"); // anima el d20 (respeta prefers-reduced-motion en CSS)
  avisar("Tirando iniciativa…");
  try {
    const r = await fetch("/api/ficha", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ texto: texto.value, raza: datos.get("raza"), aspecto: datos.get("aspecto") }),
    });
    const cuerpo = await r.json().catch(() => ({}));
    if (!r.ok) return avisar(cuerpo.mensaje ?? MENSAJES[r.status] ?? "El oráculo no responde. Inténtalo en un rato.");
    ultima = cuerpo;
    pintarFicha($("ficha"), cuerpo.ficha, { nombre: $("nombre").value.trim() });
    $("resultado").hidden = false;
    $("copiar").disabled = !cuerpo.id;
    avisar(cuerpo.id ? "¡Ficha lista!" : "Ficha lista, pero no he podido guardarla: descarga la imagen. No hay enlace que copiar.");
    $("resultado").scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    $("titulo-resultado").focus({ preventScroll: true }); // el lector de pantalla llega a la ficha
  } catch {
    avisar("Se ha cortado la conexión. Inténtalo otra vez.");
  } finally {
    tirando = false;
    boton.removeAttribute("aria-disabled");
    document.body.classList.remove("tirando");
  }
});

$("descargar").addEventListener("click", async () => {
  if (!ultima) return;
  avisar("Pintando la imagen…");
  try {
    await descargarPng(ultima.ficha, urlRetrato(ultima.ficha), $("nombre").value.trim());
    avisar("Imagen descargada.");
  } catch {
    avisar("No he podido pintar la imagen. Inténtalo otra vez.");
  }
});
$("copiar").addEventListener("click", async () => {
  if (!ultima?.id) return;
  try {
    await navigator.clipboard.writeText(`${location.origin}/f/${ultima.id}`);
    avisar("Enlace copiado.");
  } catch {
    avisar(`Copia este enlace: ${location.origin}/f/${ultima.id}`);
  }
});
contar();
