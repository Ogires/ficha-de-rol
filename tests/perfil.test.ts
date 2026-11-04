import { describe, expect, it } from "vitest";
import { calcularPerfil } from "../src/dominio/perfil";
import { compilar } from "../src/dominio/motor";
import type { Termino } from "../src/dominio/tipos";
// Vite importa ficheros como texto con ?raw (funciona dentro del pool de Workers)
import juniorFrontend from "./fixtures/junior-frontend.txt?raw";
import javaSenior from "./fixtures/java-senior.txt?raw";
import cobolVeterano from "./fixtures/cobol-veterano.txt?raw";
import liderEquipo from "./fixtures/lider-equipo.txt?raw";
import acercaDe from "./fixtures/acerca-de.txt?raw";
import english from "./fixtures/english.txt?raw";

const HOY = new Date("2026-11-04T12:00:00Z");
const t = (id: string, atributo: Termino["atributo"], extra: Partial<Termino> = {}): Termino => ({
  id, nombre: id, patron: id, atributo, tipo: "hechizo", epiteto: `de ${id}`, ejemplos: [], ...extra,
});
const MINI = compilar([
  t("java", "FUE", { icono: "a steaming coffee mug" }), t("react", "DES"), t("cobol", "CON"), t("kubernetes", "INT", { tipo: "objeto" }),
  t("playwright", "SAB", { tipo: "objeto" }), t("mentoria", "CAR", { nombre: "mentoría", patron: "mentor[ií]a", tipo: "senal", epiteto: "de la Mentoría" }),
  t("python", "FUE"), t("go", "FUE"), t("rust", "FUE"), t("php", "FUE"), t("ruby", "FUE"),
  t("git", "SAB", { tipo: "objeto" }), t("docker", "SAB", { tipo: "objeto" }), t("jira", "CAR", { tipo: "objeto" }),
]);
const perfil = (texto: string, aspecto: "femenino" | "masculino" | "sorpresa" = "masculino") => calcularPerfil(texto, aspecto, HOY, MINI);

describe("reglas con catálogo mínimo", () => {
  it("menos de 3 términos distintos → null", () => {
    expect(perfil("java java react")).toBeNull();
  });

  it("techo por nivel, máximo de 3 menciones por término y 6 sin términos", () => {
    const p = perfil("10 años de experiencia. java java java java java, react, kubernetes")!;
    expect(p.nivel.valor).toBe(10); // techo = 10 + 5 = 15
    expect(p.atributos.FUE.valor).toBe(15); // 3 puntos (tope) = el máximo
    expect(p.atributos.DES.valor).toBe(9); // 6 + round(9 × 1/3)
    expect(p.atributos.CON).toEqual({ valor: 6, motivos: ["Tu CV no menciona tecnologías antiguas ni migraciones"] });
    expect(p.atributos.CAR.motivos).toEqual(["Tu CV no menciona a ninguna persona"]);
    expect(p.clase).toBe("Guerrero de java");
  });

  it("empates: más menciones sin tope y, si no, el orden de la tabla", () => {
    expect(perfil("java java java java react react react kubernetes")!.claseBase).toBe("guerrero"); // 3=3 puntos; 4>3 menciones
    expect(perfil("react cobol kubernetes")!.claseBase).toBe("picaro"); // empate total → DES antes que CON e INT
  });

  it("la clase concuerda con el aspecto; con sorpresa la decide el hash, siempre igual", () => {
    expect(perfil("react react react java kubernetes", "femenino")!.clase).toBe("Pícara de react");
    const a = perfil("cobol cobol java react", "sorpresa")!;
    const b = perfil("cobol cobol java react", "sorpresa")!;
    expect(a.genero).toBe(b.genero);
    expect(["Paladín de cobol", "Paladina de cobol"]).toContain(a.clase);
  });

  it("epíteto de una señal e icono de la clase si el término no tiene", () => {
    const p = perfil("mentoría, mentoria, mentoría, jira y java")!;
    expect(p.clase).toBe("Bardo de la Mentoría");
    expect(p.icono).toBe("a lute");
    expect(perfil("java java react kubernetes")!.icono).toBe("a steaming coffee mug");
  });

  it("hasta 5 hechizos y 3 objetos, por menciones", () => {
    const p = perfil("python python python go go rust php ruby java react git docker kubernetes playwright")!;
    expect(p.hechizos).toEqual(["python", "go", "java", "react", "rust"]);
    expect(p.objetos).toHaveLength(3);
  });
});

describe("fixtures con el catálogo real", () => {
  const casos: [string, string, number, string][] = [
    ["junior-frontend", juniorFrontend, 2, "picaro"],
    ["java-senior", javaSenior, 14, "guerrero"],
    ["cobol-veterano", cobolVeterano, 20, "paladin"],
    ["lider-equipo", liderEquipo, 11, "bardo"],
    ["acerca-de", acercaDe, 1, "mago"],
    ["english", english, 10, "explorador"],
  ];
  it.each(casos)("%s → nivel %i, %s", (_n, texto, nivel, clase) => {
    const p = calcularPerfil(texto, "sorpresa", HOY)!;
    expect(p.nivel.valor).toBe(nivel);
    expect(p.claseBase).toBe(clase);
  });
  it("el «Acerca de» sin fechas explica cómo subir de nivel", () => {
    expect(calcularPerfil(acercaDe, "sorpresa", HOY)!.nivel.motivo).toMatch(/añade/i);
  });
});
