// @ts-nocheck
import { useCallback, useEffect, useRef, useState } from "react";
import { PREVIEW_MAX_WIDTH } from "../../config/constants";
import { drawMaskOverlay, drawOverlayCircle, getCanvasPoint, paintCircle } from "../../lib/editor-brush";
import { makeSourceImageData, renderBaseOutputCanvas, renderOutputCanvas } from "../../lib/editor-canvas";
import { applyMediaPipeMask, buildFallbackMask } from "../../lib/editor-segmentation";
import { buildFilterThumbnailUrls } from "../../lib/editor-thumbnails";
import { applyImageFilter, getWheelZoom } from "../../lib/image-processing";
import { combineMasks, copyImageData, makeMask } from "../../lib/masks";

export function useEditorPreview({
  imageUrl,
  originalImageUrl,
  imageRef,
  loadState,
  filterMode,
  activeFilter,
  selectedRatio,
  shouldUseLocalFilter,
  showMaskOverlay,
  recognitionStepOpen,
  recognitionStepDone: _recognitionStepDone,
  intensity,
  adjustments,
  brushSize,
  setAutoMaskStatus,
}) {
  const photoCanvasRef = useRef(null);
  const maskCanvasRef = useRef(null);
  const scrollRef = useRef(null);
  const autoMaskRef = useRef(null);
  const manualMaskRef = useRef(null);
  const combinedMaskRef = useRef(null);
  const lastPaintRef = useRef(null);
  const renderFrameRef = useRef(null);
  const thumbnailFrameRef = useRef(null);
  const thumbnailTimerRef = useRef(null);
  const segmentationRunRef = useRef(0);
  const previewSourceRef = useRef(null);
  const canvasPanRef = useRef(null);
  const canvasCenterKeyRef = useRef("");
  const zoomRef = useRef(1);

  const [zoom, setZoom] = useState(1);
  const [isPainting, setIsPainting] = useState(false);
  const [isPanningCanvas, setIsPanningCanvas] = useState(false);
  const [isShowingOriginal, setIsShowingOriginal] = useState(false);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [previewBox, setPreviewBox] = useState({ width: 0, height: 0 });
  const [filterThumbs, setFilterThumbs] = useState({});
  const [maskVersion, setMaskVersion] = useState(0);

  const isAiMode = filterMode === "ai";

  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  const updateCombinedMask = useCallback(() => {
    combinedMaskRef.current = combineMasks(autoMaskRef.current, manualMaskRef.current);
    setMaskVersion((value) => value + 1);
    return combinedMaskRef.current;
  }, []);

  const getPreviewSource = useCallback(
    (image, ratio, sourceKey = imageUrl) => {
      const key = `${sourceKey}|${ratio.id}|${PREVIEW_MAX_WIDTH}`;
      if (previewSourceRef.current?.key === key) return previewSourceRef.current;

      const source = makeSourceImageData(image, ratio, PREVIEW_MAX_WIDTH);
      previewSourceRef.current = { key, ...source };
      return previewSourceRef.current;
    },
    [imageUrl],
  );

  const ensureManualMask = useCallback(
    (width, height) => {
      const current = manualMaskRef.current;
      if (!current || current.width !== width || current.height !== height) {
        manualMaskRef.current = makeMask(width, height);
        updateCombinedMask();
      }
      return manualMaskRef.current;
    },
    [updateCombinedMask],
  );

  const prepareCanvases = useCallback(
    (width, height) => {
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
    },
    [ensureManualMask],
  );

  const renderPreview = useCallback(
    (image, filter, ratio, options = {}) => {
      const useFilter = options.useFilter !== false;
      const showOverlay =
        options.showOverlay ?? (useFilter && showMaskOverlay && !isShowingOriginal);
      const source = getPreviewSource(image, ratio, options.sourceKey);
      const ctx = prepareCanvases(source.imageData.width, source.imageData.height);
      if (!ctx) return;

      if (useFilter) {
        const pixels = copyImageData(source.imageData);
        ctx.putImageData(applyImageFilter(pixels, filter, combinedMaskRef.current), 0, 0);
      } else {
        ctx.putImageData(source.imageData, 0, 0);
      }

      drawMaskOverlay(
        maskCanvasRef.current,
        autoMaskRef.current,
        manualMaskRef.current,
        showOverlay,
      );
    },
    [getPreviewSource, isShowingOriginal, prepareCanvases, showMaskOverlay],
  );

  const schedulePreviewRender = useCallback(
    (options = {}) => {
      if (renderFrameRef.current) {
        cancelAnimationFrame(renderFrameRef.current);
      }
      renderFrameRef.current = requestAnimationFrame(() => {
        renderFrameRef.current = null;
        if (imageRef.current) {
          renderPreview(imageRef.current, activeFilter, selectedRatio, options);
        }
      });
    },
    [activeFilter, imageRef, renderPreview, selectedRatio],
  );

  const buildAutomaticMask = useCallback(
    async (image, ratio) => {
      const runId = segmentationRunRef.current + 1;
      segmentationRunRef.current = runId;
      const source = getPreviewSource(image, ratio);
      const fallbackMask = buildFallbackMask(source);
      autoMaskRef.current = fallbackMask;
      updateCombinedMask();
      schedulePreviewRender({ useFilter: shouldUseLocalFilter && !isShowingOriginal });

      try {
        setAutoMaskStatus("loading");
        const mask = await applyMediaPipeMask(runId, source, fallbackMask, (id) => segmentationRunRef.current !== id);
        if (segmentationRunRef.current !== runId) return;

        autoMaskRef.current = mask ?? fallbackMask;
        updateCombinedMask();
        setAutoMaskStatus(mask ? "ready" : "fallback");
      } catch {
        if (segmentationRunRef.current !== runId) return;
        autoMaskRef.current = fallbackMask;
        updateCombinedMask();
        setAutoMaskStatus("fallback");
      }

      if (imageRef.current && segmentationRunRef.current === runId) {
        schedulePreviewRender({ useFilter: shouldUseLocalFilter && !isShowingOriginal });
      }
    },
    [
      getPreviewSource,
      imageRef,
      isShowingOriginal,
      schedulePreviewRender,
      setAutoMaskStatus,
      shouldUseLocalFilter,
      updateCombinedMask,
    ],
  );

  const scheduleThumbnailBuild = useCallback(() => {
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
        if (!imageRef.current || loadState !== "ready") return;
        setFilterThumbs(
          buildFilterThumbnailUrls(
            imageRef.current,
            selectedRatio,
            combinedMaskRef.current,
            adjustments,
            intensity,
          ),
        );
      });
    }, 180);
  }, [adjustments, imageRef, intensity, loadState, selectedRatio]);

  const paintAt = useCallback(
    (point) => {
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
    },
    [brushSize, ensureManualMask, isShowingOriginal, showMaskOverlay],
  );

  const clearMask = useCallback(() => {
    if (!manualMaskRef.current) return;
    manualMaskRef.current.data.fill(0);
    updateCombinedMask();
    schedulePreviewRender({ useFilter: shouldUseLocalFilter && !isShowingOriginal });
  }, [isShowingOriginal, schedulePreviewRender, shouldUseLocalFilter, updateCombinedMask]);

  const resetMaskState = useCallback(() => {
    autoMaskRef.current = null;
    manualMaskRef.current = null;
    combinedMaskRef.current = null;
    previewSourceRef.current = null;
    setFilterThumbs({});
  }, []);

  const completeRecognitionStep = useCallback(() => {
    schedulePreviewRender({ useFilter: shouldUseLocalFilter, showOverlay: false });
  }, [schedulePreviewRender, shouldUseLocalFilter]);

  const showOriginal = useCallback(
    (originalImageRef) => {
      if (!imageRef.current || loadState !== "ready") return;
      const compareImage = originalImageRef?.current || imageRef.current;
      setIsShowingOriginal(true);
      renderPreview(compareImage, activeFilter, selectedRatio, {
        useFilter: false,
        showOverlay: false,
        sourceKey: originalImageUrl || imageUrl,
      });
    },
    [activeFilter, imageRef, imageUrl, loadState, originalImageUrl, renderPreview, selectedRatio],
  );

  const hideOriginal = useCallback(() => {
    if (!imageRef.current || loadState !== "ready") return;
    setIsShowingOriginal(false);
    renderPreview(imageRef.current, activeFilter, selectedRatio, {
      useFilter: shouldUseLocalFilter,
      showOverlay: filterMode === "normal" && (showMaskOverlay || recognitionStepOpen),
    });
  }, [
    activeFilter,
    filterMode,
    imageRef,
    loadState,
    recognitionStepOpen,
    renderPreview,
    selectedRatio,
    shouldUseLocalFilter,
    showMaskOverlay,
  ]);

  const handlePointerDown = useCallback(
    (event) => {
      if (event.button !== 0) return;
      if (loadState !== "ready" || isShowingOriginal || recognitionStepOpen) return;
      event.preventDefault();
      event.currentTarget.setPointerCapture?.(event.pointerId);
      setIsPainting(true);
      lastPaintRef.current = null;
      paintAt(getCanvasPoint(maskCanvasRef.current, event));
    },
    [isShowingOriginal, loadState, paintAt, recognitionStepOpen],
  );

  const handlePointerMove = useCallback(
    (event) => {
      if (!isPainting) return;
      event.preventDefault();
      paintAt(getCanvasPoint(maskCanvasRef.current, event));
    },
    [isPainting, paintAt],
  );

  const stopPainting = useCallback(
    (event) => {
      if (!isPainting) return;
      event.currentTarget.releasePointerCapture?.(event.pointerId);
      setIsPainting(false);
      lastPaintRef.current = null;
      updateCombinedMask();
      schedulePreviewRender({ useFilter: shouldUseLocalFilter && !isShowingOriginal });
    },
    [isPainting, isShowingOriginal, schedulePreviewRender, shouldUseLocalFilter, updateCombinedMask],
  );

  const handleStageCompareDown = useCallback(
    (event, originalImageRef) => {
      if (event.button !== 0) return;
      if (loadState !== "ready" || isPainting || recognitionStepOpen) return;
      if (!isAiMode && event.target !== photoCanvasRef.current) return;
      showOriginal(originalImageRef);
    },
    [isAiMode, isPainting, loadState, recognitionStepOpen, showOriginal],
  );

  const handleCanvasWheel = useCallback(
    (event) => {
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
    },
    [loadState],
  );

  const startCanvasPan = useCallback(
    (event) => {
      if (event.button !== 1 || loadState !== "ready") return;
      const element = scrollRef.current;
      if (!element) return;

      event.preventDefault();
      if (canvasPanRef.current) return;
      event.currentTarget.setPointerCapture?.(event.pointerId);
      canvasPanRef.current = {
        x: event.clientX,
        y: event.clientY,
        scrollLeft: element.scrollLeft,
        scrollTop: element.scrollTop,
      };
      setIsPanningCanvas(true);
    },
    [loadState],
  );

  const blockMiddleMousePan = useCallback(
    (event) => {
      if (event.button !== 1 || loadState !== "ready") return;
      event.preventDefault();
    },
    [loadState],
  );

  const moveCanvasPan = useCallback((event) => {
    const pan = canvasPanRef.current;
    const element = scrollRef.current;
    if (!pan || !element) return;

    event.preventDefault();
    element.scrollLeft = pan.scrollLeft - (event.clientX - pan.x);
    element.scrollTop = pan.scrollTop - (event.clientY - pan.y);
  }, []);

  const stopCanvasPan = useCallback((event) => {
    if (!canvasPanRef.current) return;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    canvasPanRef.current = null;
    setIsPanningCanvas(false);
  }, []);

  const centerCanvasView = useCallback(() => {
    const element = scrollRef.current;
    if (!element) return;
    element.scrollLeft = Math.max(0, (element.scrollWidth - element.clientWidth) / 2);
    element.scrollTop = Math.max(0, (element.scrollHeight - element.clientHeight) / 2);
  }, []);

  const resetZoom = useCallback(() => {
    setZoom(1);
    setCanvasSize({ width: 0, height: 0 });
  }, []);

  const renderDownloadCanvas = useCallback(
    (isAiMode, aiResultUrl, aiFilter, currentFilter) => {
      if (!imageRef.current) return null;

      if (isAiMode) {
        return aiResultUrl
          ? renderOutputCanvas(imageRef.current, aiFilter, selectedRatio, combinedMaskRef.current, {
              useMask: false,
            })
          : renderBaseOutputCanvas(imageRef.current, selectedRatio);
      }

      return renderOutputCanvas(imageRef.current, currentFilter, selectedRatio, combinedMaskRef.current, {
        useMask: true,
      });
    },
    [imageRef, selectedRatio],
  );

  const renderAiDownloadCanvas = useCallback(
    (aiFilter) => {
      if (!imageRef.current) return null;
      return renderOutputCanvas(imageRef.current, aiFilter, selectedRatio, combinedMaskRef.current, {
        useMask: false,
      });
    },
    [imageRef, selectedRatio],
  );

  const renderNormalFilterCanvas = useCallback(
    (filter) => {
      if (!imageRef.current) return null;
      return renderOutputCanvas(imageRef.current, filter, selectedRatio, combinedMaskRef.current, {
        useMask: true,
      });
    },
    [imageRef, selectedRatio],
  );

  const renderImageUrlCanvas = useCallback(
    (sourceUrl) =>
      new Promise((resolve, reject) => {
        if (!sourceUrl) {
          resolve(null);
          return;
        }
        const image = new Image();
        image.onload = () => resolve(renderBaseOutputCanvas(image, selectedRatio));
        image.onerror = () => reject(new Error("Nao foi possivel preparar a imagem para IA."));
        image.src = sourceUrl;
      }),
    [selectedRatio],
  );

  const getAiInputCanvas = useCallback(() => {
    if (!imageRef.current) return null;
    return renderBaseOutputCanvas(imageRef.current, selectedRatio);
  }, [imageRef, selectedRatio]);

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
    schedulePreviewRender,
    imageRef,
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
  }, [intensity, adjustments, selectedRatio, loadState, maskVersion, scheduleThumbnailBuild]);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return undefined;

    const updatePreviewBox = () => {
      const width = Math.round(element.clientWidth);
      const height = Math.round(element.clientHeight);
      setPreviewBox((current) =>
        current.width === width && current.height === height ? current : { width, height },
      );
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
  }, [canvasSize.width, canvasSize.height, imageUrl, selectedRatio.id, loadState, centerCanvasView]);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element || loadState !== "ready") return undefined;
    const onWheel = (event) => handleCanvasWheel(event);
    element.addEventListener("wheel", onWheel, { passive: false });
    return () => element.removeEventListener("wheel", onWheel);
  }, [handleCanvasWheel, loadState]);

  return {
    photoCanvasRef,
    maskCanvasRef,
    scrollRef,
    zoom,
    setZoom,
    isPainting,
    isPanningCanvas,
    isShowingOriginal,
    setIsShowingOriginal,
    canvasSize,
    previewBox,
    filterThumbs,
    renderPreview,
    schedulePreviewRender,
    buildAutomaticMask,
    clearMask,
    resetMaskState,
    completeRecognitionStep,
    showOriginal,
    hideOriginal,
    handlePointerDown,
    handlePointerMove,
    stopPainting,
    handleStageCompareDown,
    startCanvasPan,
    blockMiddleMousePan,
    moveCanvasPan,
    stopCanvasPan,
    resetZoom,
    renderDownloadCanvas,
    renderAiDownloadCanvas,
    renderNormalFilterCanvas,
    renderImageUrlCanvas,
    getAiInputCanvas,
  };
}
