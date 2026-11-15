const catalogElement = document.getElementById("catalogo");
const toastElement = document.getElementById("toast");
const adminDialog = document.getElementById("adminDialog");
const loginForm = document.getElementById("loginForm");
const adminPanel = document.getElementById("adminPanel");
const adminStatus = document.getElementById("adminStatus");
const qrUpload = document.getElementById("qrUpload");
const qrPrintImage = document.getElementById("qrPrintImage");
const imageEditorDialog = document.getElementById("imageEditorDialog");
const imageEditorCard = document.getElementById("imageEditorCard");
const imageEditorFrame = document.getElementById("imageEditorFrame");
const imageEditorContent = document.getElementById("imageEditorContent");
const imageEditorImage = document.getElementById("imageEditorImage");
const imageEditorTitle = document.getElementById("imageEditorTitle");
const imageEditorHint = document.getElementById("imageEditorHint");
const imageEditorZoom = document.getElementById("imageEditorZoom");
const imageEditorZoomValue = document.getElementById("imageEditorZoomValue");

let catalog = { title: "Catálogo de Desenhos", instagram: "Lanna.artees", tiktok: "lanna.lopess", images: [] };
let admin = false;
let activeImage = null;
let imageBackup = null;
let imageEditorTrigger = null;
let previousBodyOverflow = "";
let editorPointers = new Map();
let editorGesture = null;

async function api(url, options = {}) {
  const response = await fetch(url, { credentials: "same-origin", ...options });
  const contentType = response.headers.get("Content-Type") || "";
  const body = contentType.includes("application/json") ? await response.json() : null;
  if (!response.ok) throw new Error(body?.error || `Falha na solicitação (${response.status}).`);
  return body;
}

function showToast(message) {
  toastElement.textContent = message;
  toastElement.classList.add("show");
  window.setTimeout(() => toastElement.classList.remove("show"), 2800);
}

function updateHeader() {
  document.getElementById("tituloDisplay").textContent = catalog.title;
  document.title = catalog.title;
  const instagramUrl = `https://www.instagram.com/${encodeURIComponent(catalog.instagram)}/`;
  document.getElementById("instagramQrLink").href = instagramUrl;
  document.getElementById("instagramQrLink").ariaLabel = `QR Code do Instagram @${catalog.instagram}`;
  document.getElementById("instagramProfileLink").href = instagramUrl;
  document.getElementById("instagramName").textContent = `@${catalog.instagram}`;
  document.getElementById("instagramQrLabel").textContent = `@${catalog.instagram}`;

  const tiktokUsername = catalog.tiktok || "lanna.lopess";
  const tiktokUrl = `https://www.tiktok.com/@${encodeURIComponent(tiktokUsername)}`;
  document.getElementById("tiktokQrLink").href = tiktokUrl;
  document.getElementById("tiktokQrLink").ariaLabel = `QR Code do TikTok @${tiktokUsername}`;
  document.getElementById("tiktokProfileLink").href = tiktokUrl;
  document.getElementById("tiktokName").textContent = `@${tiktokUsername}`;
  document.getElementById("tiktokQrLabel").textContent = `@${tiktokUsername}`;
}

function setAdmin(value) {
  admin = value;
  document.getElementById("btnAdd").hidden = !admin;
  document.getElementById("btnPrint").hidden = !admin;
  document.getElementById("adminTitle").textContent = admin ? "Gerenciar catálogo" : "Acesso da Lanna";
  loginForm.hidden = admin;
  adminPanel.hidden = !admin;
  adminStatus.textContent = "";
  if (admin) {
    adminPanel.elements.title.value = catalog.title;
    adminPanel.elements.instagram.value = catalog.instagram;
    adminPanel.elements.tiktok.value = catalog.tiktok;
  }
  render();
}

async function loadCatalog() {
  catalog = await api("/api/catalog");
  updateHeader();
  render();
}

async function saveCatalog() {
  await api("/api/admin/catalog", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: catalog.title,
      instagram: catalog.instagram,
      tiktok: catalog.tiktok,
      images: catalog.images.map(({ id, key, scale, offsetX, offsetY }) =>
        ({ id, key, scale, offsetX, offsetY }))
    })
  });
}

async function refreshAdminCatalog() {
  const data = await api("/api/admin/catalog");
  catalog = { ...catalog, ...data };
  updateHeader();
  render();
  setAdmin(true);
}

