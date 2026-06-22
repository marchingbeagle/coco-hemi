import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { GoogleGenAI } from "@google/genai";
import { FilesetResolver, ImageSegmenter } from "@mediapipe/tasks-vision";
import {
  Brush,
  ChevronDown,
  Download,
  Eye,
  EyeOff,
  ImagePlus,
  Instagram,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
  Upload,
  Wand2,
  ZoomIn,
} from "lucide-react";
import { Button } from "./components/ui/button";
import { Card } from "./components/ui/card";
import { Input } from "./components/ui/input";
import { Textarea } from "./components/ui/textarea";
import "./styles.css";

const MEDIAPIPE_WASM_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm";
const SELFIE_SEGMENTER_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite";
const PREVIEW_MAX_WIDTH = 920;
const EXPORT_MAX_WIDTH = 1920;
const THUMB_WIDTH = 210;
const AI_HISTORY_DB = "coco-hemi-ai-results";
const AI_HISTORY_STORE = "images";
const AI_HISTORY_LIMIT = 12;
const SECTION_STORAGE_KEY = "coco-hemi-collapsed-sections";
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || "";
const GEMINI_IMAGE_MODEL = "gemini-2.5-flash-image";
const AI_PROMPT_GUARDRAILS = `Quality & Realism: Maintain realistic skin texture, facial details, and natural imperfections. No plastic skin or over-smoothing. Preserve sharpness and depth of field.

Do NOT change the subject's face, body, or expression.
Do NOT alter the pose, camera angle, framing, or crop.
Do NOT modify the outfit or accessories.
Do NOT change the background composition or content unless the selected filter explicitly requires cleanup, relighting, or a Polaroid frame treatment.
Do NOT change the aspect ratio.`;

const presets = [
  {
    id: "night-flash",
    name: "Night Flash",
    label: "Para noite, festas e flash editorial.",
    filter: {
      brightness: 1.08,
      contrast: 1.34,
      saturation: 0.92,
      warmth: -6,
      vibrance: 6,
      subjectAware: 0.84,
      backgroundDarken: 0.54,
      backgroundSaturation: 0.78,
      vignette: 28,
      flash: 34,
      sharpness: 10,
    },
  },
  {
    id: "golden-sunset",
    name: "Golden Sunset",
    label: "Para foto externa com clima de por do sol.",
    filter: {
      brightness: 1.04,
      contrast: 1.16,
      saturation: 1.2,
      warmth: 22,
      vibrance: 20,
      subjectAware: 0.78,
      backgroundWarmth: 42,
      backgroundSaturation: 1.28,
      backgroundDarken: 0.88,
      skyTint: { r: 255, g: 92, b: 44, amount: 0.24 },
      rimLight: 18,
      vignette: 14,
    },
  },
  {
    id: "clean-social",
    name: "Clean Social",
    label: "Para luz natural e acabamento limpo.",
    filter: {
      brightness: 1.06,
      contrast: 1.08,
      saturation: 1.04,
      warmth: 2,
      vibrance: 10,
      highlights: -4,
      shadows: 8,
      subjectAware: 0.34,
      sharpness: 8,
    },
  },
  {
    id: "editorial-flash",
    name: "Editorial Flash",
    label: "Para retrato com contraste de revista.",
    filter: {
      brightness: 1.1,
      contrast: 1.3,
      saturation: 0.98,
      warmth: -2,
      vibrance: 8,
      subjectAware: 0.82,
      backgroundDarken: 0.64,
      backgroundSaturation: 0.84,
      flash: 26,
      sharpness: 14,
      vignette: 20,
    },
  },
  {
    id: "backlight-glow",
    name: "Backlight Glow",
    label: "Para contraluz, cabelo e contorno.",
    filter: {
      brightness: 1.05,
      contrast: 1.18,
      saturation: 1.08,
      warmth: 8,
      vibrance: 14,
      subjectAware: 0.86,
      backgroundDarken: 0.74,
      backgroundSaturation: 0.94,
      rimLight: 38,
      shadows: 6,
      vignette: 12,
    },
  },
  {
    id: "red-drama",
    name: "Red Drama",
    label: "Para fundo quente e visual marcante.",
    filter: {
      brightness: 1,
      contrast: 1.28,
      saturation: 1.12,
      warmth: 14,
      vibrance: 12,
      subjectAware: 0.82,
      backgroundWarmth: 38,
      backgroundSaturation: 1.22,
      backgroundDarken: 0.78,
      skyTint: { r: 255, g: 42, b: 48, amount: 0.34 },
      vignette: 22,
    },
  },
  {
    id: "dazz-day",
    name: "Dazz Day",
    label: "Para foto diurna com vintage suave.",
    filter: {
      brightness: 1.05,
      contrast: 1.04,
      saturation: 0.9,
      warmth: 14,
      fade: 12,
      grain: 8,
      highlights: -5,
      shadows: 6,
      subjectAware: 0.26,
    },
  },
  {
    id: "retro-flash",
    name: "Retro Flash",
    label: "Para flash quente e analogico.",
    filter: {
      brightness: 1.12,
      contrast: 1.12,
      saturation: 0.88,
      warmth: 24,
      fade: 10,
      vibrance: 8,
      subjectAware: 0.72,
      backgroundWarmth: 10,
      backgroundDarken: 0.9,
      flash: 18,
      grain: 6,
      vignette: 16,
    },
  },
  {
    id: "mono-editorial",
    name: "Mono Editorial",
    label: "Para preto e branco premium.",
    filter: {
      brightness: 1.04,
      contrast: 1.3,
      saturation: 0,
      warmth: 0,
      highlights: -3,
      shadows: -10,
      sharpness: 12,
      vignette: 14,
    },
  },
  {
    id: "soft-film",
    name: "Soft Film",
    label: "Para feed suave e retratos delicados.",
    filter: {
      brightness: 1.04,
      contrast: 0.98,
      saturation: 0.9,
      warmth: 10,
      fade: 16,
      grain: 5,
      highlights: -6,
      shadows: 8,
      subjectAware: 0.22,
    },
  },
  {
    id: "crisp-detail",
    name: "Crisp Detail",
    label: "Para nitidez e contraste sem IA.",
    filter: {
      brightness: 1.03,
      contrast: 1.2,
      saturation: 1.06,
      warmth: 0,
      highlights: -8,
      shadows: 8,
      sharpness: 24,
      subjectAware: 0.2,
    },
  },
  {
    id: "warm-studio",
    name: "Warm Studio",
    label: "Para pele quente e clima de estudio.",
    filter: {
      brightness: 1.08,
      contrast: 1.12,
      saturation: 1.02,
      warmth: 16,
      vibrance: 6,
      highlights: -4,
      shadows: 6,
      flash: 10,
      subjectAware: 0.52,
      vignette: 10,
    },
  },
];

const aiPresets = [
  {
    id: "golden-sunset",
    name: "Golden Sunset",
    label: "por do sol cinematico",
    prompt:
      "Create an intense cinematic golden sunset transformation for a viral Instagram/TikTok photo. Preserve the same person, face identity, body, pose, clothes and composition exactly. Turn the scene into a dramatic late-sunset moment with deep orange sky glow, strong warm directional light, realistic golden reflections, visible rim light around hair and shoulders, richer shadows, glowing highlights, premium contrast and polished creator-style color grading. Make the effect clearly noticeable and emotional, while keeping skin natural and photorealistic. Do not distort anatomy or facial features.",
  },
  {
    id: "clean-photo",
    name: "Foto Limpa",
    label: "fundo sem distracoes",
    prompt:
      "Create a very clean social-media-ready photo focused only on the main person. Preserve the main person's face identity, body, clothes, pose and proportions exactly. Aggressively remove unwanted people, objects, clutter, signs, trash, distractions and background elements that compete with the subject. Reconstruct the background realistically with smooth natural lighting, clean depth separation, precise edges around hair and clothing, and no visible removal artifacts. Make the final image look intentionally composed, premium and distraction-free. Do not change the main person.",
  },
  {
    id: "editorial-flash",
    name: "Flash Editorial",
    label: "revista noturna",
    prompt:
      "Transform this image into a bold professional night editorial flash photo, like a fashion magazine cover shot. Preserve the same subject, face identity, body, outfit and framing exactly. Make the background much darker and moodier, add powerful direct flash on the subject, crisp glossy highlights, sharp shadows, dramatic magazine contrast, realistic skin texture, clean detail and a luxury paparazzi/editorial atmosphere. The flash effect should be obvious, stylish and premium, while remaining photorealistic.",
  },
  {
    id: "max-quality",
    name: "Qualidade Maxima",
    label: "nitidez e resolucao",
    prompt:
      "Enhance this photo to maximum professional posting quality. Strongly improve apparent resolution, micro-sharpness, clarity, fine hair/detail definition, clean noise reduction, texture recovery, edge crispness and dynamic range. Preserve the face, body, physical traits, identity, clothing, pose, background content and composition exactly. Do not beautify, reshape, alter facial features, change body proportions, add makeup, smooth skin unnaturally, or change the person's appearance. Make it look like a high-end original photo captured with a premium camera.",
  },
  {
    id: "night-photographer",
    name: "Night Photographer",
    label: "ensaio premium",
    prompt:
      "Simulate a high-end professional night photography session with a premium cinematic look. Preserve the subject identity, pose, body, outfit and composition exactly. Add elegant low-light ambience, stronger background blur, rich bokeh, luxury city-night mood, tasteful rim light, soft face illumination, deep cinematic shadows, subtle lens depth, refined contrast and expensive creator-photo styling. The final image should feel like a planned night photoshoot, not a simple filter. Keep skin natural and photorealistic.",
  },
  {
    id: "dazz-day",
    name: "Dazz Day",
    label: "vintage diurno",
    prompt:
      "Edit this daytime photo with a strong Dazz Cam inspired vintage aesthetic for Instagram. Preserve the person, face identity, body, clothing, pose and composition exactly. Add creamy daylight tones, visible but delicate film grain, stronger halation on highlights, nostalgic analog softness, warm faded highlights, muted shadows, gentle color shift, subtle lens imperfection and a clear retro camera mood. Make the vintage effect obvious and trendy while keeping the person realistic.",
  },
  {
    id: "polaroid-instant",
    name: "Polaroid Instant",
    label: "moldura branca",
    prompt:
      "Create a realistic Polaroid instant print from this photo. Preserve the original photo content, person, face identity, body, clothing, pose and colors inside the frame. Place the image inside a bold clean white Polaroid border with a clearly larger bottom margin, realistic paper texture, slight instant-camera softness, subtle film color shift, delicate grain, believable physical shadow and a premium scanned-instant-photo look. Do not crop out the subject.",
  },
];

