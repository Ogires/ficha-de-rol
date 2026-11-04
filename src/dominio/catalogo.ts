import datos from "../../data/catalogo.json";
import { buscar, compilar, type Compilado } from "./motor";
import { ATRIBUTOS, type Termino } from "./tipos";

export const TERMINOS = datos.terminos as Termino[];
export const COMPILADO: Compilado[] = compilar(TERMINOS);

const TIPOS = ["hechizo", "objeto", "senal"];

export function validarCatalogo(terminos: Termino[]): string[] {
  const errores: string[] = [];
  const ids = new Set<string>();
  const validos: Termino[] = [];
  for (const t of terminos) {
    if (ids.has(t.id)) errores.push(`${t.id}: id repetido`);
    ids.add(t.id);
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(t.id)) errores.push(`${t.id}: id no es kebab-case`);
    if (!ATRIBUTOS.includes(t.atributo)) errores.push(`${t.id}: atributo ${t.atributo}`);
    if (!TIPOS.includes(t.tipo)) errores.push(`${t.id}: tipo ${t.tipo}`);
    if (!/^(?:de|del|de la|de los|de las) \S/.test(t.epiteto)) errores.push(`${t.id}: epíteto «${t.epiteto}»`);
    if (!t.nombre?.trim() || t.nombre.length > 24) errores.push(`${t.id}: nombre`);
    if (!t.ejemplos?.length) errores.push(`${t.id}: sin ejemplos`);
    try {
      compilar([t]);
      validos.push(t);
    } catch {
      errores.push(`${t.id}: patrón inválido`);
    }
  }
  const todos = compilar(validos);
  for (const t of validos) {
    for (const ejemplo of t.ejemplos ?? []) {
      const m = buscar(ejemplo, todos);
      if (m.length !== 1 || m[0].termino.id !== t.id) {
        errores.push(`${t.id}: «${ejemplo}» → ${m.map((x) => x.termino.id).join(", ") || "nada"}`);
      }
    }
  }
  return errores;
}
