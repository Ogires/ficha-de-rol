import banco from "../../data/banco.json";
import type { Narrativa, Perfil } from "./tipos";

const elegir = (lista: string[], hash: number, sal: number) => lista[((hash ^ sal) >>> 0) % lista.length];

function rellenar(s: string, p: Perfil, extra: Record<string, string> = {}): string {
  const valores: Record<string, string> = { principal: p.principal.nombre, clase: p.clase, nivel: String(p.nivel.valor), ...extra };
  return s.replace(/\{(\w+)\}/g, (_, k: string) => valores[k] ?? "");
}

export function campoManual(p: Perfil, campo: "trasfondo" | "defecto"): string {
  const lista = campo === "trasfondo" ? banco.trasfondos[p.claseBase] : banco.defectos[p.claseBase];
  return rellenar(elegir(lista, p.hash, campo === "trasfondo" ? 0x9e37 : 0x85eb), p);
}

export function efectoManual(p: Perfil, nombre: string, i: number): string {
  const termino = p.detectados.find((d) => d.termino.nombre === nombre)?.termino;
  const lista = banco.efectos[termino?.atributo ?? p.principal.atributo];
  return rellenar(elegir(lista, p.hash, Math.imul(i + 1, 0x27d4eb2d)), p, { nombre });
}

export function textoManual(p: Perfil): Narrativa {
  return {
    trasfondo: campoManual(p, "trasfondo"),
    defecto: campoManual(p, "defecto"),
    efectos: [...p.hechizos, ...p.objetos].map((nombre, i) => ({ nombre, efecto: efectoManual(p, nombre, i) })),
  };
}
