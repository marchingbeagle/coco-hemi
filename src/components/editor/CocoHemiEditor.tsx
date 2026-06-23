// @ts-nocheck
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AI_HISTORY_LIMIT,
  PANEL_ORDER_STORAGE_KEY,
  SECTION_STORAGE_KEY,
} from "../../config/constants";
import { aiPresets, defaultAdjustments, neutralPreset, presets, ratios, sidebarPanelOrder } from "../../data/editor-presets";
import { downloadCanvas, downloadDataUrl, readFileAsDataUrl } from "../../lib/file-downloads";
import { buildAiPrompt, getGeminiErrorMessage } from "../../lib/gemini";
import { mergeFilter } from "../../lib/image-processing";
import { createId, deleteStoredAiImage, getStoredAiImages, saveStoredAiImage } from "../../lib/ai-history";
import { mergeSidebarPanelOrder, movePanelTo, readCollapsedSections, readSidebarPanelOrder } from "../../lib/sidebar-state";
import { generateAiImage } from "../../services/gemini-client-service";
import { EditorSidebar } from "./EditorSidebar";
import { EditorWorkspace } from "./EditorWorkspace";
import { FilterSidebar } from "./FilterSidebar";
import { useEditorPreview } from "./useEditorPreview";

export function CocoHemiEditor() {
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
  const [brushSize, setBrushSize] = useState(52);
  const [showMaskOverlay, setShowMaskOverlay] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [loadState, setLoadState] = useState("idle");
  const [autoMaskStatus, setAutoMaskStatus] = useState("idle");
  const [recognitionStepOpen, setRecognitionStepOpen] = useState(false);
  const [recognitionStepDone, setRecognitionStepDone] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
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

  const imageRef = useRef(null);
  const originalImageRef = useRef(null);
  const fileInputRef = useRef(null);

  const currentFilter = useMemo(
    () => mergeFilter(selectedPreset.filter, adjustments, intensity),
    [selectedPreset, intensity, adjustments],
  );
  const isAiMode = filterMode === "ai";
  const aiFilter = useMemo(() => mergeFilter(neutralPreset, aiAdjustments, 1), [aiAdjustments]);
  const activeFilter = isAiMode ? aiFilter : currentFilter;
  const shouldUseLocalFilter = isAiMode ? Boolean(aiResultUrl) : true;

  const preview = useEditorPreview({
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
    recognitionStepDone,
    intensity,
    adjustments,
    brushSize,
    setAutoMaskStatus,
  });

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
      preview.resetMaskState();
      setLoadState("ready");
      setErrorMessage("");
      setRecognitionStepOpen(filterMode === "normal");
      setRecognitionStepDone(filterMode !== "normal");
      preview.renderPreview(image, activeFilter, selectedRatio, {
        useFilter: shouldUseLocalFilter,
        showOverlay: filterMode === "normal" && (showMaskOverlay || !recognitionStepDone),
      });
      if (filterMode === "normal") {
        setAutoMaskStatus("loading");
        preview.buildAutomaticMask(image, selectedRatio);
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
    preview.resetMaskState();
    setAiError("");
    setAiResultUrl("");
    setAiAdjustments(defaultAdjustments);
    setRecognitionStepOpen(filterMode === "normal");
    setRecognitionStepDone(filterMode !== "normal");
    preview.resetZoom();
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
    const canvas = preview.renderDownloadCanvas(isAiMode, aiResultUrl, aiFilter, currentFilter);
    if (!canvas) return;

    const suffix = isAiMode
      ? `${selectedAiPreset.id}-${selectedRatio.id}`
      : `${Math.round(intensity * 100)}-${selectedPreset.id}-${selectedRatio.id}`;
    downloadCanvas(canvas, `${imageName}-${suffix}.png`);
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

    setAiBusy(true);
    setAiError("");
    setAiResultUrl("");

    try {
      const prompt = buildAiPrompt(selectedAiPreset, {
        prompt: customAiPrompt,
        caption: polaroidCaption,
        date: polaroidDate,
      });
      const inputCanvas = preview.getAiInputCanvas();
      const { data, mimeType } = await generateAiImage(prompt, inputCanvas.toDataURL("image/png"));
      const resultUrl = `data:${mimeType};base64,${data}`;
      applyGeneratedImage(resultUrl, prompt);
    } catch (error) {
      setAiError(getGeminiErrorMessage(error));
    } finally {
      setAiBusy(false);
    }
  }

  function downloadAiResult() {
    if (!aiResultUrl || !imageRef.current) return;
    const canvas = preview.renderAiDownloadCanvas(aiFilter);
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
    preview.setZoom(1);
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
    preview.setIsShowingOriginal(false);
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
    preview.setZoom(1);
    setBrushSize(52);
    setShowMaskOverlay(true);
    preview.setIsShowingOriginal(false);
    setRecognitionStepOpen(false);
    setRecognitionStepDone(false);
    setAiError("");
    setAiResultUrl("");
    setCustomAiPrompt(aiPresets[0].prompt);
    setPolaroidCaption("");
    setPolaroidDate("");
    preview.clearMask();
  }

  function completeRecognitionStep() {
    setRecognitionStepOpen(false);
    setRecognitionStepDone(true);
    setShowMaskOverlay(false);
    preview.completeRecognitionStep();
  }

  function handleFilterModeChange(mode) {
    setFilterMode(mode);
    if (mode === "normal" && loadState === "ready" && !recognitionStepDone) {
      setRecognitionStepOpen(true);
    }
    if (mode === "ai") {
      setRecognitionStepOpen(false);
      setRecognitionStepDone(true);
    }
  }

  function handleRecalculateMask() {
    if (!imageRef.current) return;
    setAutoMaskStatus("loading");
    preview.buildAutomaticMask(imageRef.current, selectedRatio);
  }

  return (
    <main className="app">
      <section className="editor">
        <EditorSidebar
          fileInputRef={fileInputRef}
          collapsedSections={collapsedSections}
          dragCollapsedPanelId={dragCollapsedPanelId}
          visiblePanelOrder={visiblePanelOrder}
          filterMode={filterMode}
          loadState={loadState}
          recognitionStepDone={recognitionStepDone}
          autoMaskStatus={autoMaskStatus}
          intensity={intensity}
          selectedRatio={selectedRatio}
          selectedAiPreset={selectedAiPreset}
          customAiPrompt={customAiPrompt}
          polaroidCaption={polaroidCaption}
          polaroidDate={polaroidDate}
          aiBusy={aiBusy}
          aiError={aiError}
          aiResultUrl={aiResultUrl}
          aiHistory={aiHistory}
          zoom={preview.zoom}
          adjustments={adjustments}
          aiAdjustments={aiAdjustments}
          brushSize={brushSize}
          showMaskOverlay={showMaskOverlay}
          isAiMode={isAiMode}
          onToggleSection={toggleSection}
          onPanelDragStart={handlePanelDragStart}
          onPanelDragCancel={handlePanelDragCancel}
          onPanelDragEnd={handlePanelDragEnd}
          getPanelOrderValue={getPanelOrderValue}
          onFilterModeChange={handleFilterModeChange}
          onRatioChange={setSelectedRatio}
          onIntensityChange={setIntensity}
          onCustomPromptChange={setCustomAiPrompt}
          onRestorePrompt={() => setCustomAiPrompt(selectedAiPreset.prompt)}
          onPolaroidCaptionChange={setPolaroidCaption}
          onPolaroidDateChange={setPolaroidDate}
          onRunAiFilter={runAiFilter}
          onDownloadAiResult={downloadAiResult}
          onLoadStoredAiImage={loadStoredAiImage}
          onDownloadStoredAiImage={downloadStoredAiImage}
          onRemoveStoredAiImage={removeStoredAiImage}
          onRecalculateMask={handleRecalculateMask}
          onBrushSizeChange={setBrushSize}
          onToggleMaskOverlay={() => setShowMaskOverlay((value) => !value)}
          onClearMask={preview.clearMask}
          onZoomChange={preview.setZoom}
          onAdjustmentsChange={setAdjustments}
          onAiAdjustmentsChange={setAiAdjustments}
          onDownloadPhoto={downloadPhoto}
          onReset={reset}
          onRestoreOriginalImage={restoreOriginalImage}
          onUploadFiles={handleFiles}
        />

        <EditorWorkspace
          loadState={loadState}
          errorMessage={errorMessage}
          isDragging={isDragging}
          isPanningCanvas={preview.isPanningCanvas}
          isShowingOriginal={preview.isShowingOriginal}
          recognitionStepOpen={recognitionStepOpen}
          isAiMode={isAiMode}
          isPainting={preview.isPainting}
          autoMaskStatus={autoMaskStatus}
          canvasSize={preview.canvasSize}
          previewBox={preview.previewBox}
          zoom={preview.zoom}
          scrollRef={preview.scrollRef}
          photoCanvasRef={preview.photoCanvasRef}
          maskCanvasRef={preview.maskCanvasRef}
          fileInputRef={fileInputRef}
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
          onStartCanvasPan={preview.startCanvasPan}
          onMoveCanvasPan={preview.moveCanvasPan}
          onStopCanvasPan={preview.stopCanvasPan}
          onStageCompareDown={(event) => preview.handleStageCompareDown(event, originalImageRef)}
          onHideOriginal={preview.hideOriginal}
          onPointerDown={preview.handlePointerDown}
          onPointerMove={preview.handlePointerMove}
          onStopPainting={preview.stopPainting}
          onRecalculateMask={handleRecalculateMask}
          onCompleteRecognitionStep={completeRecognitionStep}
        />

        <FilterSidebar
          isAiMode={isAiMode}
          selectedPreset={selectedPreset}
          setSelectedPreset={setSelectedPreset}
          filterThumbs={preview.filterThumbs}
          selectedAiPreset={selectedAiPreset}
          setSelectedAiPreset={setSelectedAiPreset}
          setCustomAiPrompt={setCustomAiPrompt}
          setAiError={setAiError}
          setAiResultUrl={setAiResultUrl}
        />
      </section>
    </main>
  );
}
