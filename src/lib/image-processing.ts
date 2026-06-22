export function clamp(value, min = 0, max = 255) {
  return Math.min(max, Math.max(min, value));
}

export function applyToneCurveChannels(channels, config) {
  const contrastOffset = 128 * (1 - config.contrast);
  return {
    r: channels.r * config.contrast + contrastOffset,
    g: channels.g * config.contrast + contrastOffset,
    b: channels.b * config.contrast + contrastOffset,
  };
}

export function applySaturationChannels(channels, saturation) {
  const gray = channels.r * 0.299 + channels.g * 0.587 + channels.b * 0.114;
  return {
    r: gray + (channels.r - gray) * saturation,
    g: gray + (channels.g - gray) * saturation,
    b: gray + (channels.b - gray) * saturation,
    gray,
  };
}

export function applyHighlightShadowChannels(channels, config) {
  const luminance = channels.r * 0.299 + channels.g * 0.587 + channels.b * 0.114;
  const highlightMask = clamp((luminance - 128) / 127, 0, 1);
  const shadowMask = clamp((128 - luminance) / 128, 0, 1);
  const delta = (config.highlights || 0) * 1.65 * highlightMask + (config.shadows || 0) * 1.65 * shadowMask;
  return { r: channels.r + delta, g: channels.g + delta, b: channels.b + delta };
}

export function applyVibranceChannels(channels, gray, vibrance) {
  const maxChannel = Math.max(channels.r, channels.g, channels.b);
  const boost = ((255 - maxChannel) / 255) * (vibrance / 100);
  return {
    r: gray + (channels.r - gray) * (1 + boost),
    g: gray + (channels.g - gray) * (1 + boost),
    b: gray + (channels.b - gray) * (1 + boost),
  };
}

export function applyFadeChannels(channels, fade) {
  const amount = fade / 100;
  return {
    r: channels.r + (245 - channels.r) * amount,
    g: channels.g + (238 - channels.g) * amount,
    b: channels.b + (225 - channels.b) * amount,
  };
}

export function transformPixel(pixel, config) {
  const exposure = Math.pow(2, config.exposure || 0);
  let channels = {
    r: pixel.r * exposure * config.brightness + (config.warmth || 0),
    g: pixel.g * exposure * config.brightness + (config.warmth || 0) * 0.35,
    b: pixel.b * exposure * config.brightness - (config.warmth || 0) * 0.45,
  };

  channels = applyToneCurveChannels(channels, config);
  const saturated = applySaturationChannels(channels, config.saturation);
  channels = saturated;

  if (config.highlights || config.shadows) {
    channels = applyHighlightShadowChannels(channels, config);
  }

  if (config.vibrance) {
    channels = applyVibranceChannels(channels, saturated.gray, config.vibrance);
  }

  if (config.fade) {
    channels = applyFadeChannels(channels, config.fade);
  }

  return { r: clamp(channels.r), g: clamp(channels.g), b: clamp(channels.b) };
}

export function applySharpness(imageData, amount) {
  if (!amount) return imageData;

  const strength = Math.min(0.85, amount / 85);
  const { data, width, height } = imageData;
  const source = new Uint8ClampedArray(data);

  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const index = (y * width + x) * 4;
      const left = index - 4;
      const right = index + 4;
      const top = index - width * 4;
      const bottom = index + width * 4;

      for (let channel = 0; channel < 3; channel += 1) {
        const blur =
          (source[left + channel] +
            source[right + channel] +
            source[top + channel] +
            source[bottom + channel] +
            source[index + channel] * 4) /
          8;
        data[index + channel] = clamp(source[index + channel] + (source[index + channel] - blur) * strength);
      }
    }
  }

  return imageData;
}

export function applyGrain(imageData, amount) {
  if (!amount) return imageData;

  const { data } = imageData;
  const strength = amount * 0.9;
  for (let i = 0; i < data.length; i += 4) {
    const pixelIndex = i / 4;
    const hash = (pixelIndex * 9301 + 49297) % 233280;
    const noise = (hash / 233280 - 0.5) * strength;
    data[i] = clamp(data[i] + noise);
    data[i + 1] = clamp(data[i + 1] + noise);
    data[i + 2] = clamp(data[i + 2] + noise);
  }

  return imageData;
}

