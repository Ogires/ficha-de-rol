import type { Env as EnvWorker } from "../src/env";

declare global {
  namespace Cloudflare {
    interface Env extends EnvWorker {}
  }
}

// Vite importa ficheros como texto con ?raw
declare module "*?raw" {
  const contenido: string;
  export default contenido;
}
