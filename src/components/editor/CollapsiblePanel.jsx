import React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronDown, GripVertical } from "lucide-react";

function CollapsiblePanel({
  id,
  title,
  icon,
  badge,
  collapsedSections,
  orderValue,
  forceCollapsed = false,
  onToggle,
  className = "",
  children,
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const isCollapsed = Boolean(collapsedSections[id]) || forceCollapsed;
  const panelStyle = {
    ...(Number.isFinite(orderValue) ? { order: orderValue } : {}),
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? undefined : transition,
  };

  return (
    <div
      ref={setNodeRef}
      className={`panel collapsible-panel ${isCollapsed ? "collapsed" : ""} ${forceCollapsed ? "drag-minimized" : ""} ${
        isDragging ? "dragging-panel" : ""
      } ${className}`}
      style={panelStyle}
    >
      <div className="panel-title panel-title-bar">
        <button className="panel-toggle" type="button" aria-expanded={!isCollapsed} onClick={() => onToggle(id)}>
          {icon}
          <span className="panel-title-text">{title}</span>
          {badge}
          <ChevronDown size={16} className="panel-chevron" />
        </button>
        <span
          className="panel-reorder"
          aria-label={`Arrastar ${title} para reordenar`}
          role="button"
          tabIndex={0}
          {...attributes}
          {...listeners}
        >
          <GripVertical size={15} aria-hidden="true" />
        </span>
      </div>
      <div className="panel-content" aria-hidden={isCollapsed}>
        {children}
      </div>
    </div>
  );
}

export { CollapsiblePanel };

