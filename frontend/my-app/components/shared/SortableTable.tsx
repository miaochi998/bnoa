'use client';

import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import { useState, useEffect } from 'react';

interface SortableRowProps<T> {
    id: string;
    item: T;
    children: (item: T, isDragging: boolean) => React.ReactNode;
}

export function SortableRow<T>({
    id,
    item,
    children,
}: SortableRowProps<T>) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 1000 : 'auto',
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className="flex items-center group"
        >
            <div
                {...attributes}
                {...listeners}
                className="cursor-grab active:cursor-grabbing p-2 text-gray-500 hover:text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => e.stopPropagation()}
            >
                <GripVertical className="w-4 h-4" />
            </div>
            <div className="flex-1" onClick={(e) => e.stopPropagation()}>
                {children(item, isDragging)}
            </div>
        </div>
    );
}

interface SortableTableProps<T> {
    items: T[];
    onItemsChange: (items: T[]) => void;
    onDragEnd?: () => void;
    getId: (item: T) => string;
    children: (item: T, isDragging: boolean) => React.ReactNode;
    className?: string;
    disabled?: boolean;
}

export function SortableTable<T>({
    items,
    onItemsChange,
    onDragEnd,
    getId,
    children,
    className = '',
    disabled = false,
}: SortableTableProps<T>) {
    const [localItems, setLocalItems] = useState(items);

    useEffect(() => {
        setLocalItems(items);
    }, [items]);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        }),
    );

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;

        if (over && active.id !== over.id) {
            const oldIndex = localItems.findIndex(
                (item) => getId(item) === active.id,
            );
            const newIndex = localItems.findIndex(
                (item) => getId(item) === over.id,
            );

            const newItems = arrayMove(localItems, oldIndex, newIndex);
            setLocalItems(newItems);
            onItemsChange(newItems);
            onDragEnd?.();
        }
    };

    if (disabled) {
        return <div className={className}>{items.map((item) => children(item, false))}</div>;
    }

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
        >
            <SortableContext
                items={localItems.map(getId)}
                strategy={verticalListSortingStrategy}
            >
                <div className={className}>
                    {localItems.map((item) => (
                        <SortableRow
                            key={getId(item)}
                            id={getId(item)}
                            item={item}
                        >
                            {children}
                        </SortableRow>
                    ))}
                </div>
            </SortableContext>
        </DndContext>
    );
}
