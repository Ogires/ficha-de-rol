import { describe, expect, it } from "vitest";
import { generar } from "../src/generar";
import { calcularPerfil } from "../src/dominio/perfil";
import { textoManual } from "../src/dominio/banco";
import { iaFalsa, narrativaPara } from "./helpers";
import javaSenior from "./fixtures/java-senior.txt?raw";

const p = calcularPerfil(javaSenior, "sorpresa")!;
const nombres = [...p.hechizos, ...p.objetos];
const base = { iaTexto: true, iaImagen: true, nonce: "ab12cd34" };

describe("generar", () => {
  it("camino feliz: narrativa de la IA y retrato propio, en paralelo", async () => {
    const { ia, llamadas } = iaFalsa({ texto: narrativaPara(nombres) });
    const g = await generar(javaSenior, p, "elfo", "sorpresa", { ...base, ia });
    expect(g.origen).toBe("ia");
    expect(g.narrativa.defecto).toBe("Pide perdón al compilador.");
    expect(g.retrato).toBeInstanceOf(Uint8Array);
    expect(g.fallos).toEqual([]);
    expect(llamadas).toMatchObject({ texto: 1, imagen: 1, guardia: 1 });
  });

  it("sin IA o sin cupo: banco y galería, sin llamar a nada", async () => {
    expect((await generar(javaSenior, p, "elfo", "sorpresa", { ...base, ia: null })).fallos).toEqual(["sin_ia"]);
    const { ia, llamadas } = iaFalsa();
    const g = await generar(javaSenior, p, "elfo", "sorpresa", { ...base, ia, iaTexto: false, iaImagen: false });
    expect(g).toMatchObject({ origen: "manual", retrato: null, narrativa: textoManual(p) });
    expect(g.fallos).toEqual(["texto_sin_cupo", "imagen_sin_cupo"]);
    expect(llamadas).toMatchObject({ texto: 0, imagen: 0 });
  });

  it.each([
    ["JSON inválido", { texto: { trasfondo: 3 } }, "texto_invalido"],
    ["error del modelo", { texto: new Error("caído") }, "texto_error"],
    ["timeout", { texto: new Error("timeout:texto") }, "texto_timeout"],
    ["Llama Guard marca", { guardia: false }, "guardia"],
    ["Llama Guard falla", { guardia: new Error("caído") }, "texto_error"],
  ])("%s → narrativa del banco", async (_n, o, fallo) => {
    const { ia } = iaFalsa({ texto: narrativaPara(nombres), ...o });
    const g = await generar(javaSenior, p, "elfo", "sorpresa", { ...base, ia });
    expect(g.origen).toBe("manual");
    expect(g.narrativa).toEqual(textoManual(p));
    expect(g.fallos).toContain(fallo);
  });

  it("una palabra propia en un campo cambia SOLO ese campo por el banco", async () => {
    const { ia } = iaFalsa({ texto: narrativaPara(nombres, { defecto: "Añora Villarrobledo." }) });
    const g = await generar(javaSenior, p, "elfo", "sorpresa", { ...base, ia });
    expect(g.origen).toBe("ia");
    expect(g.narrativa.trasfondo).toBe("Una leyenda que empezó en un sótano lleno de servidores.");
    expect(g.narrativa.defecto).toBe(textoManual(p).defecto);
    expect(g.fallos).toContain("propia_defecto");
  });

  it("un campo que copia 6 palabras seguidas del CV o del ejemplo de tono sale del banco", async () => {
    const { ia } = iaFalsa({
      texto: narrativaPara(nombres, {
        trasfondo: "Diseño servicios que aguantan picos de tráfico en todo el reino.",
        efectos: nombres.map((nombre, i) => ({ nombre, efecto: i === 0 ? "Encierra al bug en una caja de la que no sabe salir." : `${nombre} ilumina la mazmorra.` })),
      }),
    });
    const g = await generar(javaSenior, p, "elfo", "sorpresa", { ...base, ia });
    expect(g.origen).toBe("ia");
    expect(g.narrativa.trasfondo).toBe(textoManual(p).trasfondo);
    expect(g.narrativa.efectos[0].efecto).toBe(textoManual(p).efectos[0].efecto);
    expect(g.narrativa.efectos[1].efecto).toBe(`${nombres[1]} ilumina la mazmorra.`);
    expect(g.fallos).toEqual(expect.arrayContaining(["copia_trasfondo", "copia_efecto"]));
  });

  it("el retrato tiene el género de la clase; con sorpresa, además, capucha o yelmo", async () => {
    const { ia, llamadas } = iaFalsa({ texto: narrativaPara(nombres) });
    await generar(javaSenior, p, "elfo", "sorpresa", { ...base, ia });
    expect(llamadas.imagenes[0]).toMatch(new RegExp(`A ${p.genero === "f" ? "female" : "male"} elf`));
    expect(llamadas.imagenes[0]).toMatch(/hood or helmet/);
    const pf = calcularPerfil(javaSenior, "femenino")!;
    const otra = iaFalsa({ texto: narrativaPara(nombres) });
    await generar(javaSenior, pf, "orco", "femenino", { ...base, ia: otra.ia });
    expect(otra.llamadas.imagenes[0]).toMatch(/A female orc warrior holding .*Green skin/);
  });

  it("si falla Flux, el texto de la IA sigue y el retrato pasa a la galería", async () => {
    const { ia } = iaFalsa({ texto: narrativaPara(nombres), imagen: new Error("flux") });
    const g = await generar(javaSenior, p, "elfo", "sorpresa", { ...base, ia });
    expect(g).toMatchObject({ origen: "ia", retrato: null });
    expect(g.fallos).toEqual(["imagen_error"]);
  });

  it("sin hueco para imágenes (tope de bytes): texto con IA, retrato de galería", async () => {
    const { ia, llamadas } = iaFalsa({ texto: narrativaPara(nombres) });
    const g = await generar(javaSenior, p, "elfo", "sorpresa", { ...base, ia, iaImagen: false });
    expect(g.origen).toBe("ia");
    expect(llamadas.imagen).toBe(0);
  });
});
