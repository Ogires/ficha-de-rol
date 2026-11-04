import { describe, expect, it } from "vitest";
import { ESTILO, promptRetrato, rutaGaleria } from "../src/dominio/retrato";
import { ASPECTOS, CLASES, OBJETO_CLASE, RAZAS } from "../src/dominio/tipos";

describe("retrato", () => {
  it("el prompt sale solo de vocabulario fijo, empieza por el estilo y pide la cara centrada", () => {
    for (const c of CLASES) for (const r of RAZAS) for (const a of ASPECTOS) {
      const p = promptRetrato(c, r, a, OBJETO_CLASE[c]);
      expect(p.startsWith(ESTILO)).toBe(true);
      expect(p).toMatch(/^[A-Za-z ,.'-]+$/); // ni acentos ni nada que venga de un CV
    }
    expect(ESTILO).toMatch(/face centered/);
  });
  it("sorpresa pide yelmo o capucha; femenino y masculino lo dicen", () => {
    expect(promptRetrato("mago", "elfo", "sorpresa", "a wooden staff")).toMatch(/hood or helmet/);
    expect(promptRetrato("mago", "elfo", "femenino", "a wooden staff")).toMatch(/female elf wizard/);
    expect(promptRetrato("mago", "elfo", "masculino", "a wooden staff")).toMatch(/male elf wizard/);
  });
  it("ruta de la galería", () => {
    expect(rutaGaleria("paladin", "enano")).toBe("/galeria/paladin-enano.jpg");
  });
});
