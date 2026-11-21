import { isAdmin } from "../../_shared/auth.js";
import { adminCatalog, readCatalog, validateProfile, writeCatalog } from "../../_shared/catalog.js";
import { errorResponse, isSameOrigin, json } from "../../_shared/http.js";

const MAX_CATALOG_BYTES = 2 * 1024 * 1024;
const MAX_CATALOG_IMAGES = 10000;

export async function onRequest({ request, env }) {
  if (!(await isAdmin(request, env))) return json({ error: "Acesso restrito à administradora." }, 401);
  if (request.method === "GET") {
    try {
      return json(adminCatalog(await readCatalog(env)));
    } catch (error) {
      return errorResponse(error);
    }
  }
  if (request.method !== "PUT") return json({ error: "Método não permitido." }, 405);
  if (!isSameOrigin(request)) return json({ error: "Origem da solicitação inválida." }, 403);
  if (Number(request.headers.get("Content-Length") || 0) > MAX_CATALOG_BYTES) {
    return json({ error: "Os dados enviados excedem o limite permitido." }, 413);
  }

  try {
    const input = await request.json();
    if (typeof input.title !== "string" || input.title.trim().length < 1 ||
        input.title.trim().length > 80 || !validateProfile(input.instagram) ||
        (input.tiktok !== "" && !validateProfile(input.tiktok)) ||
        !Array.isArray(input.images) || input.images.length > MAX_CATALOG_IMAGES) {
      return json({ error: "Confira o título, os perfis e a lista de desenhos." }, 400);
    }

    const current = await readCatalog(env);
    const images = input.images.map((image) => {
      if (!image || typeof image.id !== "number" || !Number.isSafeInteger(image.id) ||
          typeof image.key !== "string" || !/^[a-f0-9-]{36}\.(?:png|jpe?g|webp)$/.test(image.key) ||
          !Number.isFinite(image.scale) || image.scale < 0.1 || image.scale > 8 ||
          !Number.isFinite(image.offsetX) || Math.abs(image.offsetX) > 2000 ||
          !Number.isFinite(image.offsetY) || Math.abs(image.offsetY) > 2000) {
        throw new TypeError("Um dos desenhos enviados tem dados inválidos.");
      }
      return {
        id: image.id,
        key: image.key,
        scale: image.scale,
        offsetX: image.offsetX,
        offsetY: image.offsetY
      };
    });

    await writeCatalog(env, {
      title: input.title.trim(),
      instagram: input.instagram,
      tiktok: input.tiktok,
      qrKey: current.qrKey,
      images
    });
    return json({ saved: true });
  } catch (error) {
    if (error instanceof SyntaxError || error instanceof TypeError) {
      return json({ error: error.message || "Dados inválidos." }, 400);
    }
    return errorResponse(error);
  }
}