function render() {
  catalogElement.replaceChildren();
  for (const image of catalog.images) {
    const frame = document.createElement("div");
    frame.className = "frame";
    frame.dataset.id = image.id;

    const content = document.createElement("div");
    content.className = "frame-content";
    content.tabIndex = 0;
    content.setAttribute("role", "button");
    content.setAttribute("aria-label", admin
      ? "Ampliar e ajustar desenho"
      : "Ampliar desenho");
    const picture = document.createElement("img");
    picture.src = image.src;
    picture.alt = "Desenho do catálogo";
    picture.addEventListener("load", () => updateImageTransform(picture, image));
    content.addEventListener("click", () => openImageEditor(image, admin));
    content.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openImageEditor(image, admin);
      }
    });
    content.append(picture);
    frame.append(content);

    if (admin) addFrameActions(frame, image);
    catalogElement.append(frame);
    requestAnimationFrame(() => updateImageTransform(picture, image));
  }
}

function updateRenderedTransforms() {
  for (const frame of catalogElement.querySelectorAll(".frame")) {
    const image = catalog.images.find((entry) => String(entry.id) === frame.dataset.id);
    const picture = frame.querySelector("img");
    if (image && picture) updateImageTransform(picture, image);
  }
  if (activeImage) updateImageTransform(imageEditorImage, activeImage);
}

window.addEventListener("resize", updateRenderedTransforms);

function addFrameActions(frame, image) {
  const actions = document.createElement("div");
  actions.className = "frame-actions";
  actions.innerHTML = `
    <button class="frame-btn adjust" type="button" title="Ajustar posição/zoom">✎</button>
    <button class="frame-btn replace" type="button" title="Trocar imagem">↺</button>
    <button class="frame-btn delete" type="button" title="Remover desenho">✕</button>`;
  frame.append(actions);

  actions.querySelector(".adjust").addEventListener("click", () => openImageEditor(image, true));
  actions.querySelector(".replace").addEventListener("click", () => chooseDrawing(image.id));
  actions.querySelector(".delete").addEventListener("click", async () => {
    if (!window.confirm("Remover este desenho do catálogo?")) return;
    try {
      await api(`/api/admin/images/${encodeURIComponent(image.key)}`, { method: "DELETE" });
      catalog.images = catalog.images.filter((entry) => entry.id !== image.id);
      render();
      showToast("Desenho removido.");
    } catch (error) {
      showToast(error.message);
    }
  });
}

function openImageEditor(image, editable) {
  activeImage = image;
  imageBackup = editable ? { ...image } : null;
  imageEditorTrigger = document.activeElement;
  imageEditorCard.classList.toggle("is-editing", editable);
  imageEditorTitle.textContent = editable ? "Ajustar desenho" : "Visualizar desenho";
  imageEditorHint.textContent = editable
    ? "Arraste para reposicionar; use dois dedos para zoom e movimento."
    : "Visualização ampliada do desenho.";
  imageEditorImage.src = image.src;
  imageEditorImage.alt = "Desenho ampliado";
  imageEditorZoom.value = String(image.scale);
  updateZoomValue();
  previousBodyOverflow = document.body.style.overflow;
  document.body.style.overflow = "hidden";
  imageEditorDialog.hidden = false;
  editorPointers.clear();
  editorGesture = null;
  requestAnimationFrame(() => {
    updateImageTransform(imageEditorImage, image);
    document.getElementById("imageEditorClose").focus();
  });
}

function closeImageEditor(restore = imageBackup !== null, refreshCatalog = restore) {
  const activeImageId = activeImage?.id;
  if (restore && activeImage && imageBackup) Object.assign(activeImage, imageBackup);
  imageEditorDialog.hidden = true;
  document.body.style.overflow = previousBodyOverflow;
  editorPointers.clear();
  editorGesture = null;
  if (refreshCatalog) render();
  const focusTarget = activeImageId === undefined
    ? null
    : catalogElement.querySelector(`.frame[data-id="${activeImageId}"] .frame-content`);
  (focusTarget || imageEditorTrigger)?.focus?.();
  activeImage = null;
  imageBackup = null;
  imageEditorTrigger = null;
}

function updateImageTransform(picture, image) {
  if (picture.naturalWidth && picture.naturalHeight) {
    const fitScale = Math.min(280 / picture.naturalWidth, 320 / picture.naturalHeight);
    const fitW = (picture.naturalWidth * fitScale) / 280;
    const fitH = (picture.naturalHeight * fitScale) / 320;
    picture.style.width = `${fitW * 100}%`;
    picture.style.height = `${fitH * 100}%`;
  }
  const xRatio = (image.offsetX || 0) / 280;
  const yRatio = (image.offsetY || 0) / 320;
  picture.style.left = `calc(50% + ${xRatio * 100}%)`;
  picture.style.top = `calc(50% + ${yRatio * 100}%)`;
  picture.style.transform = `translate(-50%, -50%) scale(${image.scale || 1})`;
}

function updateZoomValue() {
  imageEditorZoomValue.value = `${Math.round(Number(imageEditorZoom.value) * 100)}%`;
}

function pointerCenter(points) {
  const [first, second] = points;
  return {
    x: (first.x + second.x) / 2,
    y: (first.y + second.y) / 2
  };
}

