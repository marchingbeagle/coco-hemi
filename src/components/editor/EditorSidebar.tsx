import React from "react";
import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";
import {
  Brush,
  Download,
  Eye,
  EyeOff,
  Instagram,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
  Upload,
  Wand2,
  ZoomIn,
} from "lucide-react";
import { ratios } from "../../data/editor-presets";
import { getAutoMaskLabel } from "../../lib/masks";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { AdjustmentControls, SliderRange } from "./AdjustmentControls";
import { CollapsiblePanel } from "./CollapsiblePanel";

export function EditorSidebar({
  fileInputRef,
  collapsedSections,
  dragCollapsedPanelId,
  visiblePanelOrder,
  filterMode,
  loadState,
  recognitionStepDone,
  autoMaskStatus,
  intensity,
  selectedRatio,
  selectedAiPreset,
  customAiPrompt,
  polaroidCaption,
  polaroidDate,
  aiBusy,
  aiError,
  aiResultUrl,
  aiHistory,
  zoom,
  adjustments,
  aiAdjustments,
  brushSize,
  showMaskOverlay,
  isAiMode,
  onToggleSection,
  onPanelDragStart,
  onPanelDragCancel,
  onPanelDragEnd,
  getPanelOrderValue,
  onFilterModeChange,
  onRatioChange,
  onIntensityChange,
  onCustomPromptChange,
  onRestorePrompt,
  onPolaroidCaptionChange,
  onPolaroidDateChange,
  onRunAiFilter,
  onDownloadAiResult,
  onLoadStoredAiImage,
  onDownloadStoredAiImage,
  onRemoveStoredAiImage,
  onRecalculateMask,
  onBrushSizeChange,
  onToggleMaskOverlay,
  onClearMask,
  onZoomChange,
  onAdjustmentsChange,
  onAiAdjustmentsChange,
  onDownloadPhoto,
  onReset,
  onRestoreOriginalImage,
  onUploadFiles,
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { delay: 80, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  return (
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
        onChange={(event) => event.target.files && onUploadFiles(event.target.files)}
      />

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={onPanelDragStart}
        onDragCancel={onPanelDragCancel}
        onDragEnd={onPanelDragEnd}
      >
        <SortableContext items={visiblePanelOrder} strategy={verticalListSortingStrategy}>
          <CollapsiblePanel
            id="filter-type"
            title="Tipo de filtro"
            icon={<SlidersHorizontal size={18} />}
            collapsedSections={collapsedSections}
            orderValue={getPanelOrderValue("filter-type")}
            forceCollapsed={dragCollapsedPanelId === "filter-type"}
            onToggle={onToggleSection}
          >
            <div className="mode-switch" aria-label="Selecionar tipo de filtro">
              <button
                className={filterMode === "normal" ? "mode-button active" : "mode-button"}
                onClick={() => onFilterModeChange("normal")}
              >
                Normais
              </button>
              <button
                className={filterMode === "ai" ? "mode-button active" : "mode-button"}
                onClick={() => onFilterModeChange("ai")}
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
            onToggle={onToggleSection}
          >
            <div className="ratio-grid">
              {ratios.map((ratio) => (
                <button
                  key={ratio.id}
                  className={ratio.id === selectedRatio.id ? "chip active" : "chip"}
                  onClick={() => onRatioChange(ratio)}
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
              onToggle={onToggleSection}
            >
              <SliderRange
                label="Filtro"
                value={intensity}
                min={0}
                max={1.5}
                step={0.01}
                onChange={onIntensityChange}
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
              onToggle={onToggleSection}
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
                  onChange={(event) => onCustomPromptChange(event.target.value)}
                />
              </label>
              <Button className="ghost-button full-width" variant="ghost" type="button" onClick={onRestorePrompt}>
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
                      onChange={(event) => onPolaroidCaptionChange(event.target.value)}
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
                      onChange={(event) => onPolaroidDateChange(event.target.value)}
                    />
                  </label>
                </div>
              ) : null}
              <Button
                className="primary-button full-width"
                onClick={onRunAiFilter}
                disabled={loadState !== "ready" || aiBusy}
              >
                <Sparkles size={18} />
                {aiBusy ? "Gerando com IA..." : "Aplicar filtro IA"}
              </Button>
              {aiError ? <p className="error-text">{aiError}</p> : null}
              {aiResultUrl ? (
                <div className="ai-current-result">
                  <p className="hint-text">
                    Resultado aplicado no preview principal. Pressione a foto para comparar com a original.
                  </p>
                  <Button className="ghost-button full-width" variant="ghost" onClick={onDownloadAiResult}>
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
                      <button className="ai-history-thumb" onClick={() => onLoadStoredAiImage(item)} type="button">
                        <img src={item.dataUrl} alt="" />
                      </button>
                      <div className="ai-history-info">
                        <strong>{item.presetName}</strong>
                        <small>{new Date(item.createdAt).toLocaleString("pt-BR")}</small>
                        <div className="ai-history-actions">
                          <Button
                            className="ghost-button"
                            variant="ghost"
                            size="sm"
                            onClick={() => onLoadStoredAiImage(item)}
                          >
                            Abrir
                          </Button>
                          <Button
                            className="ghost-button"
                            variant="ghost"
                            size="sm"
                            onClick={() => onDownloadStoredAiImage(item)}
                          >
                            Baixar
                          </Button>
                          <Button
                            className="ghost-button"
                            variant="ghost"
                            size="sm"
                            onClick={() => onRemoveStoredAiImage(item)}
                          >
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
              onToggle={onToggleSection}
            >
              <Button
                className="ghost-button full-width"
                variant="ghost"
                onClick={onRecalculateMask}
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
              onToggle={onToggleSection}
            >
              <SliderRange
                label="Pincel"
                value={brushSize}
                min={16}
                max={140}
                step={2}
                onChange={onBrushSizeChange}
              />
              <div className="button-row">
                <Button
                  className={showMaskOverlay ? "ghost-button toggle-on" : "ghost-button"}
                  variant="ghost"
                  onClick={onToggleMaskOverlay}
                  disabled={loadState !== "ready"}
                >
                  {showMaskOverlay ? <Eye size={18} /> : <EyeOff size={18} />}
                  Mascara
                </Button>
                <Button className="ghost-button" variant="ghost" onClick={onClearMask} disabled={loadState !== "ready"}>
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
            onToggle={onToggleSection}
          >
            <SliderRange
              label="Aproximar"
              value={zoom}
              min={1}
              max={3}
              step={0.05}
              onChange={onZoomChange}
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
              onToggle={onToggleSection}
              className="compact-adjustments"
            >
              <AdjustmentControls values={adjustments} onChange={onAdjustmentsChange} />
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
              onToggle={onToggleSection}
              className="compact-adjustments"
            >
              <AdjustmentControls values={aiAdjustments} onChange={onAiAdjustmentsChange} />
            </CollapsiblePanel>
          ) : null}
        </SortableContext>
      </DndContext>

      <div className="actions" style={{ order: 1000 }}>
        <Button className="primary-button" onClick={onDownloadPhoto} disabled={loadState !== "ready"}>
          <Download size={18} />
          Baixar PNG
        </Button>
      </div>

      <Button className="ghost-button full-width" style={{ order: 1001 }} variant="ghost" onClick={onReset}>
        <RotateCcw size={18} />
        Resetar edicao
      </Button>

      <Button
        className="ghost-button full-width"
        style={{ order: 1002 }}
        variant="ghost"
        onClick={onRestoreOriginalImage}
        disabled={loadState !== "ready"}
      >
        <EyeOff size={18} />
        Remover filtro atual
      </Button>
    </aside>
  );
}
