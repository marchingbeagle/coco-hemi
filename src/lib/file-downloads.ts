export function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Nao foi possivel ler a imagem."));
    reader.readAsDataURL(file);
  });
}

export function safeFileName(name) {
  return String(name || "coco-hemi-photo")
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120);
}

export function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = safeFileName(fileName);
  link.rel = "noopener";
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1200);
}

export function downloadCanvas(canvas, fileName) {
  canvas.toBlob((blob) => {
    if (blob) {
      downloadBlob(blob, fileName);
      return;
    }

    const link = document.createElement("a");
    link.download = safeFileName(fileName);
    link.href = canvas.toDataURL("image/png");
    document.body.appendChild(link);
    link.click();
    link.remove();
  }, "image/png");
}

export async function downloadDataUrl(dataUrl, fileName) {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  downloadBlob(blob, fileName);
}
