import { describe, expect, it } from "vitest";
import { aniosExperiencia } from "../src/dominio/anios";

const HOY = new Date("2026-11-04T12:00:00Z");
const anios = (texto: string) => aniosExperiencia(texto, HOY);

describe("aniosExperiencia", () => {
  it("suma rangos fusionando los que se tocan y excluye la formación", () => {
    const cv = [
      "## Experiencia laboral",
      "### Analista · Empresa A (03/2020 – actualidad)",
      "### Analista · Empresa B (06/2017 – 03/2020)",
      "### Desarrollador · Empresa C (02/2014 – 06/2017)",
      "### Desarrollador · Empresa D (09/2009 – 02/2014)",
      "## Formación académica",
      "- Ingeniería Técnica (2005 – 2010)",
      "- Técnico Superior (2003 – 2005)",
    ].join("\n");
    expect(anios(cv)).toMatchObject({ anios: 17, fuente: "rangos" });
  });

  it("no cuenta dos veces los solapes", () => {
    expect(anios("Experiencia\n01/2010 – 12/2015\n06/2012 – 06/2014").anios).toBe(5);
  });

  it("entiende años sueltos y meses con nombre en español e inglés", () => {
    expect(anios("Experiencia\nEmpresa (2016 - 2018)").anios).toBe(2);
    expect(anios("Experience\nCompany, Jan 2015 – Present").anios).toBe(11);
    expect(anios("Experience\nMarch 2010 - June 2012").anios).toBe(2);
    expect(anios("Experiencia\nenero de 2020 a la actualidad").anios).toBe(6);
  });

  it("la sección Education/Certificaciones no cuenta; volver a Experience sí", () => {
    const cv = "Education\nBSc, 2010 - 2014\nProfessional Experience\nDev, 2015 - 2020";
    expect(anios(cv).anios).toBe(5);
  });

  it("una línea corta que empieza por otra palabra no abre la formación", () => {
    expect(anios("Experiencia\nFormador de cursos de React\nEmpresa (2016 - 2018)").anios).toBe(2);
  });

  it("usa la frase «N años de experiencia» si no hay fechas, y la mayor si hay ambas", () => {
    expect(anios("Desarrolladora con más de 12 años de experiencia en Python")).toMatchObject({ anios: 12, fuente: "frase" });
    expect(anios("15+ years of experience")).toMatchObject({ anios: 15, fuente: "frase" });
    expect(anios("Más de 12 años de experiencia\nExperiencia\n09/2009 – actualidad")).toMatchObject({ anios: 17, fuente: "rangos" });
  });

  it("sin fechas ni frase: 0 años y un motivo que pide añadirlas", () => {
    const r = anios("Me encanta Python y Django");
    expect(r).toMatchObject({ anios: 0, fuente: "ninguna" });
    expect(r.motivo).toMatch(/añade/i);
  });

  it("ignora fechas imposibles (futuro, antes de 1960, fin antes que inicio)", () => {
    expect(anios("Experiencia\n2025 - 2030\n1950 - 1955\n2020 - 2018").anios).toBe(0);
  });
});
