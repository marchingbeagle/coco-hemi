import { clamp, getMaskValue } from "./image-processing";

export function makeMask(width, height, fill = 0) {
  const data = new Uint8ClampedArray(width * height);
  if (fill) data.fill(fill);
  return { width, height, data };
}

export function buildHeuristicMask(imageData) {
  const mask = makeMask(imageData.width, imageData.height);
  const pixels = imageData.data;
  for (let i = 0; i < mask.data.length; i += 1) {
    const offset = i * 4;
    const x = i % imageData.width;
    const y = Math.floor(i / imageData.width);
    mask.data[i] = getAutoSubjectValue(
      { r: pixels[offset], g: pixels[offset + 1], b: pixels[offset + 2] },
      x,
      y,
      imageData.width,
      imageData.height,
    );
  }
  return mask;
}

export function resampleMask(source, targetWidth, targetHeight) {
  const mask = makeMask(targetWidth, targetHeight);
  for (let y = 0; y < targetHeight; y += 1) {
    const sourceY = Math.min(source.height - 1, Math.floor((y / targetHeight) * source.height));
    for (let x = 0; x < targetWidth; x += 1) {
      const sourceX = Math.min(source.width - 1, Math.floor((x / targetWidth) * source.width));
      mask.data[y * targetWidth + x] = source.data[sourceY * source.width + sourceX];
    }
  }
  return mask;
}

export function resampleMaskData(sourceData, sourceWidth, sourceHeight, targetWidth, targetHeight) {
  return resampleMask({ width: sourceWidth, height: sourceHeight, data: sourceData }, targetWidth, targetHeight);
}

export function getMaskBounds(mask, threshold = 50) {
  let minX = mask.width;
  let minY = mask.height;
  let maxX = 0;
  let maxY = 0;
  let found = false;

  for (let y = 0; y < mask.height; y += 1) {
    for (let x = 0; x < mask.width; x += 1) {
      if (mask.data[y * mask.width + x] <= threshold) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      found = true;
    }
  }

  return found ? { minX, minY, maxX, maxY } : null;
}

export function hasNearbyMask(mask, x, y, radius, threshold) {
  const startX = Math.max(0, x - radius);
  const endX = Math.min(mask.width - 1, x + radius);
  const startY = Math.max(0, y - radius);
  const endY = Math.min(mask.height - 1, y + radius);

  for (let yy = startY; yy <= endY; yy += 1) {
    for (let xx = startX; xx <= endX; xx += 1) {
      if (mask.data[yy * mask.width + xx] > threshold) return true;
    }
  }
  return false;
}

export function getLocalContrast(pixels, width, height, x, y) {
  const centerOffset = (y * width + x) * 4;
  const center = (pixels[centerOffset] + pixels[centerOffset + 1] + pixels[centerOffset + 2]) / 3;
  let total = 0;
  let count = 0;

  for (let yy = Math.max(0, y - 1); yy <= Math.min(height - 1, y + 1); yy += 1) {
    for (let xx = Math.max(0, x - 1); xx <= Math.min(width - 1, x + 1); xx += 1) {
      const offset = (yy * width + xx) * 4;
      const value = (pixels[offset] + pixels[offset + 1] + pixels[offset + 2]) / 3;
      total += Math.abs(value - center);
      count += 1;
    }
  }

  return count ? total / count : 0;
}

export function getHairSearchArea(mask, bounds) {
  const bodyHeight = Math.max(1, bounds.maxY - bounds.minY);
  const padX = Math.round(mask.width * 0.08);
  return {
    top: Math.max(0, bounds.minY - Math.round(bodyHeight * 0.16)),
    bottom: Math.min(mask.height - 1, bounds.minY + Math.round(bodyHeight * 0.34)),
    left: Math.max(0, bounds.minX - padX),
    right: Math.min(mask.width - 1, bounds.maxX + padX),
  };
}

export function getHairMaskValue(pixels, mask, x, y) {
  const index = y * mask.width + x;
  const offset = index * 4;
  const r = pixels[offset];
  const g = pixels[offset + 1];
  const b = pixels[offset + 2];
  const brightness = (r + g + b) / 3;
  const contrast = getLocalContrast(pixels, mask.width, mask.height, x, y);
  const isDarkHair = brightness < 118 && contrast > 7;
  const isBrownHair = r > g * 0.9 && r > b * 1.05 && brightness < 150 && contrast > 5;

  if (isDarkHair) return 190;
  if (isBrownHair) return 145;
  return 0;
}

