// scripts/probar.ts — saca el perfil de las reglas (sin IA) de cualquier CV en local
// Uso: npm run probar -- <ruta> [femenino|masculino|sorpresa]
import { readFileSync } from "node:fs";
import { calcularPerfil } from "../src/dominio/perfil";
import { ATRIBUTOS, type Aspecto } from "../src/dominio/tipos";

const [ruta, aspecto = "sorpresa"] = process.argv.slice(2);
if (!ruta) {
  console.error("Uso: npm run probar -- <ruta-al-cv> [femenino|masculino|sorpresa]");
  process.exit(2);
}
const texto = readFileSync(ruta, "utf8");
const p = calcularPerfil(texto, aspecto as Aspecto);
if (!p) {
  console.log("Menos de 3 términos detectados: no hay ficha.");
  process.exit(1);
}
console.log(`\n${p.clase} · nivel ${p.nivel.valor}  (${p.nivel.motivo})`);
console.log(`Caracteres: ${texto.length}${texto.length > 12_000 ? "  ⚠ pasa del máximo de 12.000" : ""}\n`);
for (const a of ATRIBUTOS) console.log(`${a} ${String(p.atributos[a].valor).padStart(2)}  ${p.atributos[a].motivos.join(", ")}`);
console.log(`\nHechizos: ${p.hechizos.join(", ") || "—"}`);
console.log(`Objetos:  ${p.objetos.join(", ") || "—"}`);
console.log(`Retrato:  ${p.icono}`);
console.log(`\nDetectados: ${p.detectados.map((d) => `${d.termino.nombre}×${d.menciones}`).join(", ")}`);
