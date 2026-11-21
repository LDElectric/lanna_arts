import { isAdmin } from "../../_shared/auth.js";
import { readCatalog, writeCatalog } from "../../_shared/catalog.js";
import { errorResponse, isSameOrigin, json } from "../../_shared/http.js";

const MAX_IMAGE_SIZE = 8 * 1024 * 1024;
const MAX_BATCH_FILES = 20;
const MAX_BATCH_BYTES = 32 * 1024 * 1024;
const IMAGE_TYPES = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"]
]);

function isValidImage(file) {
  return file instanceof File && file.size > 0 && file.size <= MAX_IMAGE_SIZE &&
    IMAGE_TYPES.has(file.type);
}

function imageResponse(entry) {
  return {
    id: entry.id,
    key: entry.key,
    src: `/api/images/${encodeURIComponent(entry.key)}`,
    name: entry.name || "",
    categoryId: entry.categoryId || "geral"
  };
}

async function storeImage(env, file) {
  const key = `${crypto.randomUUID()}.${IMAGE_TYPES.get(file.type)}`;
  await env.CATALOG_KV.put(`images/${key}`, await file.arrayBuffer(), {
    metadata: { contentType: file.type }
  });
  return key;
}

export async function onRequestPost({ request, env }) {
  if (!(await isAdmin(request, env))) return json({ error: "Acesso restrito à administradora." }, 401);
  if (!isSameOrigin(request)) return json({ error: "Origem da solicitação inválida." }, 403);
  if (Number(request.headers.get("Content-Length") || 0) > MAX_BATCH_BYTES + 64_000) {
    return json({ error: "Envie menos imagens por vez (máximo de 8 MB por imagem)." }, 413);
  }

  try {
    const form = await request.formData();
    const kind = form.get("kind");
    const single = form.get("file");
    const files = [
      ...(single instanceof File && single.size > 0 ? [single] : []),
      ...form.getAll("files").filter((file) => file instanceof File && file.size > 0)
    ];

    if (kind === "qr") {
      if (files.length !== 1) return json({ error: "Envie apenas uma imagem de QR." }, 400);
      if (!isValidImage(files[0])) {
        return json({ error: "Use uma imagem PNG, JPG ou WebP de até 8 MB." }, 400);
      }
      const catalog = await readCatalog(env);
      const key = await storeImage(env, files[0]);
      const previousKey = catalog.qrKey;
      catalog.qrKey = key;
      try {
        await writeCatalog(env, catalog);
      } catch (error) {
        await env.CATALOG_KV.delete(`images/${key}`).catch(() => {});
        throw error;
      }
      if (previousKey) await env.CATALOG_KV.delete(`images/${previousKey}`);
      return json({ key, src: `/api/images/${encodeURIComponent(key)}`, qr: "/api/qr" });
    }

    if (kind !== "drawing") return json({ error: "Tipo de imagem inválido." }, 400);
    if (files.length === 0) return json({ error: "Selecione pelo menos uma imagem." }, 400);
    if (files.length > MAX_BATCH_FILES) {
      return json({ error: `Envie no máximo ${MAX_BATCH_FILES} imagens por vez.` }, 400);
    }
    if (files.some((file) => !isValidImage(file))) {
      return json({ error: "Use imagens PNG, JPG ou WebP de até 8 MB cada." }, 400);
    }

    const replaceId = Number(form.get("id"));
    const replacing = Number.isSafeInteger(replaceId) && replaceId > 0;
    if (replacing && files.length !== 1) {
      return json({ error: "A troca de imagem aceita apenas um arquivo." }, 400);
    }

    const catalog = await readCatalog(env);
    const requestedCategoryId = form.get("categoryId");
    const categoryId = typeof requestedCategoryId === "string" &&
      catalog.categories.some((category) => category.id === requestedCategoryId)
      ? requestedCategoryId
      : catalog.categories?.[0]?.id || "geral";
    let nextId = catalog.images.reduce((highest, image) => Math.max(highest, image.id), 0) + 1;
    const uploaded = [];
    const storedKeys = [];
    try {
      for (const file of files) {
        const key = await storeImage(env, file);
        storedKeys.push(key);
        uploaded.push({
          id: replacing ? replaceId : nextId++,
          key,
          name: file.name.replace(/\.[^.]+$/, "").slice(0, 80),
          categoryId,
          scale: 1,
          offsetX: 0,
          offsetY: 0
        });
      }
    } catch (error) {
      await Promise.all(storedKeys.map((key) => env.CATALOG_KV.delete(`images/${key}`).catch(() => {})));
      throw error;
    }

    let previousKey = null;
    if (replacing) {
      const index = catalog.images.findIndex((image) => image.id === replaceId);
      if (index >= 0) {
        previousKey = catalog.images[index].key;
        catalog.images[index] = uploaded[0];
      } else {
        catalog.images.push(uploaded[0]);
      }
    } else {
      catalog.images.push(...uploaded);
    }
    try {
      await writeCatalog(env, catalog);
    } catch (error) {
      await Promise.all(storedKeys.map((key) => env.CATALOG_KV.delete(`images/${key}`).catch(() => {})));
      throw error;
    }
    if (previousKey) await env.CATALOG_KV.delete(`images/${previousKey}`);
    return json({ images: uploaded.map(imageResponse) });
  } catch (error) {
    return errorResponse(error);
  }
}
