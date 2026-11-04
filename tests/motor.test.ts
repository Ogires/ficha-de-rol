import { describe, expect, it } from "vitest";
import { buscar, compilar, contar } from "../src/dominio/motor";
import type { Termino } from "../src/dominio/tipos";

const t = (id: string, patron: string, extra: Partial<Termino> = {}): Termino => ({
  id, nombre: id, patron, atributo: "FUE", tipo: "hechizo", epiteto: `de ${id}`, ejemplos: [], ...extra,
});
const CAT = [
  t("aspnet", "ASP\\.NET"), t("dotnet", "\\.NET"), t("java", "Java"), t("javascript", "JavaScript", { atributo: "DES" }),
  t("c", "C", { exacto: true }), t("csharp", "C#"), t("go", "Go(?:lang)?", { exacto: true }),
  t("migracion", "migr(?:é|aciones|ación|ar|ado)", { tipo: "senal", atributo: "CON" }),
  t("sql-server", "SQL Server", { tipo: "objeto" }),
];
const C = compilar(CAT);
const ids = (texto: string) => buscar(texto, C).map((m) => m.termino.id);

describe("motor", () => {
  it("en un solape gana el término más largo", () => {
    expect(ids("Hice webs con ASP.NET y .NET 8")).toEqual(["aspnet", "dotnet"]);
  });
  it("Java no casa dentro de JavaScript", () => {
    expect(ids("JavaScript y Java")).toEqual(["javascript", "java"]);
  });
  it("C y Go solo con sus mayúsculas; C# gana a C", () => {
    expect(ids("c, go, Google")).toEqual([]);
    expect(ids("C, C# y Go")).toEqual(["c", "csharp", "go"]);
  });
  it("acentos: no corta palabras (lookarounds Unicode, lección 7)", () => {
    expect(ids("Migré el ERP; la migración fue larga")).toEqual(["migracion", "migracion"]);
    expect(ids("inmigración")).toEqual([]);
  });
  it("un espacio del patrón casa con varios espacios o saltos de línea", () => {
    expect(ids("SQL   Server y SQL\nServer")).toEqual(["sql-server", "sql-server"]);
  });
  it("contar agrupa por término y respeta el orden del catálogo", () => {
    const d = contar(buscar("Java, .NET, Java", C), CAT);
    expect(d.map((x) => [x.termino.id, x.menciones])).toEqual([["dotnet", 1], ["java", 2]]);
  });
});
