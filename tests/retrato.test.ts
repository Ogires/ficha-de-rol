import { describe, expect, it } from "vitest";
import { ESTILO, promptRetrato, rutaGaleria } from "../src/dominio/retrato";
import { ASPECTOS, CLASES, OBJETO_CLASE, RAZAS } from "../src/dominio/tipos";

describe("retrato", () => {
  it("el prompt sale solo de vocabulario fijo, empieza por el estilo y pide la cara centrada", () => {
    for (const c of CLASES) for (const r of RAZAS) for (const a of ASPECTOS) for (const g of ["f", "m"] as const) {
      const p = promptRetrato(c, r, a, g, OBJETO_CLASE[c]);
      expect(p.startsWith(ESTILO)).toBe(true);
      expect(p).toMatch(/^[A-Za-z ,.'-]+$/); // ni acentos ni nada que venga de un CV
    }
    expect(ESTILO).toMatch(/face centered/);
  });
  it("sin firmas ni marcas de agua (Flux las pintaba aunque se pidiera «no text»)", () => {
    expect(ESTILO).toMatch(/no signature, no watermark/);
  });
  it("el género del retrato es el de la clase; sorpresa añade yelmo o capucha", () => {
    expect(promptRetrato("mago", "elfo", "femenino", "f", "a wooden staff")).toMatch(/A female elf wizard holding a wooden staff/);
    expect(promptRetrato("mago", "elfo", "masculino", "m", "a wooden staff")).toMatch(/A male elf wizard holding a wooden staff/);
    const sorpresa = promptRetrato("mago", "elfo", "sorpresa", "f", "a wooden staff");
    expect(sorpresa).toMatch(/A female elf wizard wearing a hood or helmet/);
    expect(promptRetrato("mago", "elfo", "femenino", "f", "a wooden staff")).not.toMatch(/hood|helmet/);
  });
  it("describe los rasgos de cada raza (Flux pintaba la mediana como una elfa y la enana como humana)", () => {
    expect(promptRetrato("picaro", "mediano", "femenino", "f", "twin daggers")).toMatch(/round ears/i);
    expect(promptRetrato("guerrero", "enano", "femenino", "f", "a longsword")).toMatch(/stout/i);
    expect(promptRetrato("paladin", "orco", "masculino", "m", "a tower shield")).toMatch(/green skin/i);
    expect(promptRetrato("mago", "humano", "masculino", "m", "a wooden staff")).toMatch(/holding a wooden staff\.$/);
  });
  it("ruta de la galería: una versión femenina y otra masculina por clase y raza", () => {
    expect(rutaGaleria("paladin", "enano", "f")).toBe("/galeria/paladin-enano-f.jpg");
    expect(rutaGaleria("paladin", "enano", "m")).toBe("/galeria/paladin-enano-m.jpg");
  });
});
