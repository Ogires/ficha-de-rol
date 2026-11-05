// scripts/galeria.ts — genera la galería de respaldo con el worker de pruebas (scripts/tarea0, puerto 8790)
// 72 retratos: 6 clases × 6 razas × femenino/masculino, sin capucha. Cada uno gasta ~173 neuronas (4 teselas × 4 pasos).
// Uso: npx tsx scripts/galeria.ts <desde> <hasta>   (índices 0-72; 36 ≈ 6.220 neuronas: no más de 36 por día)
// Se salta los que ya existen: para regenerar uno, borra su fichero y vuelve a lanzar el rango
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { promptRetrato, rutaGaleria } from "../src/dominio/retrato";
import { CLASES, OBJETO_CLASE, RAZAS } from "../src/dominio/tipos";

const [desde = 0, hasta = 36] = process.argv.slice(2).map(Number);
const combos = CLASES.flatMap((clase) => RAZAS.flatMap((raza) => (["f", "m"] as const).map((genero) => ({ clase, raza, genero }))));
mkdirSync("public/galeria", { recursive: true });
for (const { clase, raza, genero } of combos.slice(desde, hasta)) {
  const destino = `public${rutaGaleria(clase, raza, genero)}`;
  if (existsSync(destino)) continue;
  const aspecto = genero === "f" ? "femenino" : "masculino";
  const r = await fetch("http://127.0.0.1:8790/imagen", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ prompt: promptRetrato(clase, raza, aspecto, genero, OBJETO_CLASE[clase]) }),
  });
  if (!r.ok) throw new Error(`${clase}-${raza}-${genero}: ${r.status}`);
  writeFileSync(destino, new Uint8Array(await r.arrayBuffer()));
  console.log(`✔ ${destino}`);
}
console.log(`Tramo ${desde}-${hasta} de ${combos.length} listo`);
