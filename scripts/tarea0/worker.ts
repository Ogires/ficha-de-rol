// Worker de pruebas: expone Workers AI en local para los scripts de la Tarea 0 y de la galería.
interface Env { AI: Ai }

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method !== "POST") return new Response("POST /run {modelo, entrada} · POST /imagen {prompt, steps}", { status: 404 });
    const cuerpo = await request.json<Record<string, any>>();
    const t0 = Date.now();
    if (url.pathname === "/run") {
      const salida = await env.AI.run(cuerpo.modelo, cuerpo.entrada);
      return Response.json({ ms: Date.now() - t0, salida });
    }
    if (url.pathname === "/imagen") {
      const salida = (await env.AI.run("@cf/black-forest-labs/flux-1-schnell", { prompt: cuerpo.prompt, steps: cuerpo.steps ?? 4 })) as { image: string };
      const bytes = Uint8Array.from(atob(salida.image), (c) => c.charCodeAt(0));
      return new Response(bytes, { headers: { "content-type": "image/jpeg", "x-ms": String(Date.now() - t0) } });
    }
    return new Response("ruta desconocida", { status: 404 });
  },
};
