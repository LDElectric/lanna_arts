export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...headers
    }
  });
}

export function isSameOrigin(request) {
  return request.headers.get("Origin") === new URL(request.url).origin;
}

export function errorResponse(error) {
  console.error(error);
  return json({ error: "Erro interno ao processar a solicitação." }, 500);
}
