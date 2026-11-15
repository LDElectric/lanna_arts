import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

await mkdir("dist", { recursive: true });

const html = await readFile("index.html", "utf8");
const app = await readFile("app.js", "utf8");
const qrCodes = [
  ["__QR_INSTAGRAM__", "qr-instagram-transparente.png"],
  ["__QR_TIKTOK__", "qr-tiktok-transparente.png"]
];
let selfContainedHtml = html;

for (const [placeholder, filename] of qrCodes) {
  if (!selfContainedHtml.includes(placeholder)) {
    throw new Error(`Missing QR image placeholder: ${placeholder}`);
  }
  const image = await readFile(resolve("QRcodes", filename));
  selfContainedHtml = selfContainedHtml.replace(
    placeholder,
    `data:image/png;base64,${image.toString("base64")}`
  );
}

const scriptTag = '  <script src="app.js" defer></script>';
if (!selfContainedHtml.includes(scriptTag)) {
  throw new Error("Missing application script placeholder in index.html.");
}
selfContainedHtml = selfContainedHtml.replace(scriptTag, `<script>\n${app}\n  </script>`);

await writeFile("dist/index.html", selfContainedHtml);
