import { arrayMove } from "@dnd-kit/sortable";
import { PANEL_ORDER_STORAGE_KEY, SECTION_STORAGE_KEY } from "../config/constants";
import { sidebarPanelOrder } from "../data/editor-presets";

export function readCollapsedSections() {
  if (typeof window === "undefined") return {};
  try {
    const saved = window.localStorage.getItem(SECTION_STORAGE_KEY);
    return saved ? JSON.parse(saved) : {};
  } catch {
    return {};
  }
}

export function readSidebarPanelOrder() {
  if (typeof window === "undefined") return sidebarPanelOrder;
  try {
    const saved = window.localStorage.getItem(PANEL_ORDER_STORAGE_KEY);
    if (!saved) return sidebarPanelOrder;
    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed)) return sidebarPanelOrder;
    return mergeSidebarPanelOrder(parsed);
  } catch {
    return sidebarPanelOrder;
  }
}

export function mergeSidebarPanelOrder(savedOrder) {
  const knownIds = new Set(sidebarPanelOrder);
  const cleaned = savedOrder.filter((id) => knownIds.has(id));
  const missing = sidebarPanelOrder.filter((id) => !cleaned.includes(id));
  return [...cleaned, ...missing];
}

export function movePanelTo(order, movingPanelId, targetPanelId) {
  if (movingPanelId === targetPanelId) return order;
  const normalizedOrder = mergeSidebarPanelOrder(order);
  const movingIndex = normalizedOrder.indexOf(movingPanelId);
  const targetIndex = normalizedOrder.indexOf(targetPanelId);
  if (movingIndex < 0 || targetIndex < 0) return normalizedOrder;
  return arrayMove(normalizedOrder, movingIndex, targetIndex);
}

