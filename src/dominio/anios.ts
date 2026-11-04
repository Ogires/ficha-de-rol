const MESES: Record<string, number> = {
  ene: 1, enero: 1, jan: 1, january: 1, feb: 2, febrero: 2, february: 2, mar: 3, marzo: 3, march: 3,
  abr: 4, abril: 4, apr: 4, april: 4, may: 5, mayo: 5, jun: 6, junio: 6, june: 6, jul: 7, julio: 7, july: 7,
  ago: 8, agosto: 8, aug: 8, august: 8, sep: 9, sept: 9, septiembre: 9, setiembre: 9, september: 9,
  oct: 10, octubre: 10, october: 10, nov: 11, noviembre: 11, november: 11, dic: 12, diciembre: 12, dec: 12, december: 12,
};

const ANIO = String.raw`(?:19|20)\d{2}`;
const FECHA = String.raw`(?<![\p{L}\p{N}])(?:\d{1,2}\/${ANIO}|\p{L}{3,10}\.?\s+(?:de\s+)?${ANIO}|${ANIO})`;
const AHORA = String.raw`(?:la\s+)?(?:actualidad|actual|presente|hoy|present|now|current|today)`;
const RANGO = new RegExp(String.raw`(${FECHA})\s*(?:[–—-]|\s(?:a|al|hasta|to|until)\s)\s*(${FECHA}|${AHORA})(?![\p{L}\p{N}])`, "giu");
const ES_AHORA = new RegExp(`^${AHORA}$`, "iu");
const FRASE = /(\d{1,2})\s*\+?\s*(?:años|years)\s+(?:de\s+|of\s+)?(?:experiencia|experience)/giu;

// Cabeceras: líneas cortas, sin viñeta, sin año y sin puntuación final. Se miran por su primera palabra
const CAB_FORMACION = /^\P{L}*(?:formaci[oó]n|educaci[oó]n|estudios|titulaci|certificac|cursos|academic|education|certification|courses|training)/iu;
const CAB_OTRA = /^\P{L}*(?:experiencia|experience|professional|work|trayectoria|empleo|employment|habilidades|skills|competencias|proyectos|projects|idiomas|languages|perfil|profile|sobre\s+m[ií]|about|resumen|summary|freelance|tecnolog)/iu;

function esCabecera(linea: string): boolean {
  const l = linea.replace(/^#{1,6}\s*/, "").trim();
  return l.length > 0 && l.length <= 50 && !/^[-*•·]/.test(l) && !/[.;:,]$/.test(l) && !/(?:19|20)\d{2}/.test(l);
}

// Meses desde el año 0: año × 12 + (mes − 1). Un año suelto cuenta como enero
function aMeses(s: string, ahora: number): number | null {
  const t = s.trim().toLowerCase();
  if (ES_AHORA.test(t)) return ahora;
  let m = /^(\d{1,2})\/(\d{4})$/.exec(t);
  if (m) {
    const mes = Number(m[1]);
    return mes >= 1 && mes <= 12 ? Number(m[2]) * 12 + mes - 1 : null;
  }
  m = /^(\p{L}+)\.?\s+(?:de\s+)?(\d{4})$/u.exec(t);
  if (m) return Number(m[2]) * 12 + (MESES[m[1]] ?? 1) - 1; // palabra desconocida → solo el año
  m = /^(\d{4})$/.exec(t);
  return m ? Number(m[1]) * 12 : null;
}

function sumarFusionados(intervalos: [number, number][]): number {
  let total = 0, ini = -1, fin = -1;
  for (const [a, b] of [...intervalos].sort((x, y) => x[0] - y[0])) {
    if (a > fin) {
      total += fin - ini;
      ini = a;
      fin = b;
    } else fin = Math.max(fin, b);
  }
  return total + (fin - ini);
}

const plural = (n: number) => `${n} ${n === 1 ? "año" : "años"}`;

export interface Experiencia { anios: number; fuente: "rangos" | "frase" | "ninguna"; motivo: string }

export function aniosExperiencia(texto: string, hoy = new Date()): Experiencia {
  const ahora = hoy.getUTCFullYear() * 12 + hoy.getUTCMonth();
  const intervalos: [number, number][] = [];
  let enFormacion = false;
  for (const linea of texto.split(/\r?\n/)) {
    if (esCabecera(linea)) {
      if (CAB_FORMACION.test(linea.replace(/^#{1,6}\s*/, ""))) enFormacion = true;
      else if (CAB_OTRA.test(linea.replace(/^#{1,6}\s*/, ""))) enFormacion = false;
      continue;
    }
    if (enFormacion) continue;
    for (const m of linea.matchAll(RANGO)) {
      const ini = aMeses(m[1], ahora);
      const fin = aMeses(m[2], ahora);
      if (ini !== null && fin !== null && ini <= fin && ini >= 1960 * 12 && fin <= ahora) intervalos.push([ini, fin]);
    }
  }
  const porRangos = intervalos.length ? Math.floor(sumarFusionados(intervalos) / 12) : -1;
  const porFrase = Math.max(-1, ...[...texto.matchAll(FRASE)].map((m) => Number(m[1])));

  if (porRangos < 0 && porFrase < 0) {
    return { anios: 0, fuente: "ninguna", motivo: "No encuentro fechas en tu CV: añade tus fechas o «N años de experiencia» para subir de nivel" };
  }
  if (porRangos >= porFrase) {
    return { anios: porRangos, fuente: "rangos", motivo: porRangos === 0 ? "Menos de un año de experiencia según las fechas de tu CV" : `${plural(porRangos)} de experiencia según las fechas de tu CV` };
  }
  return { anios: porFrase, fuente: "frase", motivo: `${plural(porFrase)} de experiencia, según dice tu CV` };
}
