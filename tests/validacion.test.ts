import { describe, expect, it } from "vitest";
import { palabrasPropias, primeraPropia, validarSalida } from "../src/dominio/validacion";
import javaSenior from "./fixtures/java-senior.txt?raw";

const NOMBRES = ["Java", "Docker"];
const valida = { trasfondo: "Una leyenda del backend.", defecto: "Cuenta los bytes.", efectos: [{ nombre: "Docker", efecto: "Encierra al bug." }, { nombre: "Java", efecto: "Lanza una excepción." }] };

describe("validarSalida", () => {
  it("acepta la forma correcta y ordena los efectos como los nombres", () => {
    expect(validarSalida(valida, NOMBRES)?.efectos.map((e) => e.nombre)).toEqual(["Java", "Docker"]);
  });
  it("rechaza nombres inventados, repetidos o que faltan", () => {
    expect(validarSalida({ ...valida, efectos: [{ nombre: "Kubernetes", efecto: "x" }, valida.efectos[1]] }, NOMBRES)).toBeNull();
    expect(validarSalida({ ...valida, efectos: [valida.efectos[1], valida.efectos[1]] }, NOMBRES)).toBeNull();
    expect(validarSalida({ ...valida, efectos: [valida.efectos[1]] }, NOMBRES)).toBeNull();
  });
  it("acepta nombres con espacios a los lados (gpt-oss devolvió \" .NET Core\")", () => {
    const r = validarSalida({ ...valida, efectos: [{ nombre: " Docker ", efecto: "Encierra al bug." }, valida.efectos[1]] }, NOMBRES);
    expect(r?.efectos.map((e) => e.nombre)).toEqual(["Java", "Docker"]);
  });
  it("rechaza enlaces, emails, HTML y textos de más del doble del límite; recorta los algo largos", () => {
    expect(validarSalida({ ...valida, defecto: "Visita https://x.com" }, NOMBRES)).toBeNull();
    expect(validarSalida({ ...valida, defecto: "<b>hola</b>" }, NOMBRES)).toBeNull();
    expect(validarSalida({ ...valida, defecto: "a ".repeat(150) }, NOMBRES)).toBeNull(); // 300 > 2 × 140
    const r = validarSalida({ ...valida, defecto: "palabra ".repeat(22) }, NOMBRES)!; // 176: entre 140 y 280
    expect(r.defecto.length).toBeLessThanOrEqual(140);
    expect(r.defecto.endsWith("…")).toBe(true);
  });
  it("rechaza lo que no es un objeto", () => {
    expect(validarSalida(null, NOMBRES)).toBeNull();
    expect(validarSalida("texto", NOMBRES)).toBeNull();
  });
});

describe("palabras propias", () => {
  const propias = palabrasPropias(javaSenior);
  it("detecta el nombre, la empresa y la ciudad inventados del CV", () => {
    for (const w of ["lucía", "ferrándiz", "zarandaja", "villarrobledo"]) expect(propias.has(w), w).toBe(true);
  });
  it("no marca términos del catálogo, palabras que también salen en minúscula ni siglas genéricas", () => {
    for (const w of ["java", "spring", "postgresql", "ia", "api"]) expect(propias.has(w), w).toBe(false);
  });
  it("el nombre en minúscula dentro de un enlace o un email no lo hace palabra normal", () => {
    const p = palabrasPropias("# Ana Ferrer Llopis\nlinkedin.com/in/ana-ferrer-llopis · ana.ferrer@correo.es\nProgramo en Java");
    for (const w of ["ana", "ferrer", "llopis"]) expect(p.has(w), w).toBe(true);
  });
  it("una mayúscula al inicio de línea, viñeta o frase no prueba nada; nombre y apellido sí", () => {
    const cv = [
      "Experiencia",
      "- Construyo componentes. Me gusta el café.",
      "Si te interesa, escríbeme.",
      "### Analista · Brezales, Valdecuervo (2018 – 2019)",
      "Marta Quiñones",
    ].join("\n");
    const p = palabrasPropias(cv);
    for (const w of ["experiencia", "construyo", "me", "si"]) expect(p.has(w), w).toBe(false);
    for (const w of ["brezales", "valdecuervo", "marta", "quiñones"]) expect(p.has(w), w).toBe(true);
  });
  it("primeraPropia encuentra la palabra aunque venga en minúscula", () => {
    expect(primeraPropia("Fue escudera en zarandaja durante años", propias)).toBe("zarandaja");
    expect(primeraPropia("Una leyenda del backend", propias)).toBeNull();
  });
});
