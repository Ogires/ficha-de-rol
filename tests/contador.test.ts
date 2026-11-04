import { describe, expect, it } from "vitest";
import { env, runDurableObjectAlarm } from "cloudflare:test";

const DIA = 86_400_000;
// Mediodía de mañana (UTC), relativo a hoy: la alarma de fin de día queda siempre en el futuro y no
// salta a mitad de test (con una fecha fija, el CI fallaría al azar en cuanto esa fecha pasara)
const T = (Math.floor(Date.now() / DIA) + 1) * DIA + DIA / 2;
const stub = (nombre: string) => env.CONTADOR.get(env.CONTADOR.idFromName(nombre));

describe("Contador.consumir (ventana fija de un día)", () => {
  it("es exacto con 100 peticiones concurrentes", async () => {
    const c = stub("t:concurrencia");
    const r = await Promise.all(Array.from({ length: 100 }, () => c.consumir(1, 20, DIA, T)));
    expect(r.filter(Boolean)).toHaveLength(20); // el test que KV suspende (lección 9)
  });

  it("reserva cantidades: 6.000 neuronas a 130 dan 46 reservas", async () => {
    const c = stub("t:neuronas");
    const r = await Promise.all(Array.from({ length: 60 }, () => c.consumir(130, 6000, DIA, T)));
    expect(r.filter(Boolean)).toHaveLength(46);
  });

  it("el día siguiente empieza de cero", async () => {
    const c = stub("t:dia");
    expect(await c.consumir(1, 1, DIA, T)).toBe(true);
    expect(await c.consumir(1, 1, DIA, T)).toBe(false);
    expect(await c.consumir(1, 1, DIA, T + DIA)).toBe(true);
  });

  it("la alarma de fin de día borra el storage", async () => {
    const c = stub("t:alarma");
    await c.consumir(1, 5, DIA, T);
    expect(await runDurableObjectAlarm(c)).toBe(true);
    expect(await c.consumir(1, 1, DIA, T)).toBe(true); // tras borrar, vuelve a haber cupo
  });
});

describe("Contador.sal", () => {
  it("devuelve la misma sal durante el día y otra al día siguiente", async () => {
    const c = stub("t:sal");
    const a = await c.sal(DIA, T);
    expect(a).toMatch(/^[0-9a-f]{32}$/);
    expect(await c.sal(DIA, T + 1000)).toBe(a);
    expect(await c.sal(DIA, T + DIA)).not.toBe(a);
  });
});

describe("Contador.sumar/leer (bytes, sin caducidad)", () => {
  it("suma concurrente sin perder incrementos", async () => {
    const c = stub("t:bytes");
    await Promise.all(Array.from({ length: 50 }, () => c.sumar(10)));
    expect(await c.leer()).toBe(500);
  });
});
