import { readCatalog, validateImageKey } from "../../_shared/catalog.js";
import { errorResponse, json } from "../../_shared/http.js";

export async function onRequestGet({ env, params }) {
  const key = params.key;
  if (!validateImageKey(key)) return json({ error: "Imagem não encontrada." }, 404);
  try {
    const catalog = await readCatalog(env);
    if (!catalog.images.some((image) => image.key === key)) {
      return json({ error: "Imagem não encontrada." }, 404);
    }
    const { value, metadata } = await env.CATALOG_KV.getWithMetadata(
      `images/${key}`,
      { type: "arrayBuffer" }
    );
    if (!value) return json({ error: "Imagem não encontrada." }, 404);
    const headers = new Headers();
    headers.set("Content-Type", metadata?.contentType || "application/octet-stream");
    headers.set("Cache-Control", "public, max-age=3600");
    headers.set("X-Content-Type-Options", "nosniff");
    return new Response(value, { headers });
  } catch (error) {
    return errorResponse(error);
  }
}
