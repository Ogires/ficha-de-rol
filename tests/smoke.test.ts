import { describe, expect, it } from "vitest";
import { SELF } from "cloudflare:test";

describe("humo", () => {
  it("sirve la portada y da 404 a lo que no existe", async () => {
    const portada = await SELF.fetch("https://rol.webninja.fyi/");
    expect(portada.status).toBe(200);
    expect(await portada.text()).toContain("Ficha de Rol");
    expect((await SELF.fetch("https://rol.webninja.fyi/no-existe")).status).toBe(404);
  });
});
