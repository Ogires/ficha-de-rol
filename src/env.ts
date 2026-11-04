import type { Contador } from "./contadores/contador";

export interface Env {
  KV: KVNamespace;
  CONTADOR: DurableObjectNamespace<Contador>;
  ASSETS: Fetcher;
  AI?: Ai; // no existe en los tests (wrangler.test.jsonc) → ficha manual
  MODELO_TEXTO: string;
  MODELO_TEXTO_RESPALDO: string;
  MODELO_IMAGEN: string;
  MODELO_GUARDIA: string;
  CUOTA_NEURONAS_DIA: string;
  RESERVA_NEURONAS: string;
  TOPE_IA_IP_DIA: string;
  TOPE_FICHAS_IP_DIA: string;
  TOPE_BYTES_KV: string;
}
