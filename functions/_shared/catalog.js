import { json } from "./http.js";

export const DEFAULT_CATALOG = {
  title: "Catálogo de Desenhos",
  instagram: "Lanna.artees",
  tiktok: "lanna.lopess",
  qrKey: null,
  images: []
};

export async function readCatalog(env) {
  if (!env.CATALOG_KV) throw new Error("O namespace KV CATALOG_KV não está configurado.");
  const value = await env.CATALOG_KV.get("catalog", "text");
  if (!value) return { ...DEFAULT_CATALOG, images: [] };
  try {
    const catalog = JSON.parse(value);
    return {
      ...DEFAULT_CATALOG,
      ...catalog,
      tiktok: typeof catalog.tiktok === "string" && catalog.tiktok
        ? catalog.tiktok
        : DEFAULT_CATALOG.tiktok,
      images: Array.isArray(catalog.images) ? catalog.images : []
    };
  } catch (error) {
    console.error("O manifesto catalog.json está inválido.", error);
    throw new Error("O catálogo armazenado está inválido.");
  }
}

async function sleep(milliseconds) {
  await new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function isWriteThrottled(error) {
  const message = String(error?.message ?? error ?? "");
  return /429|too many requests|rate limit|throttl/i.test(message);
}

export async function writeCatalog(env, catalog) {
  if (!env.CATALOG_KV) throw new Error("O namespace KV CATALOG_KV não está configurado.");
  const value = JSON.stringify(catalog);
  for (let attempt = 1; ; attempt++) {
    try {
      await env.CATALOG_KV.put("catalog", value);
      return;
    } catch (error) {
      // O KV aceita apenas 1 gravação por segundo na mesma chave.
      if (attempt >= 3 || !isWriteThrottled(error)) throw error;
      await sleep(1000 * attempt);
    }
  }
}

export function publicCatalog(catalog) {
  return {
    title: catalog.title,
    instagram: catalog.instagram,
    tiktok: catalog.tiktok,
    qr: catalog.qrKey ? "/api/qr" : null,
    images: catalog.images.map((image) => ({
      id: image.id,
      src: `/api/images/${encodeURIComponent(image.key)}`,
      scale: image.scale,
      offsetX: image.offsetX,
      offsetY: image.offsetY
    }))
  };
}

export function adminCatalog(catalog) {
  return {
    ...publicCatalog(catalog),
    qr: catalog.qrKey ? `/api/admin/images/${encodeURIComponent(catalog.qrKey)}` : null,
    images: catalog.images.map((image) => ({
      id: image.id,
      key: image.key,
      src: `/api/images/${encodeURIComponent(image.key)}`,
      scale: image.scale,
      offsetX: image.offsetX,
      offsetY: image.offsetY
    }))
  };
}

export function validateProfile(value) {
  return typeof value === "string" && /^[A-Za-z0-9._]{1,30}$/.test(value);
}

export function validateImageKey(key) {
  return typeof key === "string" && /^[a-f0-9-]{36}\.(?:png|jpe?g|webp)$/.test(key);
}

export function publicError(message, status = 400) {
  return json({ error: message }, status);
}
