import { clamp, getMaskValue } from "./image-processing";

export function getOverlayPixel(autoMask, manualMask, index) {
  const manual = getMaskValue(manualMask, index);
  const auto = getMaskValue(autoMask, index);
  const alpha = Math.max(manual, auto * 0.45);
  if (!alpha) return null;
  return {
    r: manual ? 255 : 96,
    g: manual ? 98 : 190,
    b: manual ? 64 : 255,
    a: Math.min(manual ? 125 : 82, alpha * 0.5),
  };
}

export function drawMaskOverlay(maskCanvas, autoMask, manualMask, isVisible) {
  if (!maskCanvas) return;

  const ctx = maskCanvas.getContext("2d");
  ctx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
  if (!isVisible) return;

  const width = maskCanvas.width;
  const height = maskCanvas.height;
  const overlay = ctx.createImageData(width, height);

  for (let i = 0; i < width * height; i += 1) {
    const pixel = getOverlayPixel(autoMask, manualMask, i);
    if (!pixel) continue;
    const offset = i * 4;
    overlay.data[offset] = pixel.r;
    overlay.data[offset + 1] = pixel.g;
    overlay.data[offset + 2] = pixel.b;
    overlay.data[offset + 3] = pixel.a;
  }
  ctx.putImageData(overlay, 0, 0);
}

export function getCanvasPoint(maskCanvas, event) {
  if (!maskCanvas) return null;

  const rect = maskCanvas.getBoundingClientRect();
  const clientX = event.clientX ?? event.touches?.[0]?.clientX;
  const clientY = event.clientY ?? event.touches?.[0]?.clientY;
  if (clientX == null || clientY == null) return null;

  return {
    x: clamp(((clientX - rect.left) / rect.width) * maskCanvas.width, 0, maskCanvas.width - 1),
    y: clamp(((clientY - rect.top) / rect.height) * maskCanvas.height, 0, maskCanvas.height - 1),
  };
}

export function paintCircle(mask, centerX, centerY, radius) {
  const startX = Math.max(0, Math.floor(centerX - radius));
  const endX = Math.min(mask.width - 1, Math.ceil(centerX + radius));
  const startY = Math.max(0, Math.floor(centerY - radius));
  const endY = Math.min(mask.height - 1, Math.ceil(centerY + radius));

  for (let y = startY; y <= endY; y += 1) {
    for (let x = startX; x <= endX; x += 1) {
      const distance = Math.hypot(x - centerX, y - centerY);
      if (distance > radius) continue;
      const feather = clamp(1 - distance / radius, 0, 1);
      const index = y * mask.width + x;
      mask.data[index] = Math.max(mask.data[index], 105 + feather * 150);
    }
  }
}

export function drawOverlayCircle(ctx, centerX, centerY, radius) {
  const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
  gradient.addColorStop(0, "rgb(255 98 64 / 48%)");
  gradient.addColorStop(0.72, "rgb(255 98 64 / 28%)");
  gradient.addColorStop(1, "rgb(255 98 64 / 0%)");
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  ctx.fill();
}
