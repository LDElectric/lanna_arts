import { isAdmin } from "../../../_shared/auth.js";
import { readCatalog, validateImageKey, writeCatalog } from "../../../_shared/catalog.js";
import { errorResponse, isSameOrigin, json } from "../../../_shared/http.js";

export async function onRequestGet({ request, env, params }) {
  if (!(await isAdmin(request, env))) return json({ error: "Acesso restrito à administradora." }, 401);
  const key = params.key;
  if (!validateImageKey(key)) return json({ error: "Imagem não encontrada." }, 404);
  try {
    const catalog = await readCatalog(env);
    if (catalog.qrKey !== key && !catalog.images.some((image) => image.key === key)) {
      return json({ error: "Imagem não encontrada." }, 404);
    }
    const { value, metadata } = await env.CATALOG_KV.getWithMetadata(
      `images/${key}`,
      { type: "arrayBuffer" }
    );
    if (!value) return json({ error: "Imagem não encontrada." }, 404);
    const headers = new Headers({
      "Content-Type": metadata?.contentType || "application/octet-stream"
    });
    headers.set("Cache-Control", "private, no-store");
    headers.set("X-Content-Type-Options", "nosniff");
    return new Response(value, { headers });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function onRequestDelete({ request, env, params }) {
  if (!(await isAdmin(request, env))) return json({ error: "Acesso restrito à administradora." }, 401);
  if (!isSameOrigin(request)) return json({ error: "Origem da solicitação inválida." }, 403);
  const key = params.key;
  if (!validateImageKey(key)) return json({ error: "Imagem inválida." }, 400);

  try {
    const catalog = await readCatalog(env);
    const imageExists = catalog.images.some((image) => image.key === key);
    const isQr = catalog.qrKey === key;
    if (!imageExists && !isQr) return json({ error: "Imagem não encontrada." }, 404);
    catalog.images = catalog.images.filter((image) => image.key !== key);
    if (isQr) catalog.qrKey = null;
    await writeCatalog(env, catalog);
    await env.CATALOG_KV.delete(`images/${key}`);
    return json({ deleted: true });
  } catch (error) {
    return errorResponse(error);
  }
}
