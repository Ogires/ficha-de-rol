import type { Detectado, Termino } from "./tipos";

export interface Compilado { termino: Termino; regex: RegExp }
export interface Coincidencia { inicio: number; fin: number; termino: Termino }

// Lookarounds con \p{L}\p{N} y flag u: el \b clásico toma las letras con tilde por separadores
export function compilar(terminos: Termino[]): Compilado[] {
  return terminos.map((termino) => ({
    termino,
    regex: new RegExp(`(?<![\\p{L}\\p{N}])(?:${termino.patron.replace(/ /g, "\\s+")})(?![\\p{L}\\p{N}])`, termino.exacto ? "gu" : "giu"),
  }));
}

export function buscar(texto: string, compilados: Compilado[]): Coincidencia[] {
  const todas: Coincidencia[] = [];
  for (const { termino, regex } of compilados) {
    regex.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = regex.exec(texto)) !== null) {
      todas.push({ inicio: m.index, fin: m.index + m[0].length, termino });
      if (m[0].length === 0) regex.lastIndex++;
    }
    regex.lastIndex = 0;
  }
  // por inicio y, a igual inicio, el más largo primero; luego se descartan los solapes
  todas.sort((a, b) => a.inicio - b.inicio || b.fin - a.fin);
  const sinSolapes: Coincidencia[] = [];
  let ultimoFin = -1;
  for (const c of todas) {
    if (c.inicio >= ultimoFin) {
      sinSolapes.push(c);
      ultimoFin = c.fin;
    }
  }
  return sinSolapes;
}

export function contar(coincidencias: Coincidencia[], catalogo: Termino[]): Detectado[] {
  const n = new Map<string, number>();
  for (const c of coincidencias) n.set(c.termino.id, (n.get(c.termino.id) ?? 0) + 1);
  return catalogo.filter((t) => n.has(t.id)).map((t) => ({ termino: t, menciones: n.get(t.id)! }));
}
