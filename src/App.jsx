import React, { useEffect, useMemo, useRef, useState } from "react";
import { GoogleGenAI } from "@google/genai";
import { FilesetResolver, ImageSegmenter } from "@mediapipe/tasks-vision";
import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";
import {
  Brush,
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
import { GEMINI_API_KEY, GEMINI_IMAGE_MODEL, MEDIAPIPE_WASM_URL, PREVIEW_MAX_WIDTH, SELFIE_SEGMENTER_MODEL_URL, EXPORT_MAX_WIDTH, THUMB_WIDTH } from "./config/constants";
import { aiPresets, defaultAdjustments, neutralPreset, presets, ratios, sidebarPanelOrder } from "./data/editor-presets";
import { AdjustmentControls, SliderRange } from "./components/editor/AdjustmentControls";
import { CollapsiblePanel } from "./components/editor/CollapsiblePanel";
import { applyImageFilter, getCanvasBoardStyle, getStageWidth, getWheelZoom, mergeFilter } from "./lib/image-processing";
import { downloadCanvas, downloadDataUrl, readFileAsDataUrl } from "./lib/file-downloads";
import { buildHeuristicMask, combineMasks, copyImageData, enhanceHairMask, extractMediaPipeMask, getAutoMaskLabel, getRecognitionStepMessage, makeMask } from "./lib/masks";
import { buildAiPrompt, dataUrlToInlineData, findGeminiGeneratedImage, getGeminiErrorMessage } from "./lib/gemini";
import { deleteStoredAiImage, getStoredAiImages, saveStoredAiImage } from "./lib/ai-history";
import { mergeSidebarPanelOrder, movePanelTo, readCollapsedSections, readSidebarPanelOrder } from "./lib/sidebar-state";

// eslint-disable-next-line complexity -- App still orchestrates the single-file editor UI; algorithmic paths are split into helpers.
export function App() {
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
  const [isPanningCanvas, setIsPanningCanvas] = useState(false);
  const [loadState, setLoadState] = useState("idle");
  const [autoMaskStatus, setAutoMaskStatus] = useState("idle");
  const [recognitionStepOpen, setRecognitionStepOpen] = useState(false);
  const [recognitionStepDone, setRecognitionStepDone] = useState(false);
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
  const [panelOrder, setPanelOrder] = useState(readSidebarPanelOrder);
  const [dragCollapsedPanelId, setDragCollapsedPanelId] = useState(null);
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
  const canvasPanRef = useRef(null);
  const canvasCenterKeyRef = useRef("");
  const zoomRef = useRef(zoom);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { delay: 80, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const currentFilter = useMemo(
    () => mergeFilter(selectedPreset.filter, adjustments, intensity),
    [selectedPreset, intensity, adjustments],
  );
  const isAiMode = filterMode === "ai";
  const aiFilter = useMemo(() => mergeFilter(neutralPreset, aiAdjustments, 1), [aiAdjustments]);
  const activeFilter = isAiMode ? aiFilter : currentFilter;
  const shouldUseLocalFilter = isAiMode ? Boolean(aiResultUrl) : true;

  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  useEffect(() => {
    try {
      window.localStorage.setItem(SECTION_STORAGE_KEY, JSON.stringify(collapsedSections));
    } catch {
      // Ignore unavailable storage; collapsible sections still work for the current render.
    }
  }, [collapsedSections]);

  useEffect(() => {
    try {
      window.localStorage.setItem(PANEL_ORDER_STORAGE_KEY, JSON.stringify(panelOrder));
    } catch {
      // Ignore unavailable storage; custom order still works for the current render.
    }
  }, [panelOrder]);

  function toggleSection(sectionId) {
    setCollapsedSections((current) => ({ ...current, [sectionId]: !current[sectionId] }));
  }

  function getPanelOrderValue(panelId) {
    const index = panelOrder.indexOf(panelId);
    return index < 0 ? sidebarPanelOrder.length : index;
  }

  function isPanelVisible(panelId) {
    if (["ai-filters", "ai-adjustments"].includes(panelId)) {
      return isAiMode && (panelId !== "ai-adjustments" || Boolean(aiResultUrl));
    }
    if (["recognition", "refine"].includes(panelId)) {
      return !isAiMode && loadState === "ready" && !recognitionStepDone;
    }
    if (["intensity", "adjustments"].includes(panelId)) {
      return !isAiMode;
    }
    return true;
  }

  const visiblePanelOrder = useMemo(
    () => mergeSidebarPanelOrder(panelOrder).filter((panelId) => isPanelVisible(panelId)),
    [aiResultUrl, filterMode, loadState, panelOrder, recognitionStepDone],
  );

  function handlePanelDragStart(event) {
    const panelId = String(event.active.id);
    if (!collapsedSections[panelId]) {
      setDragCollapsedPanelId(panelId);
    }
  }

  function handlePanelDragCancel() {
    setDragCollapsedPanelId(null);
  }

  function handlePanelDragEnd(event) {
    const movingPanelId = String(event.active.id);
    const targetPanelId = event.over?.id ? String(event.over.id) : "";
    setDragCollapsedPanelId(null);
    if (!targetPanelId) return;
    setPanelOrder((current) => movePanelTo(current, movingPanelId, targetPanelId));
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
      setRecognitionStepOpen(filterMode === "normal");
      setRecognitionStepDone(filterMode !== "normal");
      renderPreview(image, activeFilter, selectedRatio, {
        useFilter: shouldUseLocalFilter,
        showOverlay: filterMode === "normal" && (showMaskOverlay || !recognitionStepDone),
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
        showOverlay:
          filterMode === "normal" && (showMaskOverlay || recognitionStepOpen) && !isShowingOriginal,
      });
    }
  }, [
    activeFilter,
    loadState,
    isShowingOriginal,
    showMaskOverlay,
    filterMode,
    shouldUseLocalFilter,
    recognitionStepOpen,
  ]);

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
        showOverlay:
          filterMode === "normal" && (showMaskOverlay || recognitionStepOpen) && !isShowingOriginal,
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
      const width = Math.round(element.clientWidth);
      const height = Math.round(element.clientHeight);
      setPreviewBox((current) => (current.width === width && current.height === height ? current : { width, height }));
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

  useEffect(() => {
    if (loadState !== "ready" || !canvasSize.width || !canvasSize.height) return;
    const centerKey = `${imageUrl}|${selectedRatio.id}|${canvasSize.width}x${canvasSize.height}`;
    if (canvasCenterKeyRef.current === centerKey) return;
    canvasCenterKeyRef.current = centerKey;
    requestAnimationFrame(centerCanvasView);
  }, [canvasSize.width, canvasSize.height, imageUrl, selectedRatio.id, loadState]);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element || loadState !== "ready") return undefined;
    const onWheel = (event) => handleCanvasWheel(event);
    element.addEventListener("wheel", onWheel, { passive: false });
    return () => element.removeEventListener("wheel", onWheel);
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
      await applyMediaPipeMask(runId, source, fallbackMask);
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

  async function applyMediaPipeMask(runId, source, fallbackMask) {
    const segmenter = await getSegmenter();
    if (segmentationRunRef.current !== runId) return;
    const result = segmenter.segment(source.canvas);
    const mediaPipeMask = extractMediaPipeMask(result, source.imageData.width, source.imageData.height);
    autoMaskRef.current = enhanceHairMask(mediaPipeMask || fallbackMask, source.imageData);
    updateCombinedMask();
    setAutoMaskStatus(mediaPipeMask ? "ready" : "fallback");
    result.close?.();
  }

  function getOverlayPixel(autoMask, manualMask, index) {
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
    if (event.button !== 0) return;
    if (loadState !== "ready" || isShowingOriginal || recognitionStepOpen) return;
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
    if (!isPainting) return;
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
    setRecognitionStepOpen(filterMode === "normal");
    setRecognitionStepDone(filterMode !== "normal");
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

  async function generateGeminiImage(apiKey, prompt) {
    const ai = new GoogleGenAI({ apiKey });
    const inputCanvas = renderBaseOutputCanvas(imageRef.current, selectedRatio);
    const inlineData = dataUrlToInlineData(inputCanvas.toDataURL("image/png"));
    return ai.models.generateContent({
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
  }

  function getPartInlineData(part) {
    return part?.inlineData || part?.inline_data || null;
  }

  function getGeminiImageData(response) {
    const generatedPart = findGeminiGeneratedImage(response);
    const inlineData = getPartInlineData(generatedPart);
    const generatedData = inlineData?.data;
    const mimeType = inlineData?.mimeType || inlineData?.mime_type || "image/png";

    if (!generatedData) {
      throw new Error("A resposta do Gemini nao trouxe uma imagem. Tente outro filtro ou prompt.");
    }

    return { generatedData, mimeType };
  }

  function applyGeneratedImage(resultUrl, prompt) {
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
      const prompt = buildAiPrompt(selectedAiPreset, {
        prompt: customAiPrompt,
        caption: polaroidCaption,
        date: polaroidDate,
      });
      const response = await generateGeminiImage(apiKey, prompt);
      const { generatedData, mimeType } = getGeminiImageData(response);
      const resultUrl = `data:${mimeType};base64,${generatedData}`;
      applyGeneratedImage(resultUrl, prompt);
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
    setRecognitionStepOpen(false);
    setRecognitionStepDone(true);
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

  function restoreOriginalImage() {
    setIsShowingOriginal(false);
    if (isAiMode) {
      setAiResultUrl("");
      setAiAdjustments(defaultAdjustments);
      setAiError("");
      if (originalImageUrl) {
        setImageUrl(originalImageUrl);
      }
      return;
    }

    setIntensity(0);
    setAdjustments(defaultAdjustments);
    setShowMaskOverlay(false);
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
    setRecognitionStepOpen(false);
    setRecognitionStepDone(false);
    setAiError("");
    setAiResultUrl("");
    setCustomAiPrompt(aiPresets[0].prompt);
    setPolaroidCaption("");
    setPolaroidDate("");
    clearMask();
  }

  function completeRecognitionStep() {
    setRecognitionStepOpen(false);
    setRecognitionStepDone(true);
    setShowMaskOverlay(false);
    schedulePreviewRender({ useFilter: shouldUseLocalFilter, showOverlay: false });
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
      showOverlay: filterMode === "normal" && (showMaskOverlay || recognitionStepOpen),
    });
  }

  function handleStageCompareDown(event) {
    if (event.button !== 0) return;
    if (loadState !== "ready" || isPainting || recognitionStepOpen) return;
    if (!isAiMode && event.target !== photoCanvasRef.current) return;
    showOriginal();
  }

  function handleCanvasWheel(event) {
    if (!event.ctrlKey || loadState !== "ready") return;

    event.preventDefault();
    const element = scrollRef.current;
    const stage = photoCanvasRef.current?.parentElement;
    if (!element || !stage) return;

    const previousZoom = zoomRef.current;
    const nextZoom = getWheelZoom(previousZoom, event.deltaY);
    if (nextZoom === previousZoom) return;

    const stageRect = stage.getBoundingClientRect();
    const pointerStageX = event.clientX - stageRect.left;
    const pointerStageY = event.clientY - stageRect.top;
    const ratio = nextZoom / previousZoom;

    setZoom(nextZoom);
    zoomRef.current = nextZoom;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const nextStageRect = stage.getBoundingClientRect();
        const targetLeft = event.clientX - pointerStageX * ratio;
        const targetTop = event.clientY - pointerStageY * ratio;
        element.scrollLeft += nextStageRect.left - targetLeft;
        element.scrollTop += nextStageRect.top - targetTop;
      });
    });
  }

  function startCanvasPan(event) {
    if (event.button !== 1 || loadState !== "ready") return;
    const element = scrollRef.current;
    if (!element) return;

    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    canvasPanRef.current = {
      x: event.clientX,
      y: event.clientY,
      scrollLeft: element.scrollLeft,
      scrollTop: element.scrollTop,
    };
    setIsPanningCanvas(true);
  }

  function moveCanvasPan(event) {
    const pan = canvasPanRef.current;
    const element = scrollRef.current;
    if (!pan || !element) return;

    event.preventDefault();
    element.scrollLeft = pan.scrollLeft - (event.clientX - pan.x);
    element.scrollTop = pan.scrollTop - (event.clientY - pan.y);
  }

  function stopCanvasPan(event) {
    if (!canvasPanRef.current) return;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    canvasPanRef.current = null;
    setIsPanningCanvas(false);
  }

  function centerCanvasView() {
    const element = scrollRef.current;
    if (!element) return;
    element.scrollLeft = Math.max(0, (element.scrollWidth - element.clientWidth) / 2);
    element.scrollTop = Math.max(0, (element.scrollHeight - element.clientHeight) / 2);
  }

  const stageWidth = canvasSize.width && canvasSize.height ? getStageWidth(canvasSize, previewBox, zoom) : 0;
  const stageHeight = stageWidth ? stageWidth * (canvasSize.height / canvasSize.width) : 0;
  const boardStyle = getCanvasBoardStyle(previewBox, stageWidth, stageHeight);

  const stageStyle =
    canvasSize.width && canvasSize.height
      ? {
          aspectRatio: `${canvasSize.width} / ${canvasSize.height}`,
          width: `${stageWidth}px`,
        }
      : undefined;

  return (
    <main className="app">
      <section className="editor">
        <aside className="sidebar">
          <div className="brand" style={{ order: -20 }}>
            <div className="brand-mark">
              <Sparkles size={22} />
            </div>
            <div>
              <h1>Coco Hemi</h1>
              <p>Editor social com IA local, luz de fundo e preview comparativo.</p>
            </div>
          </div>

          <Button className="upload-button" style={{ order: -19 }} onClick={() => fileInputRef.current?.click()}>
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

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handlePanelDragStart}
            onDragCancel={handlePanelDragCancel}
            onDragEnd={handlePanelDragEnd}
          >
            <SortableContext items={visiblePanelOrder} strategy={verticalListSortingStrategy}>
          <CollapsiblePanel
            id="filter-type"
            title="Tipo de filtro"
            icon={<SlidersHorizontal size={18} />}
            collapsedSections={collapsedSections}
            orderValue={getPanelOrderValue("filter-type")}
            forceCollapsed={dragCollapsedPanelId === "filter-type"}
            onToggle={toggleSection}
          >
            <div className="mode-switch" aria-label="Selecionar tipo de filtro">
              <button
                className={filterMode === "normal" ? "mode-button active" : "mode-button"}
                onClick={() => {
                  setFilterMode("normal");
                  if (loadState === "ready" && !recognitionStepDone) {
                    setRecognitionStepOpen(true);
                  }
                }}
              >
                Normais
              </button>
              <button
                className={filterMode === "ai" ? "mode-button active" : "mode-button"}
                onClick={() => {
                  setFilterMode("ai");
                  setRecognitionStepOpen(false);
                  setRecognitionStepDone(true);
                }}
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
            orderValue={getPanelOrderValue("format")}
            forceCollapsed={dragCollapsedPanelId === "format"}
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
              orderValue={getPanelOrderValue("intensity")}
              forceCollapsed={dragCollapsedPanelId === "intensity"}
              onToggle={toggleSection}
            >
              <SliderRange
                label="Filtro"
                value={intensity}
                min={0}
                max={1.5}
                step={0.01}
                onChange={setIntensity}
                formatValue={(value) => `${Math.round(value * 100)}%`}
              />
            </CollapsiblePanel>
          ) : null}

          {isAiMode ? (
          <CollapsiblePanel
            id="ai-filters"
            title="Filtros IA"
            icon={<Wand2 size={18} />}
            badge={<strong className="value-badge">Gemini</strong>}
            collapsedSections={collapsedSections}
            orderValue={getPanelOrderValue("ai-filters")}
            forceCollapsed={dragCollapsedPanelId === "ai-filters"}
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

          {!isAiMode && loadState === "ready" && !recognitionStepDone ? (
          <CollapsiblePanel
            id="recognition"
            title="Reconhecimento"
            icon={<Wand2 size={18} />}
            badge={<strong className="value-badge status-badge">{getAutoMaskLabel(autoMaskStatus)}</strong>}
            collapsedSections={collapsedSections}
            orderValue={getPanelOrderValue("recognition")}
            forceCollapsed={dragCollapsedPanelId === "recognition"}
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

          {!isAiMode && loadState === "ready" && !recognitionStepDone ? (
          <CollapsiblePanel
            id="refine"
            title="Refinar objeto"
            icon={<Brush size={18} />}
            collapsedSections={collapsedSections}
            orderValue={getPanelOrderValue("refine")}
            forceCollapsed={dragCollapsedPanelId === "refine"}
            onToggle={toggleSection}
          >
            <SliderRange
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
            orderValue={getPanelOrderValue("zoom")}
            forceCollapsed={dragCollapsedPanelId === "zoom"}
            onToggle={toggleSection}
          >
            <SliderRange
              label="Aproximar"
              value={zoom}
              min={1}
              max={3}
              step={0.05}
              onChange={setZoom}
              liveUpdate
              formatValue={(value) => `${value.toFixed(2)}x`}
            />
          </CollapsiblePanel>

          {!isAiMode ? (
          <CollapsiblePanel
            id="adjustments"
            title="Ajustes finos"
            icon={<SlidersHorizontal size={18} />}
            collapsedSections={collapsedSections}
            orderValue={getPanelOrderValue("adjustments")}
            forceCollapsed={dragCollapsedPanelId === "adjustments"}
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
            orderValue={getPanelOrderValue("ai-adjustments")}
            forceCollapsed={dragCollapsedPanelId === "ai-adjustments"}
            onToggle={toggleSection}
            className="compact-adjustments"
          >
            <AdjustmentControls values={aiAdjustments} onChange={setAiAdjustments} />
          </CollapsiblePanel>
          ) : null}
            </SortableContext>
          </DndContext>

          <div className="actions" style={{ order: 1000 }}>
            <Button className="primary-button" onClick={downloadPhoto} disabled={loadState !== "ready"}>
              <Download size={18} />
              Baixar PNG
            </Button>
          </div>

          <Button className="ghost-button full-width" style={{ order: 1001 }} variant="ghost" onClick={reset}>
            <RotateCcw size={18} />
            Resetar edicao
          </Button>

          <Button
            className="ghost-button full-width"
            style={{ order: 1002 }}
            variant="ghost"
            onClick={restoreOriginalImage}
            disabled={loadState !== "ready"}
          >
            <EyeOff size={18} />
            Remover filtro atual
          </Button>
        </aside>

        <section className="workspace">
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
              <div
                className={isPanningCanvas ? "canvas-scroll panning" : "canvas-scroll"}
                ref={scrollRef}
                onPointerDown={startCanvasPan}
                onPointerMove={moveCanvasPan}
                onPointerUp={stopCanvasPan}
                onPointerCancel={stopCanvasPan}
                onPointerLeave={stopCanvasPan}
                onAuxClick={(event) => event.preventDefault()}
              >
                <div className="canvas-board" style={boardStyle}>
                  <div
                    className={`${isShowingOriginal ? "canvas-stage comparing" : "canvas-stage"} ${
                      recognitionStepOpen ? "recognition-active" : ""
                    }`}
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
                      className={`${isPainting ? "mask-canvas painting" : "mask-canvas"} ${
                        isAiMode || recognitionStepOpen ? "disabled" : ""
                      }`}
                      aria-label="Pintar objeto principal"
                      onPointerDown={handlePointerDown}
                      onPointerMove={handlePointerMove}
                      onPointerUp={stopPainting}
                      onPointerCancel={stopPainting}
                      onPointerLeave={stopPainting}
                    />
                    {recognitionStepOpen ? (
                      <div className="recognition-modal" role="dialog" aria-modal="true" aria-labelledby="recognition-title">
                        <div className="recognition-icon">
                          <Wand2 size={20} />
                        </div>
                        <div>
                          <h2 id="recognition-title">Reconhecimento da imagem</h2>
                          <p>{getRecognitionStepMessage(autoMaskStatus)}</p>
                        </div>
                        <div className="recognition-status">
                          <strong>{getAutoMaskLabel(autoMaskStatus)}</strong>
                          <span>{autoMaskStatus === "loading" ? "Analisando pessoa e assunto" : "Mascara pronta para revisar"}</span>
                        </div>
                        <div className="recognition-actions">
                          <Button
                            className="ghost-button"
                            variant="ghost"
                            type="button"
                            onClick={() => {
                              if (imageRef.current) {
                                setAutoMaskStatus("loading");
                                buildAutomaticMask(imageRef.current, selectedRatio);
                              }
                            }}
                            disabled={autoMaskStatus === "loading"}
                          >
                            Recalcular
                          </Button>
                          <Button
                            className="primary-button"
                            type="button"
                            onClick={completeRecognitionStep}
                            disabled={autoMaskStatus === "loading"}
                          >
                            Proximo
                          </Button>
                        </div>
                      </div>
                    ) : null}
                  </div>
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

        <aside className="filter-sidebar" aria-label="Selecao de filtros">
          <div className="workspace-filters">
            {!isAiMode ? (
              <section className="filter-section" aria-labelledby="normal-filters-title">
                <div className="section-heading">
                  <h2 id="normal-filters-title">Filtros normais</h2>
                  <span>Preview local</span>
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
                  <span>Gemini</span>
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
        </aside>
      </section>
    </main>
  );
}


