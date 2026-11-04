import type { Env as EnvWorker } from "../src/env";

declare global {
  namespace Cloudflare {
    interface Env extends EnvWorker {}
  }
}
