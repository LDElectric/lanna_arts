import { isAdmin } from "../../_shared/auth.js";
import { readCatalog, writeCatalog } from "../../_shared/catalog.js";
import { errorResponse, isSameOrigin, json } from "../../_shared/http.js";

const MAX_IMAGE_SIZE = 8 * 1024 * 1024;
const IMAGE_TYPES = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"]
]);

export async function onRequestPost({ request, env }) {
  if (!(await isAdmin(request, env))) return json({ error: "Acesso restrito à administradora." }, 401);
  if (!isSameOrigin(request)) return json({ error: "Origem da solicitação inválida." }, 403);
  if (Number(request.headers.get("Content-Length") || 0) > MAX_IMAGE_SIZE + 32_000) {
    return json({ error: "Cada imagem deve ter no máximo 8 MB." }, 413);
  }

  try {
    const form = await request.formData();
    const file = form.get("file");
    const kind = form.get("kind");
    const id = Number(form.get("id"));
    if (!(file instanceof File) || file.size < 1 || file.size > MAX_IMAGE_SIZE ||
        !IMAGE_TYPES.has(file.type) || (kind !== "qr" && kind !== "drawing") ||
        (kind === "drawing" && (!Number.isSafeInteger(id) || id < 1))) {
      return json({ error: "Use uma imagem PNG, JPG ou WebP de até 8 MB." }, 400);
    }

    const key = `${crypto.randomUUID()}.${IMAGE_TYPES.get(file.type)}`;
    await env.CATALOG_KV.put(`images/${key}`, await file.arrayBuffer(), {
      metadata: { contentType: file.type }
    });
    const catalog = await readCatalog(env);
    if (kind === "qr") {
      const previousKey = catalog.qrKey;
      catalog.qrKey = key;
      await writeCatalog(env, catalog);
      if (previousKey) await env.CATALOG_KV.delete(`images/${previousKey}`);
    } else {
      const previous = catalog.images.find((image) => image.id === id);
      catalog.images = catalog.images.filter((image) => image.id !== id);
      catalog.images.push({
        id,
        key,
        scale: 1,
        offsetX: 0,
        offsetY: 0
      });
      await writeCatalog(env, catalog);
      if (previous) await env.CATALOG_KV.delete(`images/${previous.key}`);
    }
    return json({ key, src: `/api/images/${encodeURIComponent(key)}` });
  } catch (error) {
    return errorResponse(error);
  }
}