function startEditorGesture() {
  const pointers = Array.from(editorPointers.values());
  if (!activeImage || pointers.length === 0) {
    editorGesture = null;
    return;
  }

  const image = activeImage;
  const frameRect = imageEditorFrame.getBoundingClientRect();
  const layoutScale = frameRect.width / 280;
  if (pointers.length === 1) {
    const pointer = pointers[0];
    editorGesture = {
      type: "pan",
      x: pointer.x,
      y: pointer.y,
      offsetX: image.offsetX,
      offsetY: image.offsetY
    };
    return;
  }

  const [first, second] = pointers;
  const center = pointerCenter(pointers);
  const initialDistance = Math.hypot(second.x - first.x, second.y - first.y);
  if (initialDistance === 0) return;
  const anchorX = (center.x - frameRect.left - frameRect.width / 2) / layoutScale;
  const anchorY = (center.y - frameRect.top - frameRect.height / 2) / layoutScale;
  editorGesture = {
    type: "pinch",
    distance: initialDistance,
    scale: image.scale,
    sourceX: (anchorX - image.offsetX) / image.scale,
    sourceY: (anchorY - image.offsetY) / image.scale
  };
}

function onEditorPointerDown(event) {
  if (!imageBackup || !activeImage) return;
  event.preventDefault();
  imageEditorContent.setPointerCapture(event.pointerId);
  editorPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  startEditorGesture();
}

function onEditorPointerMove(event) {
  if (!imageBackup || !editorPointers.has(event.pointerId) || !activeImage) return;
  editorPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  const image = activeImage;

  if (editorGesture?.type === "pan" && editorPointers.size === 1) {
    const [pointer] = editorPointers.values();
    const layoutScale = imageEditorFrame.clientWidth / 280;
    image.offsetX = editorGesture.offsetX + (pointer.x - editorGesture.x) / layoutScale;
    image.offsetY = editorGesture.offsetY + (pointer.y - editorGesture.y) / layoutScale;
  } else if (editorGesture?.type === "pinch" && editorPointers.size >= 2) {
    const pointers = Array.from(editorPointers.values()).slice(0, 2);
    const center = pointerCenter(pointers);
    const distance = Math.hypot(pointers[1].x - pointers[0].x, pointers[1].y - pointers[0].y);
    const frameRect = imageEditorFrame.getBoundingClientRect();
    const layoutScale = frameRect.width / 280;
    const scale = Math.min(3, Math.max(0.4, editorGesture.scale * distance / editorGesture.distance));
    const anchorX = (center.x - frameRect.left - frameRect.width / 2) / layoutScale;
    const anchorY = (center.y - frameRect.top - frameRect.height / 2) / layoutScale;
    image.scale = scale;
    image.offsetX = anchorX - editorGesture.sourceX * scale;
    image.offsetY = anchorY - editorGesture.sourceY * scale;
    imageEditorZoom.value = String(scale);
    updateZoomValue();
  }

  updateImageTransform(imageEditorImage, image);
}

function onEditorPointerUp(event) {
  editorPointers.delete(event.pointerId);
  startEditorGesture();
}

document.getElementById("imageEditorClose").addEventListener("click", () => closeImageEditor());
imageEditorImage.addEventListener("load", () => {
  if (activeImage) updateImageTransform(imageEditorImage, activeImage);
});
document.getElementById("imageEditorCancel").addEventListener("click", () => closeImageEditor(true, true));
document.getElementById("imageEditorSave").addEventListener("click", async (event) => {
  const button = event.currentTarget;
  button.disabled = true;
  try {
    await saveCatalog();
    closeImageEditor(false, true);
    showToast("Ajuste salvo.");
  } catch (error) {
    showToast(error.message);
  } finally {
    button.disabled = false;
  }
});
document.getElementById("imageEditorReset").addEventListener("click", () => {
  if (!activeImage) return;
  activeImage.scale = 1;
  activeImage.offsetX = 0;
  activeImage.offsetY = 0;
  imageEditorZoom.value = "1";
  updateZoomValue();
  updateImageTransform(imageEditorImage, activeImage);
});
imageEditorZoom.addEventListener("input", () => {
  if (!activeImage || !imageBackup) return;
  activeImage.scale = Number(imageEditorZoom.value);
  updateZoomValue();
  updateImageTransform(imageEditorImage, activeImage);
});
imageEditorContent.addEventListener("pointerdown", onEditorPointerDown);
imageEditorContent.addEventListener("pointermove", onEditorPointerMove);
imageEditorContent.addEventListener("pointerup", onEditorPointerUp);
imageEditorContent.addEventListener("pointercancel", onEditorPointerUp);
imageEditorDialog.addEventListener("click", (event) => {
  if (event.target === imageEditorDialog) closeImageEditor();
});
imageEditorDialog.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    event.preventDefault();
    closeImageEditor();
    return;
  }
  if (event.key !== "Tab") return;
  const focusable = Array.from(imageEditorCard.querySelectorAll("button:not(:disabled), input:not(:disabled)"))
    .filter((element) => element.offsetParent !== null);
  if (focusable.length === 0) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
});

