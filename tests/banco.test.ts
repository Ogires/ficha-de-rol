import { describe, expect, it } from "vitest";
import banco from "../data/banco.json";
import { campoManual, efectoManual, textoManual } from "../src/dominio/banco";
import { calcularPerfil } from "../src/dominio/perfil";
import { CLASES, ATRIBUTOS } from "../src/dominio/tipos";
import javaSenior from "./fixtures/java-senior.txt?raw";

const LARGO = { principal: "Arquitectura Hexagonal", clase: "Exploradora de la Observabilidad", nivel: "20", nombre: "Entity Framework Core" };
const rellenar = (s: string) => s.replace(/\{(\w+)\}/g, (_, k: string) => (LARGO as Record<string, string>)[k] ?? `{${k}}`);

describe("banco de frases", () => {
  it("tiene 5 trasfondos y 8 defectos por clase y 5 efectos por atributo", () => {
    for (const c of CLASES) {
      expect(banco.trasfondos[c], c).toHaveLength(5);
      expect(banco.defectos[c], c).toHaveLength(8);
    }
    for (const a of ATRIBUTOS) expect(banco.efectos[a], a).toHaveLength(5);
  });
  it("solo usa huecos conocidos y respeta los límites con los valores más largos", () => {
    for (const c of CLASES) {
      for (const s of banco.trasfondos[c]) expect(rellenar(s).length, s).toBeLessThanOrEqual(400);
      for (const s of banco.defectos[c]) expect(rellenar(s).length, s).toBeLessThanOrEqual(140);
      for (const s of [...banco.trasfondos[c], ...banco.defectos[c]]) expect(rellenar(s), s).not.toMatch(/[{}]/);
    }
    for (const a of ATRIBUTOS) for (const s of banco.efectos[a]) {
      expect(rellenar(s).length, s).toBeLessThanOrEqual(100);
      expect(rellenar(s), s).not.toMatch(/[{}]/);
    }
  });
  it("es determinista: el mismo CV da la misma ficha manual, con un efecto por hechizo y objeto", () => {
    const p = calcularPerfil(javaSenior, "sorpresa")!;
    expect(textoManual(p)).toEqual(textoManual(p));
    expect(textoManual(p).efectos.map((e) => e.nombre)).toEqual([...p.hechizos, ...p.objetos]);
    expect(campoManual(p, "defecto")).toBe(textoManual(p).defecto);
    expect(efectoManual(p, p.hechizos[0], 0)).toBe(textoManual(p).efectos[0].efecto);
  });
});
