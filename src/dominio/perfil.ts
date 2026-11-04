import { COMPILADO } from "./catalogo";
import { buscar, contar, type Compilado } from "./motor";
import { aniosExperiencia } from "./anios";
import { fnv1a } from "./hash";
import { ATRIBUTOS, CLASE_DE, NOMBRE_CLASE, OBJETO_CLASE, type Aspecto, type Atributo, type Perfil } from "./tipos";

export const MIN_TERMINOS = 3;
const MAX_MENCIONES = 3;
const MAX_MOTIVOS = 5;

const SIN_MOTIVOS: Record<Atributo, string> = {
  FUE: "Ni rastro de lenguajes de servidor ni de bases de datos",
  DES: "Ni rastro de frontend",
  CON: "Tu CV no menciona tecnologías antiguas ni migraciones",
  INT: "Ni rastro de patrones ni de arquitectura",
  SAB: "Tu CV no menciona tests ni observabilidad",
  CAR: "Tu CV no menciona a ninguna persona",
};

const porAtributo = <T>(f: (a: Atributo) => T) => Object.fromEntries(ATRIBUTOS.map((a) => [a, f(a)])) as Record<Atributo, T>;

export const nivelDe = (anios: number) => Math.min(20, Math.max(1, anios));

export function calcularPerfil(texto: string, aspecto: Aspecto, hoy = new Date(), compilado: Compilado[] = COMPILADO): Perfil | null {
  // menciones desc; a igualdad, orden del catálogo (sort estable)
  const detectados = contar(buscar(texto, compilado), compilado.map((c) => c.termino)).sort((a, b) => b.menciones - a.menciones);
  if (detectados.length < MIN_TERMINOS) return null;

  const exp = aniosExperiencia(texto, hoy);
  const nivel = nivelDe(exp.anios);

  const puntos = porAtributo(() => 0);
  const menciones = porAtributo(() => 0);
  for (const d of detectados) {
    puntos[d.termino.atributo] += Math.min(d.menciones, MAX_MENCIONES);
    menciones[d.termino.atributo] += d.menciones;
  }
  const maximo = Math.max(...ATRIBUTOS.map((a) => puntos[a])); // > 0: hay ≥ 3 términos
  const techo = 10 + Math.floor(nivel / 2);
  const atributos = porAtributo((a) => {
    const nombres = detectados.filter((d) => d.termino.atributo === a).slice(0, MAX_MOTIVOS).map((d) => d.termino.nombre);
    return { valor: 6 + Math.round(((techo - 6) * puntos[a]) / maximo), motivos: nombres.length ? nombres : [SIN_MOTIVOS[a]] };
  });

  const fuerte = [...ATRIBUTOS].sort((a, b) => puntos[b] - puntos[a] || menciones[b] - menciones[a])[0];
  const claseBase = CLASE_DE[fuerte];
  const principal = detectados.find((d) => d.termino.atributo === fuerte)!.termino;
  const hash = fnv1a(texto.replace(/\s+/g, " ").trim());
  const genero = aspecto === "femenino" ? "f" : aspecto === "masculino" ? "m" : hash % 2 ? "f" : "m";

  return {
    detectados,
    anios: exp.anios,
    nivel: { valor: nivel, motivo: exp.motivo },
    atributos,
    claseBase,
    clase: `${NOMBRE_CLASE[claseBase][genero]} ${principal.epiteto}`,
    genero,
    principal,
    hechizos: detectados.filter((d) => d.termino.tipo === "hechizo").slice(0, 5).map((d) => d.termino.nombre),
    objetos: detectados.filter((d) => d.termino.tipo === "objeto").slice(0, 3).map((d) => d.termino.nombre),
    icono: principal.icono ?? OBJETO_CLASE[claseBase],
    hash,
  };
}
