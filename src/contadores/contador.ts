import { DurableObject } from "cloudflare:workers";
import type { Env } from "../env";

interface Ventana { ventana: number; n: number }
interface Sal { ventana: number; valor: string }

// Un DO atiende sus peticiones de una en una y los input gates impiden que otra se cuele entre el
// get y el put: el incremento es atómico (KV no lo es, lección 9).
export class Contador extends DurableObject<Env> {
  // Suma `cantidad` si no se pasa de `limite` en la ventana actual. Al estrenar ventana programa una
  // alarma que borra el storage al acabar: los contadores por IP no sobreviven al día.
  async consumir(cantidad: number, limite: number, ventanaMs: number, ahoraMs = Date.now()): Promise<boolean> {
    const ventana = Math.floor(ahoraMs / ventanaMs);
    const actual = (await this.ctx.storage.get<Ventana>("v")) ?? { ventana, n: 0 };
    if (actual.ventana !== ventana) Object.assign(actual, { ventana, n: 0 });
    if (actual.n + cantidad > limite) return false;
    actual.n += cantidad;
    await this.ctx.storage.put("v", actual);
    await this.programarBorrado((ventana + 1) * ventanaMs);
    return true;
  }

  // Sal aleatoria del día para el hash de las IP; se borra con la alarma
  async sal(ventanaMs: number, ahoraMs = Date.now()): Promise<string> {
    const ventana = Math.floor(ahoraMs / ventanaMs);
    const actual = await this.ctx.storage.get<Sal>("s");
    if (actual?.ventana === ventana) return actual.valor;
    const valor = [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, "0")).join("");
    await this.ctx.storage.put("s", { ventana, valor });
    await this.programarBorrado((ventana + 1) * ventanaMs);
    return valor;
  }

  // Bytes guardados en KV: no caduca
  async sumar(n: number): Promise<number> {
    const total = ((await this.ctx.storage.get<number>("t")) ?? 0) + n;
    await this.ctx.storage.put("t", total);
    return total;
  }

  async leer(): Promise<number> {
    return (await this.ctx.storage.get<number>("t")) ?? 0;
  }

  async alarm(): Promise<void> {
    await this.ctx.storage.deleteAll();
  }

  private async programarBorrado(cuando: number): Promise<void> {
    if ((await this.ctx.storage.getAlarm()) === null) await this.ctx.storage.setAlarm(cuando);
  }
}
