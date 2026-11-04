import { describe, expect, it } from "vitest";
import { TERMINOS, validarCatalogo } from "../src/dominio/catalogo";
import { buscar, compilar } from "../src/dominio/motor";
import type { Termino } from "../src/dominio/tipos";

const t = (extra: Partial<Termino>): Termino => ({
  id: "java", nombre: "Java", patron: "Java", atributo: "FUE", tipo: "hechizo", epiteto: "de Java", ejemplos: ["Programo en Java"], ...extra,
});

describe("validarCatalogo", () => {
  it("acepta un catálogo correcto", () => {
    expect(validarCatalogo([t({}), t({ id: "react", nombre: "React", patron: "React", atributo: "DES", epiteto: "de React", ejemplos: ["Front con React"] })])).toEqual([]);
  });
  it("detecta ids repetidos, atributos y tipos inválidos, epítetos mal formados y patrones rotos", () => {
    const errores = validarCatalogo([
      t({}), t({}),
      t({ id: "x1", atributo: "LUK" as never }),
      t({ id: "x2", tipo: "pocion" as never }),
      t({ id: "x3", epiteto: "Java" }),
      t({ id: "x4", patron: "(" }),
    ]);
    expect(errores.join("\n")).toMatch(/java: id repetido/);
    expect(errores.join("\n")).toMatch(/x1: atributo/);
    expect(errores.join("\n")).toMatch(/x2: tipo/);
    expect(errores.join("\n")).toMatch(/x3: epíteto/);
    expect(errores.join("\n")).toMatch(/x4: patrón/);
  });
  it("cada ejemplo debe casar SOLO con su término", () => {
    const errores = validarCatalogo([
      t({ ejemplos: ["Uso JavaScript"] }), // no casa
      t({ id: "spring", nombre: "Spring", patron: "Spring", epiteto: "de Spring", ejemplos: ["Java con Spring"] }), // casa con dos
    ]);
    expect(errores).toHaveLength(2);
  });
});

describe("catálogo real (data/catalogo.json)", () => {
  it("es válido", () => {
    expect(validarCatalogo(TERMINOS)).toEqual([]);
  });
  it("tiene tamaño y reparto razonables", () => {
    expect(TERMINOS.length).toBeGreaterThanOrEqual(150);
    for (const a of ["FUE", "DES", "CON", "INT", "SAB", "CAR"]) {
      expect(TERMINOS.filter((x) => x.atributo === a).length, a).toBeGreaterThanOrEqual(12);
    }
  });
  it("APIs, pagos e integraciones suben INT (diseño de APIs); la integración continua sigue en SAB", () => {
    const C = compilar(TERMINOS);
    const atributos = (texto: string) => buscar(texto, C).map((m) => `${m.termino.id}:${m.termino.atributo}`);
    expect(atributos("Diseñé la API de cobros con Stripe y otras pasarelas de pago")).toEqual(["api:INT", "stripe:INT", "pagos:INT"]);
    expect(atributos("Integré el ERP con la integración continua y pruebas de integración")).toEqual(["integraciones:INT", "cicd:SAB", "tests:SAB"]);
    expect(atributos("integration tests and continuous integration")).toEqual(["tests:SAB", "cicd:SAB"]);
  });
  it("R no está (falsos positivos) y C/Go son exactos", () => {
    expect(TERMINOS.find((x) => x.patron === "R")).toBeUndefined();
    for (const id of ["c", "go"]) expect(TERMINOS.find((x) => x.id === id)?.exacto, id).toBe(true);
  });
});
