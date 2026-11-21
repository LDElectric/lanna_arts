import http from "node:http";
import { readFile, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

// Captura o fundo de impressão (imagem base + decorações do site) em uma
// única imagem estática, no tamanho exato da página A4 na impressão.
// Uso: npm run build && node scripts/capture-print-bg.mjs

const rootDir = fileURLToPath(new URL("..", import.meta.url));
const distDir = join(rootDir, "dist");
const basePath = join(rootDir, "print-background-base.jpg");
const output = join(rootDir, "print-background.jpg");

const types = {
  ".html": "text/html", ".js": "text/javascript", ".css": "text/css",
  ".png": "image/png", ".svg": "image/svg+xml", ".jpg": "image/jpeg"
};
const mockCatalog = {
  title: "Catálogo de Desenhos",
  instagram: "Lanna.artees",
  tiktok: "lanna.lopess",
  categories: [{ id: "natal", name: "Natal", order: 0 }],
  images: []
};

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, "http://127.0.0.1:8788");
  if (url.pathname === "/api/catalog") {
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify(mockCatalog));
    return;
  }
  const pathname = url.pathname === "/" ? "/index.html" : url.pathname;
  try {
    const file = await readFile(join(distDir, pathname));
    response.writeHead(200, { "Content-Type": types[extname(pathname)] || "application/octet-stream" });
    response.end(file);
  } catch {
    response.writeHead(404);
    response.end("not found");
  }
});

await new Promise((resolve) => server.listen(8788, "127.0.0.1", resolve));
const browser = await puppeteer.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
  args: ["--no-sandbox"]
});
try {
  // 794x1123 = tamanho CSS da página A4 na impressão; fator 2 -> 1588x2246 px
  const page = await browser.newPage();
  await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 2 });
  await page.goto("http://127.0.0.1:8788/", { waitUntil: "networkidle0", timeout: 45000 });
  await page.evaluate(() => {
    const style = document.createElement("style");
    style.textContent = `
      * { animation: none !important; transition: none !important; }
      .header, .catalogo, .controls, .footer, .category-bar, .toast,
      .admin-trigger, .admin-backdrop, .image-editor-backdrop, .public-intro,
      .titulo, .social-area, .print-pages, .print-bg { display: none !important; }
      html, body { background: transparent !important; margin: 0 !important; padding: 0 !important; }
      .decorations { display: block !important; position: fixed !important; inset: 0 !important; z-index: 1 !important; }
    `;
    document.head.append(style);
  });
  await new Promise((resolve) => setTimeout(resolve, 800));
  const decorations = await page.screenshot({ type: "png", omitBackground: true });
  const base = await readFile(basePath);

  const composePage = await browser.newPage();
  const base64 = base.toString("base64");
  const deco64 = decorations.toString("base64");
  await composePage.goto("data:text/html,<canvas id=\"c\" width=\"1588\" height=\"2246\"></canvas>");
  const jpegBase64 = await composePage.evaluate(async ({ base64, deco64 }) => {
    const canvas = document.getElementById("c");
    const context = canvas.getContext("2d");
    const baseImage = new Image();
    const decoImage = new Image();
    baseImage.src = `data:image/jpeg;base64,${base64}`;
    decoImage.src = `data:image/png;base64,${deco64}`;
    await Promise.all([baseImage.decode(), decoImage.decode()]);
    context.drawImage(baseImage, 0, 0, 1588, 2246);
    context.drawImage(decoImage, 0, 0, 1588, 2246);
    return canvas.toDataURL("image/jpeg", 0.9).split(",")[1];
  }, { base64, deco64 });
  await writeFile(output, Buffer.from(jpegBase64, "base64"));
  const stats = await import("node:fs/promises").then((fs) => fs.stat(output));
  console.log(`Fundo de impressão capturado: ${output} (${stats.size} bytes)`);
} finally {
  await browser.close();
  server.close();
}
