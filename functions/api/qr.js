import { readCatalog, validateImageKey } from "../_shared/catalog.js";
import { errorResponse } from "../_shared/http.js";

export async function onRequestGet({ env }) {
  try {
    const catalog = await readCatalog(env);
    if (!catalog.qrKey || !validateImageKey(catalog.qrKey)) {
      return new Response("QR de impressão não configurado.", { status: 404 });
    }
    const { value, metadata } = await env.CATALOG_KV.getWithMetadata(
      `images/${catalog.qrKey}`,
      { type: "arrayBuffer" }
    );
    if (!value || value.byteLength === 0) {
      return new Response("QR de impressão não configurado.", { status: 404 });
    }
    return new Response(value, {
      headers: {
        "Content-Type": metadata?.contentType || "image/png",
        "Cache-Control": "public, max-age=300",
        "X-Content-Type-Options": "nosniff"
      }
    });
  } catch (error) {
    return errorResponse(error);
  }
}
