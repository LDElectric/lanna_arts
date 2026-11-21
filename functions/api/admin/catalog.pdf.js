import puppeteer from "@cloudflare/puppeteer";
import { isAdmin } from "../../_shared/auth.js";
import { readCatalog, validateImageKey } from "../../_shared/catalog.js";
import { errorResponse, isSameOrigin, json } from "../../_shared/http.js";

function dataUrl(buffer, contentType) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return `data:${contentType};base64,${btoa(binary)}`;
}

function filename(title) {
  const safeTitle = title.normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase() || "catalogo";
  const date = new Date();
  const dateSuffix = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")
  ].join("-");
  return `${safeTitle}-${dateSuffix}.pdf`;
}

async function printQrDataUrl(catalog, env) {
  if (!catalog.qrKey) return null;
  if (!validateImageKey(catalog.qrKey)) throw new TypeError("O QR de impressão armazenado é inválido.");

  const { value, metadata } = await env.CATALOG_KV.getWithMetadata(
    `images/${catalog.qrKey}`,
    { type: "arrayBuffer" }
  );
  const contentType = metadata?.contentType;
  if (!value || value.byteLength === 0 ||
      !["image/png", "image/jpeg", "image/webp"].includes(contentType)) {
    throw new Error("Não foi possível carregar o QR de impressão.");
  }
  return dataUrl(value, contentType);
}

export async function onRequestPost({ request, env }) {
  if (!(await isAdmin(request, env))) return json({ error: "Acesso restrito à administradora." }, 401);
  if (!isSameOrigin(request)) return json({ error: "Origem da solicitação inválida." }, 403);

  let browser;
  try {
    const catalog = await readCatalog(env);
    let selection = null;
    if (request.headers.get("Content-Type")?.includes("application/json")) {
      selection = await request.json();
    }
    let selectedImages = catalog.images;
    if (selection?.mode === "category") {
      if (typeof selection.categoryId !== "string") return json({ error: "Escolha uma categoria." }, 400);
      selectedImages = catalog.images.filter((image) => image.categoryId === selection.categoryId);
    } else if (selection?.mode === "custom") {
      if (!Array.isArray(selection.imageIds) || selection.imageIds.length === 0) {
        return json({ error: "Selecione pelo menos um desenho." }, 400);
      }
      const wanted = new Set(selection.imageIds.filter((id) => Number.isSafeInteger(id)));
      selectedImages = catalog.images.filter((image) => wanted.has(image.id));
    }
    if (selectedImages.length === 0) {
      return json({ error: "Adicione pelo menos um desenho para exportar." }, 400);
    }
    const exportCatalog = {
      ...catalog,
      title: typeof selection?.title === "string" && selection.title.trim() ? selection.title.trim().slice(0, 80) : catalog.title,
      images: selectedImages
    };
    const qrDataUrl = await printQrDataUrl(exportCatalog, env);
    browser = await puppeteer.launch(env.BROWSER);
    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 900 });
    await page.goto(new URL("/", request.url).href, {
      waitUntil: "networkidle0",
      timeout: 45_000
    });
    await page.evaluate(async ({ qrImage, imageIds, title }) => {
      if (typeof preparePrintCatalog !== "function") {
        throw new Error("O catálogo não terminou de carregar.");
      }
      if (typeof preparePrintSelection === "function") {
        await preparePrintSelection(imageIds, title, qrImage);
      } else {
        await preparePrintCatalog(qrImage);
      }
      if (!document.querySelector("#printPages .frame")) {
        throw new Error("Os desenhos do catálogo não foram carregados.");
      }
    }, { qrImage: qrDataUrl, imageIds: selectedImages.map((image) => image.id), title: exportCatalog.title });

    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
      displayHeaderFooter: false
    });
    return new Response(pdf, {
      headers: {
        "Cache-Control": "no-store",
        "Content-Disposition": `attachment; filename="${filename(exportCatalog.title)}"`,
        "Content-Type": "application/pdf",
        "X-Content-Type-Options": "nosniff"
      }
    });
  } catch (error) {
    return errorResponse(error);
  } finally {
    if (browser) await browser.close();
  }
}
