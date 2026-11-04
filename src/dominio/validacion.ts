import { COMPILADO } from "./catalogo";
import { buscar, type Compilado } from "./motor";
import { recortar } from "./texto";
import type { Narrativa } from "./tipos";

export const LIMITES = { trasfondo: 400, defecto: 140, efecto: 100 } as const;
const PROHIBIDO = /https?:|www\.|@|[<>]/i;

function campo(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const s = v.replace(/\s+/g, " ").trim();
  if (!s || s.length > max * 2 || PROHIBIDO.test(s)) return null;
  return recortar(s, max);
}

// LLM05: la salida de la IA se valida entera; cualquier desviación → banco de frases
export function validarSalida(bruto: unknown, nombres: string[]): Narrativa | null {
  if (!bruto || typeof bruto !== "object" || Array.isArray(bruto)) return null;
  const o = bruto as Record<string, unknown>;
  const trasfondo = campo(o.trasfondo, LIMITES.trasfondo);
  const defecto = campo(o.defecto, LIMITES.defecto);
  if (!trasfondo || !defecto || !Array.isArray(o.efectos) || o.efectos.length !== nombres.length) return null;
  const porNombre = new Map<string, string>();
  for (const e of o.efectos) {
    if (!e || typeof e !== "object") return null;
    const { nombre, efecto } = e as Record<string, unknown>;
    const texto = campo(efecto, LIMITES.efecto);
    if (typeof nombre !== "string" || !nombres.includes(nombre) || porNombre.has(nombre) || !texto) return null;
    porNombre.set(nombre, texto);
  }
  return { trasfondo, defecto, efectos: nombres.map((n) => ({ nombre: n, efecto: porNombre.get(n)! })) };
}

// Siglas habituales que la IA puede usar sin delatar a nadie
const GENERICAS = new Set(["ia", "ai", "api", "apis", "erp", "crm", "pos", "rrhh", "hr", "ux", "ui", "qa", "saas", "b2b", "b2c", "ceo", "cto", "cfo", "pm", "po", "it", "ti", "tic", "rest", "pdf", "seo", "sql"]);
const PALABRA = /\p{L}[\p{L}\p{N}]*/gu;

// LLM02: palabras que en el CV van SIEMPRE con mayúscula (nombres de personas, empresas, ciudades),
// salvo términos del catálogo y siglas genéricas. Se comparan en minúscula
export function palabrasPropias(cv: string, compilado: Compilado[] = COMPILADO): Set<string> {
  const delCatalogo = new Set<string>();
  for (const c of buscar(cv, compilado)) for (const w of cv.slice(c.inicio, c.fin).match(PALABRA) ?? []) delCatalogo.add(w.toLowerCase());
  const minusculas = new Set<string>();
  const mayusculas = new Set<string>();
  for (const w of cv.match(PALABRA) ?? []) (/^\p{Lu}/u.test(w) ? mayusculas : minusculas).add(w.toLowerCase());
  const propias = new Set<string>();
  for (const w of mayusculas) if (w.length >= 2 && !minusculas.has(w) && !delCatalogo.has(w) && !GENERICAS.has(w)) propias.add(w);
  return propias;
}

export function primeraPropia(texto: string, propias: Set<string>): string | null {
  for (const w of texto.match(PALABRA) ?? []) if (propias.has(w.toLowerCase())) return w;
  return null;
}
