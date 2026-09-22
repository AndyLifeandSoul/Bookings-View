"use client";

import { useState, type ReactNode } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { restrictToParentElement, restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";

/**
 * Reusable drag-to-reorder list, so ordering things (booking types, tables,
 * menu items) is done by dragging rows rather than typing sort numbers,
 * matching how DMN works and killing the biggest "clunky" complaint. Each
 * item carries its id and its already-rendered row content; this adds the
 * drag handle and, on drop, optimistically reorders and calls `reorder`
 * with the new id order to persist it. `reorder` is a server action.
 */
export interface SortableItem {
  id: string;
  content: ReactNode;
}

function Row({ id, content }: SortableItem) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : undefined,
    position: "relative" as const,
    opacity: isDragging ? 0.9 : 1,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-stretch border-b border-zinc-50 bg-white last:border-0 ${isDragging ? "[box-shadow:var(--shadow-md)]" : ""}`}
    >
      <button
        type="button"
        className="flex w-9 shrink-0 cursor-grab touch-none items-center justify-center text-zinc-300 transition-colors hover:text-zinc-500 active:cursor-grabbing"
        aria-label="Drag to reorder"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" strokeWidth={2} />
      </button>
      <div className="min-w-0 flex-1">{content}</div>
    </div>
  );
}

export function SortableList({
  items,
  reorder,
}: {
  items: SortableItem[];
  /** Persists the new order. Called with the full ordered list of ids after each drop. */
  reorder: (orderedIds: string[]) => Promise<void>;
}) {
  const [order, setOrder] = useState(items);
  // Reset local order when the server sends a fresh list (add/delete/edit).
  // React's "adjust state on prop change during render" pattern, rather than
  // an effect: `items` is a stable reference between the parent's renders,
  // so this only fires when the server actually sends new data, and converges.
  const [seenItems, setSeenItems] = useState(items);
  if (seenItems !== items) {
    setSeenItems(items);
    setOrder(items);
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setOrder((current) => {
      const oldIndex = current.findIndex((i) => i.id === active.id);
      const newIndex = current.findIndex((i) => i.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return current;
      const next = arrayMove(current, oldIndex, newIndex);
      void reorder(next.map((i) => i.id));
      return next;
    });
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis, restrictToParentElement]}
      onDragEnd={onDragEnd}
    >
      <SortableContext items={order.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        <div>
          {order.map((item) => (
            <Row key={item.id} id={item.id} content={item.content} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
