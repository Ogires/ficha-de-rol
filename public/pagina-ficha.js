import { pintarFicha, urlRetrato } from "/ficha.js";
import { descargarPng } from "/lienzo.js";

const id = location.pathname.split("/")[2] ?? "";
const contenedor = document.getElementById("ficha");
const estado = document.getElementById("estado");
const descargar = document.getElementById("descargar");

const r = await fetch(`/api/ficha/${encodeURIComponent(id)}`).catch(() => null);
if (!r?.ok) {
  const p = document.createElement("p");
  p.className = "pergamino";
  p.textContent = r?.status === 404 ? "Esta ficha no consta en el gremio." : "El oráculo no responde. Inténtalo en un rato.";
  contenedor.replaceChildren(p);
} else {
  const f = await r.json();
  document.title = `${f.clase} · nivel ${f.nivel.valor} · Ficha de Rol`;
  pintarFicha(contenedor, f);
  descargar.hidden = false;
  descargar.addEventListener("click", async () => {
    estado.textContent = "Pintando la imagen…";
    try {
      await descargarPng(f, urlRetrato(f));
      estado.textContent = "Imagen descargada.";
    } catch {
      estado.textContent = "No he podido pintar la imagen. Inténtalo otra vez.";
    }
  });
}
