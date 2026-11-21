import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

await mkdir("dist", { recursive: true });

const html = await readFile("index.html", "utf8");
const app = await readFile("app.js", "utf8");
const images = [
  ["__LOGO__", "lanna-artes-logo-web.png", "image/png"],
  ["__QR_INSTAGRAM__", "QRcodes/qr-instagram-web.png", "image/png"],
  ["__QR_TIKTOK__", "QRcodes/qr-tiktok-web.png", "image/png"],
  ["__QR_PIX__", "QRcodes/QRcode_PIX_preto.svg", "image/svg+xml"],
  ["__PRINT_BG__", "print-background.jpg", "image/jpeg"]
];
let selfContainedHtml = html;

for (const [placeholder, filename, mime] of images) {
  if (!selfContainedHtml.includes(placeholder)) {
    throw new Error(`Missing image placeholder: ${placeholder}`);
  }
  const image = await readFile(resolve(filename));
  selfContainedHtml = selfContainedHtml.replace(
    placeholder,
    `data:${mime};base64,${image.toString("base64")}`
  );
}

const scriptTag = '  <script src="app.js" defer></script>';
if (!selfContainedHtml.includes(scriptTag)) {
  throw new Error("Missing application script placeholder in index.html.");
}
selfContainedHtml = selfContainedHtml.replace(scriptTag, `<script>\n${app}\n  </script>`);

await writeFile("dist/index.html", selfContainedHtml);