export function expandHairCandidates(enhanced, mask, imageData, area) {
  const pixels = imageData.data;
  for (let y = area.top; y <= area.bottom; y += 1) {
    for (let x = area.left; x <= area.right; x += 1) {
      const index = y * mask.width + x;
      if (enhanced.data[index] > 170) continue;
      if (!hasNearbyMask(mask, x, y, 5, 60)) continue;
      enhanced.data[index] = Math.max(enhanced.data[index], getHairMaskValue(pixels, mask, x, y));
    }
  }
}

export function dilateEnhancedHair(enhanced, mask, area) {
  const dilated = makeMask(mask.width, mask.height);
  dilated.data.set(enhanced.data);
  for (let y = area.top; y <= area.bottom; y += 1) {
    for (let x = area.left; x <= area.right; x += 1) {
      const value = enhanced.data[y * mask.width + x];
      if (value < 80) continue;
      applyHairDilationPoint(dilated, mask, x, y, value);
    }
  }
  return dilated;
}

export function applyHairDilationPoint(dilated, mask, x, y, value) {
  for (let yy = Math.max(0, y - 2); yy <= Math.min(mask.height - 1, y + 2); yy += 1) {
    for (let xx = Math.max(0, x - 2); xx <= Math.min(mask.width - 1, x + 2); xx += 1) {
      const distance = Math.hypot(xx - x, yy - y);
      if (distance > 2.2) continue;
      const target = yy * mask.width + xx;
      dilated.data[target] = Math.max(dilated.data[target], value - distance * 32);
    }
  }
}

export function enhanceHairMask(mask, imageData) {
  const bounds = getMaskBounds(mask);
  if (!bounds) return mask;

  const enhanced = makeMask(mask.width, mask.height);
  enhanced.data.set(mask.data);
  const area = getHairSearchArea(mask, bounds);
  expandHairCandidates(enhanced, mask, imageData, area);
  return dilateEnhancedHair(enhanced, mask, area);
}

export function combineMasks(autoMask, manualMask) {
  const source = manualMask || autoMask;
  if (!source) return null;

  const combined = makeMask(source.width, source.height);
  for (let i = 0; i < combined.data.length; i += 1) {
    combined.data[i] = Math.max(getMaskValue(autoMask, i), getMaskValue(manualMask, i));
  }
  return combined;
}

export function copyImageData(imageData) {
  return new ImageData(new Uint8ClampedArray(imageData.data), imageData.width, imageData.height);
}

export function extractMediaPipeMask(result, targetWidth, targetHeight) {
  const confidenceMask = result.confidenceMasks?.[0];
  const categoryMask = result.categoryMask;

  if (confidenceMask?.getAsFloat32Array) {
    const values = confidenceMask.getAsFloat32Array();
    const data = new Uint8ClampedArray(values.length);
    for (let i = 0; i < values.length; i += 1) {
      data[i] = clamp(values[i] * 255);
    }
    return resampleMaskData(data, confidenceMask.width, confidenceMask.height, targetWidth, targetHeight);
  }

  if (categoryMask?.getAsUint8Array) {
    const values = categoryMask.getAsUint8Array();
    const data = new Uint8ClampedArray(values.length);
    for (let i = 0; i < values.length; i += 1) {
      data[i] = values[i] ? 255 : 0;
    }
    return resampleMaskData(data, categoryMask.width, categoryMask.height, targetWidth, targetHeight);
  }

  return null;
}

export function getAutoMaskLabel(status) {
  if (status === "loading") return "Lendo";
  if (status === "ready") return "IA ativa";
  if (status === "fallback") return "Fallback";
  if (status === "error") return "Manual";
  return "Aguardando";
}

export function getRecognitionStepMessage(status) {
  if (status === "loading") return "Estamos reconhecendo o assunto principal antes de liberar os filtros.";
  if (status === "ready") return "Reconhecimento concluido. Revise a selecao e avance para editar a imagem.";
  if (status === "fallback") return "Reconhecimento local aplicado. Voce pode recalcular ou seguir para a edicao.";
  if (status === "error") return "Nao foi possivel usar a IA local. Siga com ajuste manual se necessario.";
  return "A imagem foi carregada. Aguarde o reconhecimento para continuar.";
}