const ratios = [
  { id: "original", name: "Auto", width: 0, height: 0 },
  { id: "wide-cinema", name: "21:9", width: 1920, height: 823 },
  { id: "wide", name: "16:9", width: 1920, height: 1080 },
  { id: "photo", name: "3:2", width: 1620, height: 1080 },
  { id: "classic", name: "4:3", width: 1440, height: 1080 },
  { id: "print", name: "5:4", width: 1350, height: 1080 },
  { id: "square", name: "1:1", width: 1080, height: 1080 },
  { id: "portrait", name: "4:5", width: 1080, height: 1350 },
  { id: "vertical", name: "3:4", width: 1080, height: 1440 },
  { id: "pin", name: "2:3", width: 1080, height: 1620 },
  { id: "story", name: "9:16", width: 1080, height: 1920 },
];

const defaultAdjustments = {
  exposure: 0,
  brightness: 1,
  contrast: 1,
  saturation: 1,
  warmth: 0,
  highlights: 0,
  shadows: 0,
  sharpness: 0,
  grain: 0,
  vignette: 0,
  fade: 0,
};

const neutralPreset = {
  brightness: 1,
  contrast: 1,
  saturation: 1,
  warmth: 0,
  fade: 0,
  vibrance: 0,
  vignette: 0,
  subjectAware: 0,
  backgroundSaturation: 1,
  backgroundDarken: 1,
};

function clamp(value, min = 0, max = 255) {
  return Math.min(max, Math.max(min, value));
}

function transformPixel(pixel, config) {
  const contrastOffset = 128 * (1 - config.contrast);
  const exposure = Math.pow(2, config.exposure || 0);
  let r = pixel.r * exposure * config.brightness + (config.warmth || 0);
  let g = pixel.g * exposure * config.brightness + (config.warmth || 0) * 0.35;
  let b = pixel.b * exposure * config.brightness - (config.warmth || 0) * 0.45;

  r = r * config.contrast + contrastOffset;
  g = g * config.contrast + contrastOffset;
  b = b * config.contrast + contrastOffset;

  const gray = r * 0.299 + g * 0.587 + b * 0.114;
  r = gray + (r - gray) * config.saturation;
  g = gray + (g - gray) * config.saturation;
  b = gray + (b - gray) * config.saturation;

  if (config.highlights || config.shadows) {
    const luminance = r * 0.299 + g * 0.587 + b * 0.114;
    const highlightMask = clamp((luminance - 128) / 127, 0, 1);
    const shadowMask = clamp((128 - luminance) / 128, 0, 1);
    const highlightDelta = (config.highlights || 0) * 1.65 * highlightMask;
    const shadowDelta = (config.shadows || 0) * 1.65 * shadowMask;
    r += highlightDelta + shadowDelta;
    g += highlightDelta + shadowDelta;
    b += highlightDelta + shadowDelta;
  }

  if (config.vibrance) {
    const maxChannel = Math.max(r, g, b);
    const boost = ((255 - maxChannel) / 255) * (config.vibrance / 100);
    r = gray + (r - gray) * (1 + boost);
    g = gray + (g - gray) * (1 + boost);
    b = gray + (b - gray) * (1 + boost);
  }

  if (config.fade) {
    r = r + (245 - r) * (config.fade / 100);
    g = g + (238 - g) * (config.fade / 100);
    b = b + (225 - b) * (config.fade / 100);
  }

  return { r: clamp(r), g: clamp(g), b: clamp(b) };
}

function applySharpness(imageData, amount) {
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

function applyGrain(imageData, amount) {
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

function getAutoSubjectValue(pixel, x, y, width, height) {
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

function mixPixels(base, overlay, amount) {
  return {
    r: base.r * (1 - amount) + overlay.r * amount,
    g: base.g * (1 - amount) + overlay.g * amount,
    b: base.b * (1 - amount) + overlay.b * amount,
  };
}

function getMaskValue(mask, index) {
  return mask?.data?.[index] || 0;
}

function applyImageFilter(imageData, config, subjectMask) {
  const data = imageData.data;
  const subjectAware = config.subjectAware || 0;
  const backgroundSaturation = config.backgroundSaturation || 1;
  const backgroundWarmth = config.backgroundWarmth || 0;
  const backgroundDarken = config.backgroundDarken || 1;
  const skyTint = config.skyTint;
  const vignette = config.vignette || 0;
  const centerX = imageData.width / 2;
  const centerY = imageData.height * 0.52;
  const maxDistance = Math.hypot(centerX, centerY);

  for (let i = 0; i < data.length; i += 4) {
    const pixelIndex = i / 4;
    const x = pixelIndex % imageData.width;
    const y = Math.floor(pixelIndex / imageData.width);
    const original = { r: data[i], g: data[i + 1], b: data[i + 2] };
    const maskValue = getMaskValue(subjectMask, pixelIndex) / 255;
    const backgroundConfig = {
      ...config,
      brightness: config.brightness * backgroundDarken,
      saturation: config.saturation * backgroundSaturation,
      warmth: (config.warmth || 0) + backgroundWarmth,
    };
    const globalPixel = transformPixel(original, config);
    let subjectPixel = transformPixel(original, config);
    let backgroundPixel = transformPixel(original, backgroundConfig);

    if (config.flash) {
      subjectPixel = mixPixels(subjectPixel, { r: 255, g: 238, b: 216 }, (config.flash / 100) * maskValue);
    }

    if (config.rimLight) {
      const edge = maskValue > 0.14 && maskValue < 0.76 ? config.rimLight / 100 : 0;
      subjectPixel = mixPixels(subjectPixel, { r: 255, g: 232, b: 190 }, edge);
    }

    if (skyTint && y < imageData.height * 0.72) {
      backgroundPixel = mixPixels(backgroundPixel, skyTint, skyTint.amount * (1 - maskValue));
    }

    let r = subjectPixel.r * maskValue + backgroundPixel.r * (1 - maskValue);
    let g = subjectPixel.g * maskValue + backgroundPixel.g * (1 - maskValue);
    let b = subjectPixel.b * maskValue + backgroundPixel.b * (1 - maskValue);

    r = globalPixel.r * (1 - subjectAware) + r * subjectAware;
    g = globalPixel.g * (1 - subjectAware) + g * subjectAware;
    b = globalPixel.b * (1 - subjectAware) + b * subjectAware;

    if (vignette) {
      const distance = Math.hypot(x - centerX, y - centerY) / maxDistance;
      const shadow = 1 - Math.max(0, distance - 0.34) * (vignette / 42);
      r *= shadow;
      g *= shadow;
      b *= shadow;
    }

    data[i] = clamp(r);
    data[i + 1] = clamp(g);
    data[i + 2] = clamp(b);
  }

  applySharpness(imageData, config.sharpness || 0);
  applyGrain(imageData, config.grain || 0);

  return imageData;
}

function scaleEffect(base, neutral, intensity) {
  return neutral + (base - neutral) * intensity;
}

function mergeFilter(preset, adjustments, intensity) {
  return {
    exposure: (preset.exposure || 0) * intensity + adjustments.exposure,
    brightness: scaleEffect(preset.brightness, 1, intensity) * adjustments.brightness,
    contrast: scaleEffect(preset.contrast, 1, intensity) * adjustments.contrast,
    saturation: scaleEffect(preset.saturation, 1, intensity) * adjustments.saturation,
    warmth: preset.warmth * intensity + adjustments.warmth,
    fade: (preset.fade || 0) * intensity + adjustments.fade,
    vibrance: (preset.vibrance || 0) * intensity,
    highlights: (preset.highlights || 0) * intensity + adjustments.highlights,
    shadows: (preset.shadows || 0) * intensity + adjustments.shadows,
    sharpness: (preset.sharpness || 0) * intensity + adjustments.sharpness,
    grain: (preset.grain || 0) * intensity + adjustments.grain,
    vignette: (preset.vignette || 0) * intensity + adjustments.vignette,
    subjectAware: (preset.subjectAware || 0) * intensity,
    backgroundWarmth: (preset.backgroundWarmth || 0) * intensity,
    backgroundSaturation: scaleEffect(preset.backgroundSaturation || 1, 1, intensity),
    backgroundDarken: scaleEffect(preset.backgroundDarken || 1, 1, intensity),
    flash: (preset.flash || 0) * intensity,
    rimLight: (preset.rimLight || 0) * intensity,
    skyTint: preset.skyTint ? { ...preset.skyTint, amount: preset.skyTint.amount * intensity } : undefined,
  };
}

function getStageWidth(canvasSize, previewBox, zoom) {
  if (!canvasSize.width || !canvasSize.height) return 0;

  const aspect = canvasSize.width / canvasSize.height;
  const availableWidth = Math.max(240, previewBox.width || 800);
  const availableHeight = Math.max(260, (previewBox.height || 600) - 12);
  const containedWidth = Math.min(availableWidth, availableHeight * aspect);

  return Math.max(180, Math.floor(containedWidth * zoom));
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Nao foi possivel ler a imagem."));
    reader.readAsDataURL(file);
  });
}

function safeFileName(name) {
  return String(name || "coco-hemi-photo")
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120);
}

