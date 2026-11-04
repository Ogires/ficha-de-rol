import { DurableObject } from "cloudflare:workers";
import type { Env } from "../env";

export class Contador extends DurableObject<Env> {}
