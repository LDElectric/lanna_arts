import { json } from "./http.js";

const SESSION_COOKIE = "lanna_admin";
const SESSION_SECONDS = 12 * 60 * 60;

function toBase64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function fromBase64Url(value) {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const binary = atob(normalized + "=".repeat((4 - normalized.length % 4) % 4));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function digest(value) {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
}

function constantTimeEqual(left, right) {
  let difference = left.length ^ right.length;
  for (let index = 0; index < Math.max(left.length, right.length); index++) {
    difference |= (left[index % left.length] ?? 0) ^ (right[index % right.length] ?? 0);
  }
  return difference === 0;
}

async function sign(value, secret) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value)));
}

export function hasAuthSecrets(env) {
  return typeof env.ADMIN_PASSWORD === "string" &&
    env.ADMIN_PASSWORD.length >= 12 &&
    typeof env.SESSION_SECRET === "string" &&
    env.SESSION_SECRET.length >= 32;
}

function cookieValue(request) {
  const cookies = request.headers.get("Cookie") || "";
  const entry = cookies.split(";").map((part) => part.trim())
    .find((part) => part.startsWith(`${SESSION_COOKIE}=`));
  return entry?.slice(SESSION_COOKIE.length + 1) || "";
}

export async function isAdmin(request, env) {
  if (!hasAuthSecrets(env)) return false;
  const [encodedPayload, encodedSignature, ...extra] = cookieValue(request).split(".");
  if (!encodedPayload || !encodedSignature || extra.length) return false;
  try {
    const payloadBytes = fromBase64Url(encodedPayload);
    const signature = fromBase64Url(encodedSignature);
    const expected = await sign(encodedPayload, env.SESSION_SECRET);
    if (!constantTimeEqual(signature, expected)) return false;
    const payload = JSON.parse(new TextDecoder().decode(payloadBytes));
    return payload.user === "Lanna" && Number.isInteger(payload.exp) &&
      payload.exp > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

export async function handleSession(request, env) {
  if (request.method === "GET") {
    if (!hasAuthSecrets(env)) return json({ error: "Login ainda não configurado." }, 503);
    return json({ authenticated: await isAdmin(request, env) });
  }

  if (request.method === "DELETE") {
    return new Response(null, {
      status: 204,
      headers: {
        "Cache-Control": "no-store",
        "Set-Cookie": `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`
      }
    });
  }

  if (request.method !== "POST") return json({ error: "Método não permitido." }, 405);
  if (!hasAuthSecrets(env)) return json({ error: "Login ainda não configurado." }, 503);

  const supplied = await request.json().catch(() => null);
  if (!supplied || typeof supplied.username !== "string" ||
      typeof supplied.password !== "string" || supplied.password.length > 256) {
    return json({ error: "Informe o usuário e a senha." }, 400);
  }

  const [expectedUser, suppliedUser, expectedPassword, suppliedPassword] = await Promise.all([
    digest("Lanna"),
    digest(supplied.username),
    digest(env.ADMIN_PASSWORD),
    digest(supplied.password)
  ]);
  if (!constantTimeEqual(expectedUser, suppliedUser) ||
      !constantTimeEqual(expectedPassword, suppliedPassword)) {
    return json({ error: "Usuário ou senha incorretos." }, 401);
  }

  const payload = toBase64Url(new TextEncoder().encode(JSON.stringify({
    user: "Lanna",
    exp: Math.floor(Date.now() / 1000) + SESSION_SECONDS
  })));
  const token = `${payload}.${toBase64Url(await sign(payload, env.SESSION_SECRET))}`;
  return json({ authenticated: true }, 200, {
    "Set-Cookie": `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_SECONDS}`
  });
}

export async function requireAdmin(request, env) {
  if (!(await isAdmin(request, env))) {
    return json({ error: "Acesso restrito à administradora." }, 401);
  }
  return null;
}
