import { describe, expect, it } from "vitest";
import { crearIADesde, esSeguro, extraerJson } from "../src/ia/workersai";

const MODELOS = { texto: "m-texto", respaldo: "m-respaldo", imagen: "m-imagen", guardia: "m-guardia" };

describe("extraerJson", () => {
  it("entiende response como objeto o string, choices y output_text, con o sin ```json", () => {
    expect(extraerJson({ response: { a: 1 } })).toEqual({ a: 1 });
    expect(extraerJson({ response: '{"a":1}' })).toEqual({ a: 1 });
    expect(extraerJson({ choices: [{ message: { content: '```json\n{"a":1}\n```' } }] })).toEqual({ a: 1 });
    expect(extraerJson({ output: [{ content: [{ type: "output_text", text: '{"a":1}' }] }] })).toEqual({ a: 1 });
    expect(extraerJson({ response: "no es json" })).toBeNull();
  });
  it("formas reales de la Tarea 0A: gpt-oss sin response y qwen con saltos de línea delante", () => {
    expect(extraerJson({ choices: [{ message: { content: '{"a":1}', reasoning_content: "pienso" } }] })).toEqual({ a: 1 });
    expect(extraerJson({ response: null, choices: [{ message: { content: '\n\n{"a":1}' } }] })).toEqual({ a: 1 });
  });
});

describe("esSeguro", () => {
  it("acepta safe y rechaza unsafe, formas raras y errores (falla cerrado)", () => {
    expect(esSeguro({ response: "safe" })).toBe(true);
    expect(esSeguro({ response: { safe: true, categories: [] } })).toBe(true);
    expect(esSeguro({ response: "unsafe\nS10" })).toBe(false);
    expect(esSeguro({ response: { safe: false } })).toBe(false);
    expect(esSeguro({})).toBe(false);
  });
  it("forma real de Llama Guard 3: con saltos de línea delante", () => {
    expect(esSeguro({ response: "\n\nsafe" })).toBe(true);
    expect(esSeguro({ response: "\n\nunsafe\nS1" })).toBe(false);
  });
});

describe("crearIADesde", () => {
  it("texto: si el modelo principal da error, prueba el de respaldo", async () => {
    const llamados: string[] = [];
    const ia = crearIADesde(async (modelo) => {
      llamados.push(modelo);
      if (modelo === "m-texto") throw new Error("caído");
      return { response: { ok: true } };
    }, MODELOS);
    expect(await ia.texto([{ role: "user", content: "hola" }], {})).toEqual({ ok: true });
    expect(llamados).toEqual(["m-texto", "m-respaldo"]);
  });
  it("texto: razonamiento bajo en gpt-oss y /no_think al final del sistema en qwen", async () => {
    const entradas: Record<string, any> = {};
    const GPT = "@cf/openai/gpt-oss-20b", QWEN = "@cf/qwen/qwen3-30b-a3b-fp8";
    const ia = crearIADesde(async (modelo, entrada) => {
      entradas[modelo] = entrada;
      if (modelo === GPT) throw new Error("caído");
      return { response: { ok: true } };
    }, { ...MODELOS, texto: GPT, respaldo: QWEN });
    const mensajes = [{ role: "system" as const, content: "Reglas" }, { role: "user" as const, content: "hola" }];
    await ia.texto(mensajes, {});
    expect(entradas[GPT]).toMatchObject({ reasoning_effort: "low", messages: mensajes });
    expect(entradas[QWEN].messages).toEqual([{ role: "system", content: "Reglas /no_think" }, { role: "user", content: "hola" }]);
    expect(entradas[QWEN]).not.toHaveProperty("reasoning_effort");
    expect(mensajes[0].content).toBe("Reglas"); // no muta los mensajes originales
  });
  it("texto: corta a los 8 s", async () => {
    const ia = crearIADesde(() => new Promise(() => {}), MODELOS, { texto: 20, imagen: 20, guardia: 20 });
    await expect(ia.texto([], {})).rejects.toThrow(/timeout:texto/);
  });
  it("imagen: decodifica el base64 a bytes", async () => {
    const ia = crearIADesde(async () => ({ image: btoa("JPEG") }), MODELOS);
    expect(new TextDecoder().decode(await ia.imagen("p"))).toBe("JPEG");
  });
  it("guardia: manda el texto como respuesta del asistente", async () => {
    let entrada: any;
    const ia = crearIADesde(async (_m, e) => ((entrada = e), { response: "safe" }), MODELOS);
    expect(await ia.guardia("texto a revisar")).toBe(true);
    expect(entrada.messages.at(-1)).toEqual({ role: "assistant", content: "texto a revisar" });
  });
});