function downloadBlob(blob, fileName) {
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

function downloadCanvas(canvas, fileName) {
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

async function downloadDataUrl(dataUrl, fileName) {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  downloadBlob(blob, fileName);
}

function createId() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function openAiHistoryDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(AI_HISTORY_DB, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(AI_HISTORY_STORE)) {
        db.createObjectStore(AI_HISTORY_STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getStoredAiImages() {
  const db = await openAiHistoryDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(AI_HISTORY_STORE, "readonly");
    const request = transaction.objectStore(AI_HISTORY_STORE).getAll();
    request.onsuccess = () => {
      resolve(
        request.result
          .sort((a, b) => b.createdAt - a.createdAt)
          .slice(0, AI_HISTORY_LIMIT),
      );
    };
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => db.close();
  });
}

async function saveStoredAiImage(entry) {
  const db = await openAiHistoryDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(AI_HISTORY_STORE, "readwrite");
    const store = transaction.objectStore(AI_HISTORY_STORE);
    store.put(entry);
    const request = store.getAll();
    request.onsuccess = () => {
      const overflow = request.result
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(AI_HISTORY_LIMIT);
      overflow.forEach((item) => store.delete(item.id));
    };
    transaction.oncomplete = () => {
      db.close();
      resolve();
    };
    transaction.onerror = () => {
      db.close();
      reject(transaction.error);
    };
  });
}

async function deleteStoredAiImage(id) {
  const db = await openAiHistoryDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(AI_HISTORY_STORE, "readwrite");
    transaction.objectStore(AI_HISTORY_STORE).delete(id);
    transaction.oncomplete = () => {
      db.close();
      resolve();
    };
    transaction.onerror = () => {
      db.close();
      reject(transaction.error);
    };
  });
}

function makeMask(width, height, fill = 0) {
  const data = new Uint8ClampedArray(width * height);
  if (fill) data.fill(fill);
  return { width, height, data };
}