export function getAutoSubjectValue(pixel, x, y, width, height) {
  const normalizedX = (x - width / 2) / (width * 0.27);
  const normalizedY = (y - height * 0.56) / (height * 0.42);
  const centerMask = clamp(1 - (normalizedX * normalizedX + normalizedY * normalizedY), 0, 1);
  const skinMask =
    pixel.r > 72 &&
    pixel.g > 38 &&
    pixel.b > 24 &&
    pixel.r > pixel.g * 1.05 &&
    pixel.g > pixel.b * 0.82 &&
    Math.max(pixel.r, pixel.g, pixel.b) - Math.min(pixel.r, pixel.g, pixel.b) > 22
      ? 1
      : 0;
  const brightObjectMask =
    centerMask > 0.15 && pixel.r + pixel.g + pixel.b > 210 && Math.abs(pixel.r - pixel.g) < 80
      ? 0.45
      : 0;

  return clamp((centerMask * 0.62 + skinMask * 0.86 + brightObjectMask) * 255, 0, 255);
}

export function mixPixels(base, overlay, amount) {
  return {
    r: base.r * (1 - amount) + overlay.r * amount,
    g: base.g * (1 - amount) + overlay.g * amount,
    b: base.b * (1 - amount) + overlay.b * amount,
  };
}

export function getMaskValue(mask, index) {
  return mask?.data?.[index] || 0;
}

export function buildBackgroundConfig(config) {
  return {
    ...config,
    brightness: config.brightness * (config.backgroundDarken || 1),
    saturation: config.saturation * (config.backgroundSaturation || 1),
    warmth: (config.warmth || 0) + (config.backgroundWarmth || 0),
  };
}

export function applySubjectLighting(pixel, config, maskValue) {
  let result = pixel;
  if (config.flash) {
    result = mixPixels(result, { r: 255, g: 238, b: 216 }, (config.flash / 100) * maskValue);
  }
  if (config.rimLight) {
    const edge = maskValue > 0.14 && maskValue < 0.76 ? config.rimLight / 100 : 0;
    result = mixPixels(result, { r: 255, g: 232, b: 190 }, edge);
  }
  return result;
}

export function applyBackgroundTint(pixel, config, y, imageHeight, maskValue) {
  if (!config.skyTint || y >= imageHeight * 0.72) return pixel;
  return mixPixels(pixel, config.skyTint, config.skyTint.amount * (1 - maskValue));
}

export function blendSubjectAware(globalPixel, subjectPixel, backgroundPixel, maskValue, subjectAware) {
  const mixed = {
    r: subjectPixel.r * maskValue + backgroundPixel.r * (1 - maskValue),
    g: subjectPixel.g * maskValue + backgroundPixel.g * (1 - maskValue),
    b: subjectPixel.b * maskValue + backgroundPixel.b * (1 - maskValue),
  };
  return {
    r: globalPixel.r * (1 - subjectAware) + mixed.r * subjectAware,
    g: globalPixel.g * (1 - subjectAware) + mixed.g * subjectAware,
    b: globalPixel.b * (1 - subjectAware) + mixed.b * subjectAware,
  };
}

export function applyVignetteChannels(pixel, vignette, x, y, geometry) {
  if (!vignette) return pixel;
  const distance = Math.hypot(x - geometry.centerX, y - geometry.centerY) / geometry.maxDistance;
  const shadow = 1 - Math.max(0, distance - 0.34) * (vignette / 42);
  return { r: pixel.r * shadow, g: pixel.g * shadow, b: pixel.b * shadow };
}

