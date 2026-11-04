import { COMPILADO } from "./catalogo";
import { buscar, type Compilado } from "./motor";
import { sanear } from "./saneado";
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
    const { nombre: bruto, efecto } = e as Record<string, unknown>;
    const nombre = typeof bruto === "string" ? bruto.trim() : bruto; // gpt-oss a veces devuelve " .NET Core"
    const texto = campo(efecto, LIMITES.efecto);
    if (typeof nombre !== "string" || !nombres.includes(nombre) || porNombre.has(nombre) || !texto) return null;
    porNombre.set(nombre, texto);
  }
  return { trasfondo, defecto, efectos: nombres.map((n) => ({ nombre: n, efecto: porNombre.get(n)! })) };
}

// Siglas habituales que la IA puede usar sin delatar a nadie
const GENERICAS = new Set(["ia", "ai", "api", "apis", "erp", "crm", "pos", "rrhh", "hr", "ux", "ui", "qa", "saas", "b2b", "b2c", "ceo", "cto", "cfo", "pm", "po", "it", "ti", "tic", "rest", "pdf", "seo", "sql"]);
const PALABRA = /\p{L}[\p{L}\p{N}]*/gu;

// Lo que puede ir delante de la primera palabra de una línea: viñetas, almohadillas, negritas, numeración
const SOLO_MARCAS = /^[\s\-*#>•\d.)]*$/;
const FIN_DE_FRASE = /[.!?:;]["»”*]*$/;

// Una mayúscula al inicio de línea, viñeta o frase no prueba que la palabra sea un nombre («Experiencia»,
// «Construyo», «Si»), salvo que la siga otra palabra con mayúscula, como en «Lucía Ferrándiz»
function mayusculaQueCuenta(linea: string, palabras: RegExpMatchArray[], i: number): boolean {
  const m = palabras[i];
  const antes = linea.slice(0, m.index).replace(/\s+$/, "");
  if (!SOLO_MARCAS.test(antes) && !FIN_DE_FRASE.test(antes)) return true;
  const sig = palabras[i + 1];
  return !!sig && /^\s+$/.test(linea.slice(m.index! + m[0].length, sig.index)) && /^\p{Lu}\p{Ll}/u.test(sig[0]);
}

// LLM02: palabras que en el CV van SIEMPRE con mayúscula (nombres de personas, empresas, ciudades),
// salvo términos del catálogo y siglas genéricas. Se comparan en minúscula
export function palabrasPropias(cv: string, compilado: Compilado[] = COMPILADO): Set<string> {
  const delCatalogo = new Set<string>();
  for (const c of buscar(cv, compilado)) for (const w of cv.slice(c.inicio, c.fin).match(PALABRA) ?? []) delCatalogo.add(w.toLowerCase());
  const minusculas = new Set<string>();
  const mayusculas = new Set<string>();
  // Sin enlaces ni emails: «linkedin.com/in/ana-ferrer» no prueba que «ana» sea una palabra normal
  for (const linea of sanear(cv).split(/\r?\n/)) {
    const palabras = [...linea.matchAll(PALABRA)];
    palabras.forEach((m, i) => {
      const w = m[0].toLowerCase();
      if (!/^\p{Lu}/u.test(m[0])) minusculas.add(w);
      else if (mayusculaQueCuenta(linea, palabras, i)) mayusculas.add(w);
    });
  }
  const propias = new Set<string>();
  for (const w of mayusculas) if (w.length >= 2 && !minusculas.has(w) && !delCatalogo.has(w) && !GENERICAS.has(w)) propias.add(w);
  return propias;
}

export function primeraPropia(texto: string, propias: Set<string>): string | null {
  for (const w of texto.match(PALABRA) ?? []) if (propias.has(w.toLowerCase())) return w;
  return null;
}

// Regla 3 del prompt («no copies frases del CV»), comprobada: un campo que repite LARGO_COPIA palabras
// seguidas del CV o del ejemplo de tono sale del banco. En la 0B, qwen copiaba frases enteras de ambos
const LARGO_COPIA = 6;
const PALABRA_O_NUMERO = /\p{L}[\p{L}\p{N}]*|\p{N}+/gu;

export function ngramas(texto: string, n = LARGO_COPIA): Set<string> {
  const w = (texto.toLowerCase().match(PALABRA_O_NUMERO) ?? []) as string[];
  const r = new Set<string>();
  for (let i = 0; i + n <= w.length; i++) r.add(w.slice(i, i + n).join(" "));
  return r;
}

export function primeraCopia(texto: string, fuente: Set<string>, n = LARGO_COPIA): string | null {
  for (const g of ngramas(texto, n)) if (fuente.has(g)) return g;
  return null;
}