function buildHeuristicMask(imageData) {
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

function resampleMask(source, targetWidth, targetHeight) {
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

function resampleMaskData(sourceData, sourceWidth, sourceHeight, targetWidth, targetHeight) {
  return resampleMask({ width: sourceWidth, height: sourceHeight, data: sourceData }, targetWidth, targetHeight);
}

function getMaskBounds(mask, threshold = 50) {
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

function hasNearbyMask(mask, x, y, radius, threshold) {
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

function getLocalContrast(pixels, width, height, x, y) {
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

function enhanceHairMask(mask, imageData) {
  const bounds = getMaskBounds(mask);
  if (!bounds) return mask;

  const enhanced = makeMask(mask.width, mask.height);
  enhanced.data.set(mask.data);
  const bodyHeight = Math.max(1, bounds.maxY - bounds.minY);
  const padX = Math.round(mask.width * 0.08);
  const top = Math.max(0, bounds.minY - Math.round(bodyHeight * 0.16));
  const bottom = Math.min(mask.height - 1, bounds.minY + Math.round(bodyHeight * 0.34));
  const left = Math.max(0, bounds.minX - padX);
  const right = Math.min(mask.width - 1, bounds.maxX + padX);
  const pixels = imageData.data;

  for (let y = top; y <= bottom; y += 1) {
    for (let x = left; x <= right; x += 1) {
      const index = y * mask.width + x;
      if (enhanced.data[index] > 170) continue;
      if (!hasNearbyMask(mask, x, y, 5, 60)) continue;

      const offset = index * 4;
      const r = pixels[offset];
      const g = pixels[offset + 1];
      const b = pixels[offset + 2];
      const brightness = (r + g + b) / 3;
      const contrast = getLocalContrast(pixels, mask.width, mask.height, x, y);
      const isDarkHair = brightness < 118 && contrast > 7;
      const isBrownHair = r > g * 0.9 && r > b * 1.05 && brightness < 150 && contrast > 5;

      if (isDarkHair || isBrownHair) {
        enhanced.data[index] = Math.max(enhanced.data[index], isDarkHair ? 190 : 145);
      }
    }
  }

  const dilated = makeMask(mask.width, mask.height);
  dilated.data.set(enhanced.data);
  for (let y = top; y <= bottom; y += 1) {
    for (let x = left; x <= right; x += 1) {
      const value = enhanced.data[y * mask.width + x];
      if (value < 80) continue;
      for (let yy = Math.max(0, y - 2); yy <= Math.min(mask.height - 1, y + 2); yy += 1) {
        for (let xx = Math.max(0, x - 2); xx <= Math.min(mask.width - 1, x + 2); xx += 1) {
          const distance = Math.hypot(xx - x, yy - y);
          if (distance > 2.2) continue;
          const target = yy * mask.width + xx;
          dilated.data[target] = Math.max(dilated.data[target], value - distance * 32);
        }
      }
    }
  }

  return dilated;
}

function combineMasks(autoMask, manualMask) {
  const source = manualMask || autoMask;
  if (!source) return null;

  const combined = makeMask(source.width, source.height);
  for (let i = 0; i < combined.data.length; i += 1) {
    combined.data[i] = Math.max(getMaskValue(autoMask, i), getMaskValue(manualMask, i));
  }
  return combined;
}

function copyImageData(imageData) {
  return new ImageData(new Uint8ClampedArray(imageData.data), imageData.width, imageData.height);
}

function extractMediaPipeMask(result, targetWidth, targetHeight) {
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

function getAutoMaskLabel(status) {
  if (status === "loading") return "IA reconhecendo";
  if (status === "ready") return "IA ativa";
  if (status === "fallback") return "Fallback local";
  if (status === "error") return "IA indisponivel";
  return "Aguardando foto";
}

function dataUrlToInlineData(dataUrl) {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    throw new Error("Nao foi possivel preparar a imagem para a IA.");
  }
  return { mimeType: match[1], data: match[2] };
}

function findGeminiGeneratedImage(response) {
  const parts = response?.candidates?.flatMap((candidate) => candidate?.content?.parts || []) || [];
  return parts.find((part) => part?.inlineData?.data || part?.inline_data?.data);
}

function getGeminiErrorMessage(error) {
  const message = String(error?.message || "");
  const retryMatch = message.match(/Please retry in\s+([\d.]+)s/i);
  const retrySeconds = retryMatch ? Math.max(1, Math.ceil(Number(retryMatch[1]))) : null;

  if (
    message.includes("INVALID_ARGUMENT") ||
    message.includes("invalid authentication credentials") ||
    message.includes("Expected OAuth 2 access token")
  ) {
    return "A chave Gemini foi rejeitada. Gere uma API key no Google AI Studio, confirme que ela pertence ao projeto certo e use essa chave em VITE_GEMINI_API_KEY.";
  }

  if (message.includes("PERMISSION_DENIED")) {
    return "A chave Gemini nao tem permissao para esta chamada. Verifique se a key foi criada no AI Studio e se o projeto tem billing/acesso ao Gemini API.";
  }

  if (message.includes("API key not valid") || message.includes("API_KEY_INVALID")) {
    return "A chave Gemini informada esta invalida.";
  }

  if (message.includes("RESOURCE_EXHAUSTED") || message.toLowerCase().includes("quota")) {
    if (message.includes("limit: 0")) {
      return "A cota deste modelo de imagem esta indisponivel para esta chave/projeto. Confirme billing ativo e acesso ao modelo no Google AI Studio.";
    }
    if (retrySeconds) {
      return `A cota do Gemini foi temporariamente excedida. Tente novamente em cerca de ${retrySeconds}s.`;
    }
    return "A cota do Gemini foi excedida para este projeto. Aguarde ou revise limites e billing da chave.";
  }

  return message || "Falha ao aplicar o filtro IA.";
}

function appendPromptGuardrails(prompt) {
  const cleanPrompt = prompt.trim();
  if (cleanPrompt.includes("Quality & Realism:")) return cleanPrompt;
  return `${cleanPrompt}\n\n${AI_PROMPT_GUARDRAILS}`;
}

function buildAiPrompt(preset, options) {
  const basePrompt = options.prompt.trim() || preset.prompt;
  if (preset.id !== "polaroid-instant") return appendPromptGuardrails(basePrompt);

  const caption = options.caption.trim();
  const date = options.date.trim();
  const details = [];

  if (caption) {
    details.push(`Add this handwritten-style caption on the bottom white margin: "${caption}".`);
  }
  if (date) {
    details.push(`Add this small date on the Polaroid border: "${date}".`);
  }
  if (!details.length) {
    details.push("Leave the Polaroid border clean without added caption or date text.");
  }

  return appendPromptGuardrails(
    `${basePrompt} ${details.join(" ")} Keep any added text legible, minimal and only on the white border.`,
  );
}

function readCollapsedSections() {
  if (typeof window === "undefined") return {};
  try {
    const saved = window.localStorage.getItem(SECTION_STORAGE_KEY);
    return saved ? JSON.parse(saved) : {};
  } catch {
    return {};
  }
}

function App() {
  const [imageUrl, setImageUrl] = useState("");
  const [originalImageUrl, setOriginalImageUrl] = useState("");
  const [imageName, setImageName] = useState("coco-hemi-photo");
  const [filterMode, setFilterMode] = useState("normal");
  const [selectedPreset, setSelectedPreset] = useState(presets[0]);
  const [selectedAiPreset, setSelectedAiPreset] = useState(aiPresets[0]);
  const [intensity, setIntensity] = useState(1);
  const [selectedRatio, setSelectedRatio] = useState(ratios[0]);
  const [adjustments, setAdjustments] = useState(defaultAdjustments);
  const [aiAdjustments, setAiAdjustments] = useState(defaultAdjustments);
  const [zoom, setZoom] = useState(1);
  const [brushSize, setBrushSize] = useState(52);
  const [showMaskOverlay, setShowMaskOverlay] = useState(true);
  const [isShowingOriginal, setIsShowingOriginal] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isPainting, setIsPainting] = useState(false);
  const [loadState, setLoadState] = useState("idle");
  const [autoMaskStatus, setAutoMaskStatus] = useState("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [previewBox, setPreviewBox] = useState({ width: 0, height: 0 });
  const [filterThumbs, setFilterThumbs] = useState({});
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState("");
  const [aiResultUrl, setAiResultUrl] = useState("");
  const [aiHistory, setAiHistory] = useState([]);
  const [customAiPrompt, setCustomAiPrompt] = useState(aiPresets[0].prompt);
  const [polaroidCaption, setPolaroidCaption] = useState("");
  const [polaroidDate, setPolaroidDate] = useState("");
  const [collapsedSections, setCollapsedSections] = useState(readCollapsedSections);
  const [maskVersion, setMaskVersion] = useState(0);
  const imageRef = useRef(null);
  const originalImageRef = useRef(null);
  const photoCanvasRef = useRef(null);
  const maskCanvasRef = useRef(null);
  const scrollRef = useRef(null);
  const fileInputRef = useRef(null);
  const autoMaskRef = useRef(null);
  const manualMaskRef = useRef(null);
  const combinedMaskRef = useRef(null);
  const lastPaintRef = useRef(null);
  const renderFrameRef = useRef(null);
  const thumbnailFrameRef = useRef(null);
  const thumbnailTimerRef = useRef(null);
  const segmenterPromiseRef = useRef(null);
  const segmentationRunRef = useRef(0);
  const previewSourceRef = useRef(null);

  const currentFilter = useMemo(
    () => mergeFilter(selectedPreset.filter, adjustments, intensity),
    [selectedPreset, intensity, adjustments],
  );
  const isAiMode = filterMode === "ai";
  const aiFilter = useMemo(() => mergeFilter(neutralPreset, aiAdjustments, 1), [aiAdjustments]);
  const activeFilter = isAiMode ? aiFilter : currentFilter;
  const shouldUseLocalFilter = isAiMode ? Boolean(aiResultUrl) : true;

  useEffect(() => {
    try {
      window.localStorage.setItem(SECTION_STORAGE_KEY, JSON.stringify(collapsedSections));
    } catch {
      // Ignore unavailable storage; collapsible sections still work for the current render.
    }
  }, [collapsedSections]);

  function toggleSection(sectionId) {
    setCollapsedSections((current) => ({ ...current, [sectionId]: !current[sectionId] }));
  }

  useEffect(() => {
    let cancelled = false;
    getStoredAiImages()
      .then((items) => {
        if (!cancelled) setAiHistory(items);
      })
      .catch(() => {
        if (!cancelled) setAiHistory([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!originalImageUrl) {
      originalImageRef.current = null;
      return;
    }

    let cancelled = false;
    const image = new Image();
    image.onload = () => {
      if (!cancelled) originalImageRef.current = image;
    };
    image.onerror = () => {
      if (!cancelled) originalImageRef.current = null;
    };
    image.src = originalImageUrl;

    return () => {
      cancelled = true;
    };
  }, [originalImageUrl]);

  useEffect(() => {
    if (!imageUrl) return;

    let cancelled = false;
    const image = new Image();
    image.onload = () => {
      if (cancelled) return;
      imageRef.current = image;
      autoMaskRef.current = null;
      manualMaskRef.current = null;
      combinedMaskRef.current = null;
      previewSourceRef.current = null;
      setFilterThumbs({});
      setLoadState("ready");
      setErrorMessage("");
      renderPreview(image, activeFilter, selectedRatio, {
        useFilter: shouldUseLocalFilter,
        showOverlay: filterMode === "normal" && showMaskOverlay,
      });
      if (filterMode === "normal") {
        setAutoMaskStatus("loading");
        buildAutomaticMask(image, selectedRatio);
      } else {
        setAutoMaskStatus("idle");
      }
    };
    image.onerror = () => {
      if (cancelled) return;
      imageRef.current = null;
      setLoadState("error");
      setAutoMaskStatus("error");
      setErrorMessage("Nao foi possivel carregar esta imagem. Tente JPG, PNG, WebP ou AVIF.");
    };
    image.src = imageUrl;

    return () => {
      cancelled = true;
    };
  }, [imageUrl]);

  useEffect(() => {
    if (imageRef.current && loadState === "ready") {
      schedulePreviewRender({
        useFilter: shouldUseLocalFilter && !isShowingOriginal,
        showOverlay: filterMode === "normal" && showMaskOverlay && !isShowingOriginal,
      });
    }
  }, [activeFilter, loadState, isShowingOriginal, showMaskOverlay, filterMode, shouldUseLocalFilter]);

  useEffect(() => {
    if (!imageRef.current || loadState !== "ready") return;

    if (filterMode === "ai") {
      setIsPainting(false);
      renderPreview(imageRef.current, activeFilter, selectedRatio, {
        useFilter: shouldUseLocalFilter,
        showOverlay: false,
      });
      return;
    }

    if (!autoMaskRef.current) {
      setAutoMaskStatus("loading");
      buildAutomaticMask(imageRef.current, selectedRatio);
    }
    renderPreview(imageRef.current, activeFilter, selectedRatio, {
      useFilter: shouldUseLocalFilter && !isShowingOriginal,
    });
  }, [filterMode]);

  useEffect(() => {
    if (imageRef.current && loadState === "ready") {
      autoMaskRef.current = null;
      manualMaskRef.current = null;
      combinedMaskRef.current = null;
      previewSourceRef.current = null;
      setFilterThumbs({});
      renderPreview(imageRef.current, activeFilter, selectedRatio, {
        useFilter: shouldUseLocalFilter && !isShowingOriginal,
        showOverlay: filterMode === "normal" && showMaskOverlay && !isShowingOriginal,
      });
      if (filterMode === "normal") {
        setAutoMaskStatus("loading");
        buildAutomaticMask(imageRef.current, selectedRatio);
      } else {
        setAutoMaskStatus("idle");
      }
    }
  }, [selectedRatio]);

  useEffect(() => {
    if (imageRef.current && loadState === "ready") {
      scheduleThumbnailBuild();
    }
  }, [intensity, adjustments, selectedRatio, loadState, maskVersion]);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return undefined;

    const updatePreviewBox = () => {
      setPreviewBox({
        width: element.clientWidth,
        height: element.clientHeight,
      });
    };
    updatePreviewBox();

    const observer = new ResizeObserver(updatePreviewBox);
    observer.observe(element);
    window.addEventListener("resize", updatePreviewBox);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updatePreviewBox);
    };
  }, [loadState]);

  function getRenderGeometry(image, ratio, maxWidth = PREVIEW_MAX_WIDTH) {
    const targetWidth = ratio.width || image.width;
    const targetHeight = ratio.height || image.height;
    const scale = Math.min(1, maxWidth / targetWidth);
    const width = Math.max(1, Math.round(targetWidth * scale));
    const height = Math.max(1, Math.round(targetHeight * scale));
    const targetRatio = targetWidth / targetHeight;
    const imageRatio = image.width / image.height;
    let sx = 0;
    let sy = 0;
    let sw = image.width;
    let sh = image.height;

    if (ratio.id !== "original") {
      if (imageRatio > targetRatio) {
        sw = image.height * targetRatio;
        sx = (image.width - sw) / 2;
      } else {
        sh = image.width / targetRatio;
        sy = (image.height - sh) / 2;
      }
    }

    return { width, height, sx, sy, sw, sh };
  }

  function drawBaseImage(ctx, image, geometry) {
    ctx.clearRect(0, 0, geometry.width, geometry.height);
    ctx.drawImage(
      image,
      geometry.sx,
      geometry.sy,
      geometry.sw,
      geometry.sh,
      0,
      0,
      geometry.width,
      geometry.height,
    );
  }

  function makeSourceImageData(image, ratio, maxWidth = PREVIEW_MAX_WIDTH) {
    const geometry = getRenderGeometry(image, ratio, maxWidth);
    const canvas = document.createElement("canvas");
    canvas.width = geometry.width;
    canvas.height = geometry.height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    drawBaseImage(ctx, image, geometry);
    return { canvas, imageData: ctx.getImageData(0, 0, geometry.width, geometry.height), geometry };
  }

  function getPreviewSource(image, ratio, sourceKey = imageUrl) {
    const key = `${sourceKey}|${ratio.id}|${PREVIEW_MAX_WIDTH}`;
    if (previewSourceRef.current?.key === key) return previewSourceRef.current;

    const source = makeSourceImageData(image, ratio, PREVIEW_MAX_WIDTH);
    previewSourceRef.current = { key, ...source };
    return previewSourceRef.current;
  }

  function ensureManualMask(width, height) {
    const current = manualMaskRef.current;
    if (!current || current.width !== width || current.height !== height) {
      manualMaskRef.current = makeMask(width, height);
      updateCombinedMask();
    }
    return manualMaskRef.current;
  }

  function updateCombinedMask() {
    combinedMaskRef.current = combineMasks(autoMaskRef.current, manualMaskRef.current);
    setMaskVersion((value) => value + 1);
    return combinedMaskRef.current;
  }

  function prepareCanvases(width, height) {
    const photoCanvas = photoCanvasRef.current;
    const maskCanvas = maskCanvasRef.current;
    if (!photoCanvas || !maskCanvas) return null;

    if (photoCanvas.width !== width || photoCanvas.height !== height) {
      photoCanvas.width = width;
      photoCanvas.height = height;
    }
    if (maskCanvas.width !== width || maskCanvas.height !== height) {
      maskCanvas.width = width;
      maskCanvas.height = height;
    }
    setCanvasSize((current) =>
      current.width === width && current.height === height ? current : { width, height },
    );
    ensureManualMask(width, height);
    return photoCanvas.getContext("2d", { willReadFrequently: true });
  }

  function renderPreview(image, filter, ratio, options = {}) {
    const useFilter = options.useFilter !== false;
    const showOverlay = options.showOverlay ?? (useFilter && showMaskOverlay && !isShowingOriginal);
    const source = getPreviewSource(image, ratio, options.sourceKey);
    const ctx = prepareCanvases(source.imageData.width, source.imageData.height);
    if (!ctx) return;

    if (useFilter) {
      const pixels = copyImageData(source.imageData);
      ctx.putImageData(applyImageFilter(pixels, filter, combinedMaskRef.current), 0, 0);
    } else {
      ctx.putImageData(source.imageData, 0, 0);
    }

    drawMaskOverlay(showOverlay);
  }

  function renderOutputCanvas(image, filter, ratio, options = {}) {
    const source = makeSourceImageData(image, ratio, EXPORT_MAX_WIDTH);
    const outputMask = options.useMask !== false && combinedMaskRef.current
      ? resampleMask(combinedMaskRef.current, source.imageData.width, source.imageData.height)
      : null;
    const pixels = copyImageData(source.imageData);
    const outputCanvas = document.createElement("canvas");
    outputCanvas.width = source.imageData.width;
    outputCanvas.height = source.imageData.height;
    const ctx = outputCanvas.getContext("2d");
    ctx.putImageData(applyImageFilter(pixels, filter, outputMask), 0, 0);
    return outputCanvas;
  }

  function renderBaseOutputCanvas(image, ratio) {
    const source = makeSourceImageData(image, ratio, EXPORT_MAX_WIDTH);
    const outputCanvas = document.createElement("canvas");
    outputCanvas.width = source.imageData.width;
    outputCanvas.height = source.imageData.height;
    outputCanvas.getContext("2d").putImageData(source.imageData, 0, 0);
    return outputCanvas;
  }

  function schedulePreviewRender(options = {}) {
    if (renderFrameRef.current) {
      cancelAnimationFrame(renderFrameRef.current);
    }
    renderFrameRef.current = requestAnimationFrame(() => {
      renderFrameRef.current = null;
      if (imageRef.current) {
        renderPreview(imageRef.current, activeFilter, selectedRatio, options);
      }
    });
  }

  async function getSegmenter() {
    if (!segmenterPromiseRef.current) {
      segmenterPromiseRef.current = (async () => {
        const vision = await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_URL);
        return ImageSegmenter.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: SELFIE_SEGMENTER_MODEL_URL,
            delegate: "CPU",
          },
          runningMode: "IMAGE",
          outputConfidenceMasks: true,
          outputCategoryMask: false,
        });
      })();
    }
    return segmenterPromiseRef.current;
  }

  async function buildAutomaticMask(image, ratio) {
    const runId = segmentationRunRef.current + 1;
    segmentationRunRef.current = runId;
    const source = getPreviewSource(image, ratio);
    const fallbackMask = enhanceHairMask(buildHeuristicMask(source.imageData), source.imageData);
    autoMaskRef.current = fallbackMask;
    updateCombinedMask();
    schedulePreviewRender({ useFilter: shouldUseLocalFilter && !isShowingOriginal });

    try {
      setAutoMaskStatus("loading");
      const segmenter = await getSegmenter();
      if (segmentationRunRef.current !== runId) return;
      const result = segmenter.segment(source.canvas);
      const mediaPipeMask = extractMediaPipeMask(result, source.imageData.width, source.imageData.height);
      autoMaskRef.current = enhanceHairMask(mediaPipeMask || fallbackMask, source.imageData);
      updateCombinedMask();
      setAutoMaskStatus(mediaPipeMask ? "ready" : "fallback");
      result.close?.();
    } catch {
      if (segmentationRunRef.current !== runId) return;
      autoMaskRef.current = fallbackMask;
      updateCombinedMask();
      setAutoMaskStatus("fallback");
    }

    if (imageRef.current && segmentationRunRef.current === runId) {
      schedulePreviewRender({ useFilter: shouldUseLocalFilter && !isShowingOriginal });
    }
  }

  function drawMaskOverlay(isVisible = showMaskOverlay && !isShowingOriginal) {
    const maskCanvas = maskCanvasRef.current;
    if (!maskCanvas) return;

    const ctx = maskCanvas.getContext("2d");
    ctx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
    if (!isVisible) return;

    const width = maskCanvas.width;
    const height = maskCanvas.height;
    const overlay = ctx.createImageData(width, height);
    const autoMask = autoMaskRef.current;
    const manualMask = manualMaskRef.current;

    for (let i = 0; i < width * height; i += 1) {
      const manual = getMaskValue(manualMask, i);
      const auto = getMaskValue(autoMask, i);
      const alpha = Math.max(manual, auto * 0.45);
      if (!alpha) continue;
      const offset = i * 4;
      overlay.data[offset] = manual ? 255 : 96;
      overlay.data[offset + 1] = manual ? 98 : 190;
      overlay.data[offset + 2] = manual ? 64 : 255;
      overlay.data[offset + 3] = Math.min(manual ? 125 : 82, alpha * 0.5);
    }
    ctx.putImageData(overlay, 0, 0);
  }

  function scheduleThumbnailBuild() {
    if (thumbnailTimerRef.current) {
      clearTimeout(thumbnailTimerRef.current);
    }
    if (thumbnailFrameRef.current) {
      cancelAnimationFrame(thumbnailFrameRef.current);
    }
    thumbnailTimerRef.current = setTimeout(() => {
      thumbnailFrameRef.current = requestAnimationFrame(() => {
        thumbnailFrameRef.current = null;
        thumbnailTimerRef.current = null;
        buildFilterThumbnails();
      });
    }, 180);
  }

  function buildFilterThumbnails() {
    if (!imageRef.current || loadState !== "ready") return;

    const source = makeSourceImageData(imageRef.current, selectedRatio, THUMB_WIDTH);
    const thumbMask = combinedMaskRef.current
      ? resampleMask(combinedMaskRef.current, source.imageData.width, source.imageData.height)
      : null;
    const canvas = source.canvas;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const urls = {};

    for (const preset of presets) {
      const pixels = copyImageData(source.imageData);
      ctx.putImageData(applyImageFilter(pixels, mergeFilter(preset.filter, adjustments, intensity), thumbMask), 0, 0);
      urls[preset.id] = canvas.toDataURL("image/jpeg", 0.72);
    }

    setFilterThumbs(urls);
  }

  function getCanvasPoint(event) {
    const canvas = maskCanvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    const clientX = event.clientX ?? event.touches?.[0]?.clientX;
    const clientY = event.clientY ?? event.touches?.[0]?.clientY;
    if (clientX == null || clientY == null) return null;

    return {
      x: clamp(((clientX - rect.left) / rect.width) * canvas.width, 0, canvas.width - 1),
      y: clamp(((clientY - rect.top) / rect.height) * canvas.height, 0, canvas.height - 1),
    };
  }

  function paintAt(point) {
    const maskCanvas = maskCanvasRef.current;
    if (!maskCanvas || !point) return;

    const mask = ensureManualMask(maskCanvas.width, maskCanvas.height);
    const overlayCtx = maskCanvas.getContext("2d");
    const radius = brushSize / 2;
    const from = lastPaintRef.current || point;
    const distance = Math.hypot(point.x - from.x, point.y - from.y);
    const steps = Math.max(1, Math.ceil(distance / Math.max(4, radius * 0.35)));

    for (let step = 0; step <= steps; step += 1) {
      const t = step / steps;
      const x = from.x + (point.x - from.x) * t;
      const y = from.y + (point.y - from.y) * t;
      paintCircle(mask, x, y, radius);
      if (showMaskOverlay && !isShowingOriginal) {
        drawOverlayCircle(overlayCtx, x, y, radius);
      }
    }

    lastPaintRef.current = point;
  }

  function paintCircle(mask, centerX, centerY, radius) {
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

  function drawOverlayCircle(ctx, centerX, centerY, radius) {
    const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
    gradient.addColorStop(0, "rgb(255 98 64 / 48%)");
    gradient.addColorStop(0.72, "rgb(255 98 64 / 28%)");
    gradient.addColorStop(1, "rgb(255 98 64 / 0%)");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  function handlePointerDown(event) {
    if (loadState !== "ready" || isShowingOriginal) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setIsPainting(true);
    lastPaintRef.current = null;
    paintAt(getCanvasPoint(event));
  }

  function handlePointerMove(event) {
    if (!isPainting) return;
    event.preventDefault();
    paintAt(getCanvasPoint(event));
  }

  function stopPainting(event) {
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    setIsPainting(false);
    lastPaintRef.current = null;
    updateCombinedMask();
    schedulePreviewRender({ useFilter: shouldUseLocalFilter && !isShowingOriginal });
  }

  function clearMask() {
    if (!manualMaskRef.current) return;
    manualMaskRef.current.data.fill(0);
    updateCombinedMask();
    schedulePreviewRender({ useFilter: shouldUseLocalFilter && !isShowingOriginal });
  }

  async function handleFiles(files) {
    const file = files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setLoadState("error");
      setErrorMessage("Escolha um arquivo de imagem.");
      return;
    }

    setLoadState("loading");
    setAutoMaskStatus("idle");
    setErrorMessage("");
    autoMaskRef.current = null;
    manualMaskRef.current = null;
    combinedMaskRef.current = null;
    previewSourceRef.current = null;
    setFilterThumbs({});
    setAiError("");
    setAiResultUrl("");
    setAiAdjustments(defaultAdjustments);
    setZoom(1);
    setCanvasSize({ width: 0, height: 0 });
    setImageName(file.name.replace(/\.[^/.]+$/, "") || "coco-hemi-photo");

    try {
      const dataUrl = await readFileAsDataUrl(file);
      setOriginalImageUrl(dataUrl);
      setImageUrl(dataUrl);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (error) {
      setLoadState("error");
      setAutoMaskStatus("error");
      setErrorMessage(error.message);
    }
  }

  function downloadPhoto() {
    if (!imageRef.current) return;

    const canvas = isAiMode
      ? aiResultUrl
        ? renderOutputCanvas(imageRef.current, aiFilter, selectedRatio, { useMask: false })
        : renderBaseOutputCanvas(imageRef.current, selectedRatio)
      : renderOutputCanvas(imageRef.current, currentFilter, selectedRatio, { useMask: true });
    const suffix = isAiMode
      ? `${selectedAiPreset.id}-${selectedRatio.id}`
      : `${Math.round(intensity * 100)}-${selectedPreset.id}-${selectedRatio.id}`;
    downloadCanvas(canvas, `${imageName}-${suffix}.png`);
  }

  async function runAiFilter() {
    if (!imageRef.current || loadState !== "ready" || aiBusy) return;

    const apiKey = GEMINI_API_KEY.trim();
    if (!apiKey) {
      setAiError("Configure VITE_GEMINI_API_KEY no arquivo .env do projeto para usar os filtros IA.");
      return;
    }

    setAiBusy(true);
    setAiError("");
    setAiResultUrl("");

    try {
      const ai = new GoogleGenAI({ apiKey });
      const inputCanvas = renderBaseOutputCanvas(imageRef.current, selectedRatio);
      const inlineData = dataUrlToInlineData(inputCanvas.toDataURL("image/png"));
      const prompt = buildAiPrompt(selectedAiPreset, {
        prompt: customAiPrompt,
        caption: polaroidCaption,
        date: polaroidDate,
      });
      const response = await ai.models.generateContent({
        model: GEMINI_IMAGE_MODEL,
        contents: [
          { text: prompt },
          {
            inlineData: {
              mimeType: inlineData.mimeType,
              data: inlineData.data,
            },
          },
        ],
      });

      const generatedPart = findGeminiGeneratedImage(response);
      const generatedData = generatedPart?.inlineData?.data || generatedPart?.inline_data?.data;
      const mimeType =
        generatedPart?.inlineData?.mimeType || generatedPart?.inline_data?.mime_type || "image/png";

      if (!generatedData) {
        throw new Error("A resposta do Gemini nao trouxe uma imagem. Tente outro filtro ou prompt.");
      }

      const resultUrl = `data:${mimeType};base64,${generatedData}`;
      const generatedName = `${imageName}-${selectedAiPreset.id}`;
      const historyEntry = {
        id: createId(),
        dataUrl: resultUrl,
        imageName: generatedName,
        presetId: selectedAiPreset.id,
        presetName: selectedAiPreset.name,
        prompt,
        createdAt: Date.now(),
      };

      setAiResultUrl(resultUrl);
      setAiAdjustments(defaultAdjustments);
      setImageName(generatedName);
      setImageUrl(resultUrl);
      setAiHistory((current) => [historyEntry, ...current].slice(0, AI_HISTORY_LIMIT));
      saveStoredAiImage(historyEntry).catch(() => {
        setAiError("Imagem gerada, mas nao foi possivel salvar no historico local do navegador.");
      });
    } catch (error) {
      setAiError(getGeminiErrorMessage(error));
    } finally {
      setAiBusy(false);
    }
  }

  function downloadAiResult() {
    if (!aiResultUrl || !imageRef.current) return;
    const canvas = renderOutputCanvas(imageRef.current, aiFilter, selectedRatio, { useMask: false });
    downloadCanvas(canvas, `${imageName}-${selectedAiPreset.id}-gemini.png`);
  }

  function loadStoredAiImage(item) {
    setFilterMode("ai");
    setSelectedAiPreset(aiPresets.find((preset) => preset.id === item.presetId) || aiPresets[0]);
    setImageName(item.imageName || `${imageName}-${item.presetId}`);
    setImageUrl(item.dataUrl);
    setAiResultUrl(item.dataUrl);
    setAiAdjustments(defaultAdjustments);
    setAiError("");
    setZoom(1);
  }

  function downloadStoredAiImage(item) {
    downloadDataUrl(item.dataUrl, `${item.imageName || item.presetName || "coco-hemi-ai"}.png`).catch(() => {
      setAiError("Nao foi possivel baixar a imagem salva.");
    });
  }

  function removeStoredAiImage(item) {
    setAiHistory((current) => current.filter((entry) => entry.id !== item.id));
    deleteStoredAiImage(item.id).catch(() => {
      setAiError("Nao foi possivel remover a imagem do historico local.");
    });
  }

  function reset() {
    setFilterMode("normal");
    setSelectedPreset(presets[0]);
    setSelectedAiPreset(aiPresets[0]);
    setIntensity(1);
    setSelectedRatio(ratios[0]);
    setAdjustments(defaultAdjustments);
    setAiAdjustments(defaultAdjustments);
    setZoom(1);
    setBrushSize(52);
    setShowMaskOverlay(true);
    setIsShowingOriginal(false);
    setAiError("");
    setAiResultUrl("");
    setCustomAiPrompt(aiPresets[0].prompt);
    setPolaroidCaption("");
    setPolaroidDate("");
    clearMask();
  }

  function showOriginal() {
    if (!imageRef.current || loadState !== "ready") return;
    const compareImage = originalImageRef.current || imageRef.current;
    setIsShowingOriginal(true);
    renderPreview(compareImage, activeFilter, selectedRatio, {
      useFilter: false,
      showOverlay: false,
      sourceKey: originalImageUrl || imageUrl,
    });
  }

  function hideOriginal() {
    if (!imageRef.current || loadState !== "ready") return;
    setIsShowingOriginal(false);
    renderPreview(imageRef.current, activeFilter, selectedRatio, {
      useFilter: shouldUseLocalFilter,
      showOverlay: filterMode === "normal" && showMaskOverlay,
    });
  }

  function handleStageCompareDown(event) {
    if (loadState !== "ready" || isPainting) return;
    if (!isAiMode && event.target !== photoCanvasRef.current) return;
    showOriginal();
  }

  const stageStyle =
    canvasSize.width && canvasSize.height
      ? {
          aspectRatio: `${canvasSize.width} / ${canvasSize.height}`,
          width: `${getStageWidth(canvasSize, previewBox, zoom)}px`,
        }
      : undefined;

  return (
    <main className="app">
      <section className="editor">
        <aside className="sidebar">
          <div className="brand">
            <div className="brand-mark">
              <Sparkles size={22} />
            </div>
            <div>
              <h1>Coco Hemi</h1>
              <p>Editor social com IA local, luz de fundo e preview comparativo.</p>
            </div>
          </div>

          <Button className="upload-button" onClick={() => fileInputRef.current?.click()}>
            <Upload size={20} />
            Enviar foto
          </Button>
          <input
            ref={fileInputRef}
            className="hidden-input"
            type="file"
            accept="image/*"
            onChange={(event) => handleFiles(event.target.files)}
          />

          <CollapsiblePanel
            id="filter-type"
            title="Tipo de filtro"
            icon={<SlidersHorizontal size={18} />}
            collapsedSections={collapsedSections}
            onToggle={toggleSection}
          >
            <div className="mode-switch" aria-label="Selecionar tipo de filtro">
              <button
                className={filterMode === "normal" ? "mode-button active" : "mode-button"}
                onClick={() => setFilterMode("normal")}
              >
                Normais
              </button>
              <button
                className={filterMode === "ai" ? "mode-button active" : "mode-button"}
                onClick={() => setFilterMode("ai")}
              >
                IA
              </button>
            </div>
          </CollapsiblePanel>

          <CollapsiblePanel
            id="format"
            title="Formato"
            icon={<Instagram size={18} />}
            collapsedSections={collapsedSections}
            onToggle={toggleSection}
          >
            <div className="ratio-grid">
              {ratios.map((ratio) => (
                <button
                  key={ratio.id}
                  className={ratio.id === selectedRatio.id ? "chip active" : "chip"}
                  onClick={() => setSelectedRatio(ratio)}
                >
                  {ratio.name}
                </button>
              ))}
            </div>
          </CollapsiblePanel>

          {!isAiMode ? (
            <CollapsiblePanel
              id="intensity"
              title="Intensidade"
              icon={<Sparkles size={18} />}
              badge={<strong className="value-badge">{Math.round(intensity * 100)}%</strong>}
              collapsedSections={collapsedSections}
              onToggle={toggleSection}
            >
              <Range label="Filtro" value={intensity} min={0} max={1.5} step={0.01} onChange={setIntensity} />
            </CollapsiblePanel>
          ) : null}

          {isAiMode ? (
          <CollapsiblePanel
            id="ai-filters"
            title="Filtros IA"
            icon={<Wand2 size={18} />}
            badge={<strong className="value-badge">Gemini</strong>}
            collapsedSections={collapsedSections}
            onToggle={toggleSection}
            className="ai-panel"
          >
            <div className="selected-ai-summary">
              <span className={`ai-filter-preview ${selectedAiPreset.id}`} />
              <div>
                <strong>{selectedAiPreset.name}</strong>
                <small>{selectedAiPreset.label}</small>
              </div>
            </div>
            <label className="prompt-editor">
              <span>Prompt do filtro</span>
              <Textarea
                value={customAiPrompt}
                rows={9}
                spellCheck="false"
                onChange={(event) => setCustomAiPrompt(event.target.value)}
              />
            </label>
            <Button
              className="ghost-button full-width"
              variant="ghost"
              type="button"
              onClick={() => setCustomAiPrompt(selectedAiPreset.prompt)}
            >
              Restaurar prompt do filtro
            </Button>
            {selectedAiPreset.id === "polaroid-instant" ? (
              <div className="polaroid-options">
                <label>
                  <span>Legenda</span>
                  <Input
                    className="text-input"
                    type="text"
                    value={polaroidCaption}
                    maxLength={42}
                    placeholder="Ex: summer day"
                    onChange={(event) => setPolaroidCaption(event.target.value)}
                  />
                </label>
                <label>
                  <span>Data</span>
                  <Input
                    className="text-input"
                    type="text"
                    value={polaroidDate}
                    maxLength={18}
                    placeholder="Ex: 21/06/2026"
                    onChange={(event) => setPolaroidDate(event.target.value)}
                  />
                </label>
              </div>
            ) : null}
            <Button className="primary-button full-width" onClick={runAiFilter} disabled={loadState !== "ready" || aiBusy}>
              <Sparkles size={18} />
              {aiBusy ? "Gerando com IA..." : "Aplicar filtro IA"}
            </Button>
            {aiError ? <p className="error-text">{aiError}</p> : null}
            {aiResultUrl ? (
              <div className="ai-current-result">
                <p className="hint-text">Resultado aplicado no preview principal. Pressione a foto para comparar com a original.</p>
                <Button className="ghost-button full-width" variant="ghost" onClick={downloadAiResult}>
                  <Download size={18} />
                  Baixar resultado atual
                </Button>
              </div>
            ) : null}
            {aiHistory.length ? (
              <div className="ai-history">
                <div className="panel-title small-title">Geradas neste navegador</div>
                {aiHistory.map((item) => (
                  <Card className="ai-history-item" key={item.id}>
                    <button className="ai-history-thumb" onClick={() => loadStoredAiImage(item)} type="button">
                      <img src={item.dataUrl} alt="" />
                    </button>
                    <div className="ai-history-info">
                      <strong>{item.presetName}</strong>
                      <small>{new Date(item.createdAt).toLocaleString("pt-BR")}</small>
                      <div className="ai-history-actions">
                        <Button className="ghost-button" variant="ghost" size="sm" onClick={() => loadStoredAiImage(item)}>
                          Abrir
                        </Button>
                        <Button className="ghost-button" variant="ghost" size="sm" onClick={() => downloadStoredAiImage(item)}>
                          Baixar
                        </Button>
                        <Button className="ghost-button" variant="ghost" size="sm" onClick={() => removeStoredAiImage(item)}>
                          Remover
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            ) : null}
          </CollapsiblePanel>
          ) : null}

          {!isAiMode ? (
          <CollapsiblePanel
            id="recognition"
            title="Reconhecimento"
            icon={<Wand2 size={18} />}
            badge={<strong className="value-badge status-badge">{getAutoMaskLabel(autoMaskStatus)}</strong>}
            collapsedSections={collapsedSections}
            onToggle={toggleSection}
          >
            <Button
              className="ghost-button full-width"
              variant="ghost"
              onClick={() => {
                if (imageRef.current) {
                  setAutoMaskStatus("loading");
                  buildAutomaticMask(imageRef.current, selectedRatio);
                }
              }}
              disabled={loadState !== "ready"}
            >
              Recalcular objeto
            </Button>
          </CollapsiblePanel>
          ) : null}

          {!isAiMode ? (
          <CollapsiblePanel
            id="refine"
            title="Refinar objeto"
            icon={<Brush size={18} />}
            collapsedSections={collapsedSections}
            onToggle={toggleSection}
          >
            <Range
              label="Pincel"
              value={brushSize}
              min={16}
              max={140}
              step={2}
              onChange={setBrushSize}
            />
            <div className="button-row">
              <Button
                className={showMaskOverlay ? "ghost-button toggle-on" : "ghost-button"}
                variant="ghost"
                onClick={() => setShowMaskOverlay((value) => !value)}
                disabled={loadState !== "ready"}
              >
                {showMaskOverlay ? <Eye size={18} /> : <EyeOff size={18} />}
                Mascara
              </Button>
              <Button className="ghost-button" variant="ghost" onClick={clearMask} disabled={loadState !== "ready"}>
                Limpar
              </Button>
            </div>
            <p className="hint-text">Azul = IA local. Laranja = pincel manual.</p>
          </CollapsiblePanel>
          ) : null}

          <CollapsiblePanel
            id="zoom"
            title="Zoom"
            icon={<ZoomIn size={18} />}
            badge={<strong className="value-badge">{zoom.toFixed(1)}x</strong>}
            collapsedSections={collapsedSections}
            onToggle={toggleSection}
          >
            <Range label="Aproximar" value={zoom} min={1} max={3} step={0.05} onChange={setZoom} />
          </CollapsiblePanel>

          {!isAiMode ? (
          <CollapsiblePanel
            id="adjustments"
            title="Ajustes finos"
            icon={<SlidersHorizontal size={18} />}
            collapsedSections={collapsedSections}
            onToggle={toggleSection}
            className="compact-adjustments"
          >
            <AdjustmentControls values={adjustments} onChange={setAdjustments} />
          </CollapsiblePanel>
          ) : null}

          {isAiMode && aiResultUrl ? (
          <CollapsiblePanel
            id="ai-adjustments"
            title="Ajustes da imagem gerada"
            icon={<SlidersHorizontal size={18} />}
            collapsedSections={collapsedSections}
            onToggle={toggleSection}
            className="compact-adjustments"
          >
            <AdjustmentControls values={aiAdjustments} onChange={setAiAdjustments} />
          </CollapsiblePanel>
          ) : null}

          <div className="actions">
            <Button className="primary-button" onClick={downloadPhoto} disabled={loadState !== "ready"}>
              <Download size={18} />
              Baixar PNG
            </Button>
          </div>

          <Button className="ghost-button full-width" variant="ghost" onClick={reset}>
            <RotateCcw size={18} />
            Resetar edicao
          </Button>
        </aside>

        <section className="workspace">
          <div className="workspace-filters">
            {!isAiMode ? (
            <section className="filter-section" aria-labelledby="normal-filters-title">
              <div className="section-heading">
                <h2 id="normal-filters-title">Filtros normais</h2>
                <span>Preview local em tempo real</span>
              </div>
              <div className="filter-strip" aria-label="Filtros normais">
                {presets.map((preset) => (
                  <button
                    key={preset.id}
                    className={preset.id === selectedPreset.id ? "filter-card active" : "filter-card"}
                    title={`${preset.name}: ${preset.label}`}
                    onClick={() => setSelectedPreset(preset)}
                  >
                    <span className="filter-thumb">
                      {filterThumbs[preset.id] ? (
                        <img src={filterThumbs[preset.id]} alt="" />
                      ) : (
                        <span className={`filter-placeholder ${preset.id}`} />
                      )}
                    </span>
                    <strong>{preset.name}</strong>
                    <small>{preset.label}</small>
                  </button>
                ))}
              </div>
            </section>
            ) : null}

            {isAiMode ? (
            <section className="filter-section ai-workspace-section" aria-labelledby="ai-filters-title">
              <div className="section-heading">
                <h2 id="ai-filters-title">Filtros com IA</h2>
                <span>Gemini 2.5 Flash Image</span>
              </div>
              <div className="ai-filter-strip" aria-label="Filtros com inteligencia artificial">
                {aiPresets.map((preset) => (
                  <button
                    key={preset.id}
                    className={preset.id === selectedAiPreset.id ? "ai-filter-card active" : "ai-filter-card"}
                    onClick={() => {
                      setSelectedAiPreset(preset);
                      setCustomAiPrompt(preset.prompt);
                      setAiError("");
                      setAiResultUrl("");
                    }}
                  >
                    <span className={`ai-filter-preview ${preset.id}`} />
                    <strong>{preset.name}</strong>
                    <small>{preset.label}</small>
                  </button>
                ))}
              </div>
            </section>
            ) : null}
          </div>

          <div
            className={isDragging ? "dropzone dragging" : "dropzone"}
            onDragOver={(event) => {
              event.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setIsDragging(false);
              handleFiles(event.dataTransfer.files);
            }}
          >
            {loadState === "ready" ? (
              <div className="canvas-scroll" ref={scrollRef}>
                <div
                  className={isShowingOriginal ? "canvas-stage comparing" : "canvas-stage"}
                  style={stageStyle}
                  onPointerDownCapture={handleStageCompareDown}
                  onPointerUp={hideOriginal}
                  onPointerLeave={hideOriginal}
                  onPointerCancel={hideOriginal}
                  onBlur={hideOriginal}
                  tabIndex={0}
                  aria-label="Preview da foto. Pressione para comparar com a original."
                >
                  <canvas ref={photoCanvasRef} className="photo-canvas" aria-label="Foto com filtro" />
                  <canvas
                    ref={maskCanvasRef}
                    className={`${isPainting ? "mask-canvas painting" : "mask-canvas"} ${isAiMode ? "disabled" : ""}`}
                    aria-label="Pintar objeto principal"
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={stopPainting}
                    onPointerCancel={stopPainting}
                    onPointerLeave={stopPainting}
                  />
                </div>
              </div>
            ) : (
              <div className="empty-state">
                <ImagePlus size={42} />
                <h2>{loadState === "loading" ? "Carregando imagem..." : "Arraste uma foto aqui"}</h2>
                <p>
                  {errorMessage ||
                    "Envie uma foto, deixe a IA reconhecer o assunto e refine a mascara com o pincel."}
                </p>
                <button className="primary-button" onClick={() => fileInputRef.current?.click()}>
                  Selecionar imagem
                </button>
              </div>
            )}
          </div>
        </section>
      </section>
    </main>
  );
}

function CollapsiblePanel({ id, title, icon, badge, collapsedSections, onToggle, className = "", children }) {
  const isCollapsed = Boolean(collapsedSections[id]);

  return (
    <div className={`panel collapsible-panel ${isCollapsed ? "collapsed" : ""} ${className}`}>
      <button className="panel-title panel-toggle" type="button" onClick={() => onToggle(id)}>
        {icon}
        <span className="panel-title-text">{title}</span>
        {badge}
        <ChevronDown size={16} className="panel-chevron" />
      </button>
      {!isCollapsed ? <div className="panel-content">{children}</div> : null}
    </div>
  );
}

function AdjustmentControls({ values, onChange }) {
  const update = (key) => (value) => onChange((current) => ({ ...current, [key]: value }));

  return (
    <>
      <Range label="Exposicao" value={values.exposure} min={-0.7} max={0.7} step={0.01} onChange={update("exposure")} />
      <Range label="Brilho" value={values.brightness} min={0.72} max={1.38} step={0.01} onChange={update("brightness")} />
      <Range label="Contraste" value={values.contrast} min={0.72} max={1.42} step={0.01} onChange={update("contrast")} />
      <Range label="Saturacao" value={values.saturation} min={0} max={1.8} step={0.01} onChange={update("saturation")} />
      <Range label="Temperatura" value={values.warmth} min={-35} max={35} step={1} onChange={update("warmth")} />
      <Range label="Realces" value={values.highlights} min={-45} max={45} step={1} onChange={update("highlights")} />
      <Range label="Sombras" value={values.shadows} min={-45} max={45} step={1} onChange={update("shadows")} />
      <Range label="Nitidez" value={values.sharpness} min={0} max={70} step={1} onChange={update("sharpness")} />
      <Range label="Granulacao" value={values.grain} min={0} max={36} step={1} onChange={update("grain")} />
      <Range label="Vinheta" value={values.vignette} min={0} max={42} step={1} onChange={update("vignette")} />
      <Range label="Fade" value={values.fade} min={0} max={38} step={1} onChange={update("fade")} />
    </>
  );
}

function Range({ label, value, min, max, step, onChange }) {
  const [draftValue, setDraftValue] = useState(value);
  const percent = ((draftValue - min) / (max - min)) * 100;

  useEffect(() => {
    setDraftValue(value);
  }, [value]);

  function commit(nextValue = draftValue) {
    const numericValue = Number(nextValue);
    if (Number.isNaN(numericValue) || numericValue === value) return;
    onChange(numericValue);
  }

  return (
    <label className="range-row">
      <span>{label}</span>
      <input
        type="range"
        value={draftValue}
        min={min}
        max={max}
        step={step}
        style={{ "--range-progress": `${percent}%` }}
        onChange={(event) => setDraftValue(Number(event.target.value))}
        onPointerUp={(event) => commit(event.currentTarget.value)}
        onTouchEnd={(event) => commit(event.currentTarget.value)}
        onMouseUp={(event) => commit(event.currentTarget.value)}
        onKeyUp={(event) => commit(event.currentTarget.value)}
        onBlur={(event) => commit(event.currentTarget.value)}
      />
    </label>
  );
}

createRoot(document.getElementById("root")).render(<App />);