export function applyImageFilter(imageData, config, subjectMask) {
  const data = imageData.data;
  const subjectAware = config.subjectAware || 0;
  const vignette = config.vignette || 0;
  const backgroundConfig = buildBackgroundConfig(config);
  const vignetteGeometry = {
    centerX: imageData.width / 2,
    centerY: imageData.height * 0.52,
    maxDistance: Math.hypot(imageData.width / 2, imageData.height * 0.52),
  };

  for (let i = 0; i < data.length; i += 4) {
    const pixelIndex = i / 4;
    const x = pixelIndex % imageData.width;
    const y = Math.floor(pixelIndex / imageData.width);
    const original = { r: data[i], g: data[i + 1], b: data[i + 2] };
    const maskValue = getMaskValue(subjectMask, pixelIndex) / 255;
    const globalPixel = transformPixel(original, config);
    const subjectPixel = applySubjectLighting(transformPixel(original, config), config, maskValue);
    let backgroundPixel = transformPixel(original, backgroundConfig);

    backgroundPixel = applyBackgroundTint(backgroundPixel, config, y, imageData.height, maskValue);
    const adjusted = applyVignetteChannels(
      blendSubjectAware(globalPixel, subjectPixel, backgroundPixel, maskValue, subjectAware),
      vignette,
      x,
      y,
      vignetteGeometry,
    );

    data[i] = clamp(adjusted.r);
    data[i + 1] = clamp(adjusted.g);
    data[i + 2] = clamp(adjusted.b);
  }

  applySharpness(imageData, config.sharpness || 0);
  applyGrain(imageData, config.grain || 0);

  return imageData;
}

export function scaleEffect(base, neutral, intensity) {
  return neutral + (base - neutral) * intensity;
}

export function scaledOptional(preset, key, intensity) {
  return (preset[key] ?? 0) * intensity;
}

export function mergeFilter(preset, adjustments, intensity) {
  return {
    exposure: scaledOptional(preset, "exposure", intensity) + adjustments.exposure,
    brightness: scaleEffect(preset.brightness, 1, intensity) * adjustments.brightness,
    contrast: scaleEffect(preset.contrast, 1, intensity) * adjustments.contrast,
    saturation: scaleEffect(preset.saturation, 1, intensity) * adjustments.saturation,
    warmth: preset.warmth * intensity + adjustments.warmth,
    fade: scaledOptional(preset, "fade", intensity) + adjustments.fade,
    vibrance: scaledOptional(preset, "vibrance", intensity),
    highlights: scaledOptional(preset, "highlights", intensity) + adjustments.highlights,
    shadows: scaledOptional(preset, "shadows", intensity) + adjustments.shadows,
    sharpness: scaledOptional(preset, "sharpness", intensity) + adjustments.sharpness,
    grain: scaledOptional(preset, "grain", intensity) + adjustments.grain,
    vignette: scaledOptional(preset, "vignette", intensity) + adjustments.vignette,
    subjectAware: scaledOptional(preset, "subjectAware", intensity),
    backgroundWarmth: scaledOptional(preset, "backgroundWarmth", intensity),
    backgroundSaturation: scaleEffect(preset.backgroundSaturation ?? 1, 1, intensity),
    backgroundDarken: scaleEffect(preset.backgroundDarken ?? 1, 1, intensity),
    flash: scaledOptional(preset, "flash", intensity),
    rimLight: scaledOptional(preset, "rimLight", intensity),
    skyTint: preset.skyTint ? { ...preset.skyTint, amount: preset.skyTint.amount * intensity } : undefined,
  };
}

export function getStageWidth(canvasSize, previewBox, zoom) {
  if (!canvasSize.width || !canvasSize.height) return 0;

  const aspect = canvasSize.width / canvasSize.height;
  const availableWidth = Math.max(240, previewBox.width);
  const availableHeight = Math.max(260, previewBox.height);
  const containedWidth = Math.min(availableWidth * 0.72, availableHeight * 0.72 * aspect);

  return Math.max(180, Math.floor(containedWidth * zoom));
}

export function getCanvasBoardStyle(previewBox, stageWidth, stageHeight) {
  if (!stageWidth || !stageHeight) return undefined;

  const availableWidth = Math.max(240, previewBox.width);
  const availableHeight = Math.max(260, previewBox.height);
  const sideRoom = availableWidth * 1.25;
  const verticalRoom = availableHeight * 1.25;

  return {
    width: `${Math.max(availableWidth * 2.25, stageWidth + sideRoom)}px`,
    height: `${Math.max(availableHeight * 2.25, stageHeight + verticalRoom)}px`,
  };
}

export function getWheelZoom(currentZoom, deltaY) {
  const direction = deltaY > 0 ? -1 : 1;
  const nextZoom = currentZoom + direction * 0.12;
  return Math.round(clamp(nextZoom, 1, 3) * 100) / 100;
}

