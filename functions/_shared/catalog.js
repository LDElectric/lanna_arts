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
  if (!value) return { ...DEFAULT_CATALOG };
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

export async function writeCatalog(env, catalog) {
  if (!env.CATALOG_KV) throw new Error("O namespace KV CATALOG_KV não está configurado.");
  await env.CATALOG_KV.put("catalog", JSON.stringify(catalog));
}

export function publicCatalog(catalog) {
  return {
    title: catalog.title,
    instagram: catalog.instagram,
    tiktok: catalog.tiktok,
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
