import { handleSession } from "../../_shared/auth.js";
import { isSameOrigin, json } from "../../_shared/http.js";

export async function onRequest({ request, env }) {
  if (request.method !== "GET" && !isSameOrigin(request)) {
    return json({ error: "Origem da solicitação inválida." }, 403);
  }
  return handleSession(request, env);
}
