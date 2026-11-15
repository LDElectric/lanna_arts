import { readCatalog, publicCatalog } from "../_shared/catalog.js";
import { errorResponse, json } from "../_shared/http.js";

export async function onRequestGet({ env }) {
  try {
    return json(publicCatalog(await readCatalog(env)), 200, {
      "Cache-Control": "no-store"
    });
  } catch (error) {
    return errorResponse(error);
  }
}
