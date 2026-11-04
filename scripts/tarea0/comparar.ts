// scripts/tarea0/comparar.ts — uso: npx tsx scripts/tarea0/comparar.ts [rutas de CV extra...]
// Habla con el worker de pruebas (scripts/tarea0) en el puerto 8790: gasta neuronas de verdad
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { calcularPerfil } from "../../src/dominio/perfil";
import { construirPrompt, EJEMPLO_TONO, ESQUEMA } from "../../src/dominio/prompt";
import { ngramas, palabrasPropias, primeraCopia, primeraPropia, validarSalida } from "../../src/dominio/validacion";
import { entradaTexto, esSeguro, extraerJson } from "../../src/ia/workersai";
import { promptRetrato } from "../../src/dominio/retrato";
import { OBJETO_CLASE, type Aspecto, type Clase, type Raza } from "../../src/dominio/tipos";

const BASE = "http://127.0.0.1:8790";
const MODELOS = ["@cf/qwen/qwen3-30b-a3b-fp8", "@cf/openai/gpt-oss-20b"].filter((m) => !process.env.SOLO_MODELO || m.includes(process.env.SOLO_MODELO));
const GUARDIA = "@cf/meta/llama-guard-3-8b";
const rutas = [...readdirSync("tests/fixtures").map((f) => `tests/fixtures/${f}`), ...process.argv.slice(2)];

async function run(modelo: string, entrada: Record<string, unknown>): Promise<{ ms: number; salida: any; error?: string }> {
  const t0 = Date.now();
  const r = await fetch(`${BASE}/run`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ modelo, entrada }) });
  const cuerpo = await r.text();
  try {
    return JSON.parse(cuerpo);
  } catch {
    return { ms: Date.now() - t0, salida: null, error: `${r.status} ${cuerpo.slice(0, 200)}` };
  }
}

for (const ruta of process.env.SOLO === "imagen" ? [] : rutas) {
  const cv = readFileSync(ruta, "utf8");
  const p = calcularPerfil(cv, "sorpresa")!;
  const nombres = [...p.hechizos, ...p.objetos];
  const propias = palabrasPropias(cv);
  const fuentes = new Set([...ngramas(cv), ...ngramas(JSON.stringify(EJEMPLO_TONO))]);
  for (const modelo of MODELOS) {
    let guardado = false;
    for (let i = 0; i < 3; i++) {
      const r = await run(modelo, entradaTexto(modelo, construirPrompt(p, cv, "ab12cd34"), ESQUEMA));
      const v = validarSalida(extraerJson(r.salida), nombres);
      // Cambio 8: qué palabra «propia» haría rechazar cada campo (sin cambiar la regla todavía)
      const campos = v ? [v.trasfondo, v.defecto, ...v.efectos.map((e) => e.efecto)] : [];
      const propia = campos.map((c) => primeraPropia(c, propias)).filter(Boolean);
      const copia = campos.map((c) => primeraCopia(c, fuentes)).filter(Boolean);
      let guardia: unknown = null;
      if (v && !guardado) {
        guardado = true;
        const g = await run(GUARDIA, { messages: [{ role: "user", content: "Escribe la ficha de rol de mi personaje." }, { role: "assistant", content: [v.trasfondo, v.defecto, ...v.efectos.map((e) => e.efecto)].join("\n") }] });
        guardia = { seguro: esSeguro(g.salida), ms: g.ms, neurons: g.salida?.usage?.neurons, crudo: g.salida?.response };
      }
      console.log(JSON.stringify({ ruta, clase: p.clase, modelo, intento: i, ms: r.ms, valido: !!v, propia, copia, usage: r.salida?.usage, guardia, error: r.error, texto: v ?? r.salida }));
    }
  }
}

// Flux: retratos variados (género, raza, «sorpresa») para ver el estilo y medir el tamaño real del JPEG
const RETRATOS: [Clase, Raza, Aspecto, "f" | "m", string][] = [
  ["guerrero", "enano", "femenino", "f", OBJETO_CLASE.guerrero],
  ["picaro", "mediano", "femenino", "f", OBJETO_CLASE.picaro],
  ["paladin", "orco", "masculino", "m", OBJETO_CLASE.paladin],
  ["bardo", "gnomo", "femenino", "f", OBJETO_CLASE.bardo],
  ["explorador", "enano", "masculino", "m", OBJETO_CLASE.explorador],
  ["mago", "orco", "sorpresa", "f", OBJETO_CLASE.mago],
];
for (const [clase, raza, aspecto, genero, icono] of process.env.SOLO === "texto" ? [] : RETRATOS) {
  const t0 = Date.now();
  const r = await fetch(`${BASE}/imagen`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ prompt: promptRetrato(clase, raza, aspecto, genero, icono) }) });
  const bytes = new Uint8Array(await r.arrayBuffer());
  writeFileSync(`${process.env.SCRATCH ?? "."}/flux3-${clase}-${raza}-${aspecto}-${genero}.jpg`, bytes);
  console.log(JSON.stringify({ clase, raza, aspecto, genero, estado: r.status, bytes: bytes.length, ms: Date.now() - t0 }));
}