function chooseDrawing(id = null) {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/png,image/jpeg,image/webp";
  input.multiple = id === null;
  input.addEventListener("change", async () => {
    const files = Array.from(input.files || []);
    for (const file of files) {
      const imageId = id ?? Math.max(0, ...catalog.images.map((image) => image.id)) + 1;
      try {
        await uploadImage(file, "drawing", imageId);
      } catch (error) {
        showToast(error.message);
        return;
      }
      id = null;
    }
  });
  input.click();
}

async function uploadImage(file, kind, id) {
  const form = new FormData();
  form.set("file", file);
  form.set("kind", kind);
  if (id !== undefined) form.set("id", String(id));
  const result = await api("/api/admin/images", { method: "POST", body: form });
  if (kind === "drawing") {
    const existing = catalog.images.find((image) => image.id === id);
    if (existing) Object.assign(existing, { key: result.key, src: result.src, scale: 1, offsetX: 0, offsetY: 0 });
    else catalog.images.push({ id, key: result.key, src: result.src, scale: 1, offsetX: 0, offsetY: 0 });
    render();
    showToast("Desenho enviado.");
  } else {
    catalog.qr = result.src;
    showToast("QR de impressão atualizado.");
  }
}

document.getElementById("adminButton").addEventListener("click", async () => {
  adminDialog.hidden = false;
  setAdmin(false);
  try {
    const session = await api("/api/admin/session");
    if (session.authenticated) await refreshAdminCatalog();
  } catch (error) {
    adminStatus.textContent = error.message;
  }
});

document.getElementById("adminClose").addEventListener("click", () => {
  adminDialog.hidden = true;
});

adminDialog.addEventListener("click", (event) => {
  if (event.target === adminDialog) adminDialog.hidden = true;
});

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  adminStatus.textContent = "";
  const data = new FormData(loginForm);
  try {
    await api("/api/admin/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: data.get("username"), password: data.get("password") })
    });
    loginForm.reset();
    await refreshAdminCatalog();
  } catch (error) {
    adminStatus.textContent = error.message;
  }
});

adminPanel.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = new FormData(adminPanel);
  catalog.title = String(data.get("title")).trim();
  catalog.instagram = String(data.get("instagram")).trim();
  catalog.tiktok = String(data.get("tiktok")).trim();
  try {
    await saveCatalog();
    updateHeader();
    render();
    adminStatus.textContent = "Alterações salvas.";
  } catch (error) {
    adminStatus.textContent = error.message;
  }
});

document.getElementById("btnAdd").addEventListener("click", () => chooseDrawing());
document.getElementById("qrUploadButton").addEventListener("click", () => qrUpload.click());
qrUpload.addEventListener("change", async () => {
  const file = qrUpload.files?.[0];
  if (!file) return;
  try {
    await uploadImage(file, "qr");
  } catch (error) {
    adminStatus.textContent = error.message;
  } finally {
    qrUpload.value = "";
  }
});

document.getElementById("logoutButton").addEventListener("click", async () => {
  try {
    await api("/api/admin/session", { method: "DELETE" });
    setAdmin(false);
    adminDialog.hidden = true;
    render();
    showToast("Sessão encerrada.");
  } catch (error) {
    adminStatus.textContent = error.message;
  }
});

document.getElementById("btnPrint").addEventListener("click", async () => {
  if (catalog.images.length === 0) {
    showToast("Adicione pelo menos um desenho para imprimir.");
    return;
  }
  try {
    const data = await api("/api/admin/catalog");
    if (data.qr) {
      qrPrintImage.src = data.qr;
      qrPrintBox.classList.add("has-pix");
      await qrPrintImage.decode();
    } else {
      qrPrintImage.removeAttribute("src");
      qrPrintBox.classList.remove("has-pix");
    }
    updateRenderedTransforms();
    document.body.classList.add("has-print-qr");
    window.print();
  } catch (error) {
    showToast(error.message);
  }
});

window.addEventListener("beforeprint", () => {
  document.body.classList.add("has-print-qr");
  updateRenderedTransforms();
});

window.addEventListener("afterprint", () => {
  document.body.classList.remove("has-print-qr");
  qrPrintImage.removeAttribute("src");
  qrPrintBox.classList.remove("has-pix");
  updateRenderedTransforms();
});

loadCatalog().catch((error) => {
  catalogElement.textContent = "Catálogo temporariamente indisponível.";
  showToast(error.message);
});
