// Fachada para los handlers: los nombres de instancia, en un solo sitio
import type { Env } from "../env";
import { sha256Hex } from "../http/util";

export const DIA = 86_400_000; // Workers AI reinicia el cupo a las 00:00 UTC, que es donde corta floor(ms / DIA)

const stub = (env: Env, nombre: string) => env.CONTADOR.get(env.CONTADOR.idFromName(nombre));

// La IP nunca se guarda en claro: hash con la sal del día, que se borra al acabar el día
export async function claveDiaria(env: Env, ip: string, ahora = Date.now()): Promise<string> {
  const sal = await stub(env, "sal").sal(DIA, ahora);
  return (await sha256Hex(`${sal}|${ip}`)).slice(0, 32);
}

export const consumirIp = (env: Env, clave: string, tipo: "total" | "ia", limite: number, ahora = Date.now()) =>
  stub(env, `ip:${clave}:${tipo}`).consumir(1, limite, DIA, ahora);

export const reservarNeuronas = (env: Env, n: number, cupo: number, ahora = Date.now()) =>
  stub(env, "neuronas").consumir(n, cupo, DIA, ahora);

export const bytesGuardados = (env: Env) => stub(env, "bytes").leer();
export const sumarBytes = (env: Env, n: number) => stub(env, "bytes").sumar(n);
