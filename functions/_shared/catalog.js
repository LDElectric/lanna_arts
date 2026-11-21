import { json } from "./http.js";

export const DEFAULT_CATALOG = {
  title: "Catálogo de Desenhos",
  instagram: "Lanna.artees",
  tiktok: "lanna.lopess",
  qrKey: null,
  categories: [{ id: "geral", name: "Geral", order: 0 }],
  images: []
};

function normalizeCategories(categories) {
  if (!Array.isArray(categories) || categories.length === 0) return DEFAULT_CATALOG.categories;
  const normalized = categories
    .filter((category) => category && typeof category.id === "string" && typeof category.name === "string")
    .map((category, index) => ({
      id: category.id,
      name: category.name.trim().slice(0, 50),
      order: Number.isFinite(category.order) ? category.order : index
    }))
    .filter((category) => /^[a-z0-9-]{1,50}$/.test(category.id) && category.name.length > 0);
  return normalized.length > 0 ? normalized.sort((a, b) => a.order - b.order) : DEFAULT_CATALOG.categories;
}

function normalizeImages(images, categories) {
  const categoryIds = new Set(categories.map((category) => category.id));
  return (Array.isArray(images) ? images : []).map((image) => ({
    ...image,
    name: typeof image.name === "string" ? image.name.trim().slice(0, 80) : "",
    categoryId: categoryIds.has(image.categoryId) ? image.categoryId : categories[0].id
  }));
}

export async function readCatalog(env) {
  if (!env.CATALOG_KV) throw new Error("O namespace KV CATALOG_KV não está configurado.");
  const value = await env.CATALOG_KV.get("catalog", "text");
  if (!value) return { ...DEFAULT_CATALOG, images: [] };
  try {
    const catalog = JSON.parse(value);
    const categories = normalizeCategories(catalog.categories);
    return {
      ...DEFAULT_CATALOG,
      ...catalog,
      tiktok: typeof catalog.tiktok === "string" && catalog.tiktok
        ? catalog.tiktok
        : DEFAULT_CATALOG.tiktok,
      categories,
      images: normalizeImages(catalog.images, categories)
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
    categories: catalog.categories,
    qr: catalog.qrKey ? "/api/qr" : null,
    images: catalog.images.map((image) => ({
      id: image.id,
      src: `/api/images/${encodeURIComponent(image.key)}`,
      name: image.name || "",
      categoryId: image.categoryId || catalog.categories[0].id,
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
      name: image.name || "",
      categoryId: image.categoryId || catalog.categories[0].id,
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
