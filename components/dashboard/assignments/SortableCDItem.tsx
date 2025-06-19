"use client";

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';

interface SortableCDItemProps {
  id: string;
  cd: string;
  index: number;
  isSelected: boolean;
  onSelect: () => void;
}

export default function SortableCDItem({ id, cd, index, isSelected, onSelect }: SortableCDItemProps) {
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
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`
        flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-all duration-200
        ${isDragging ? 'opacity-50 shadow-lg' : ''}
        ${isSelected 
          ? "border-[#3f8b31] bg-green-50 ring-2 ring-[#3f8b31]" 
          : "border-gray-300 hover:border-gray-400 hover:shadow-sm"
        }
      `}
      onClick={onSelect}
    >
      {/* Drag Handle */}
      <div
        {...attributes}
        {...listeners}
        className="flex items-center justify-center w-6 h-6 text-gray-400 hover:text-gray-600 cursor-grab active:cursor-grabbing"
      >
        <GripVertical className="w-4 h-4" />
      </div>

      {/* CD Number */}
      <div className="flex-shrink-0 w-8 h-8 bg-[#b3172c] text-white rounded-full flex items-center justify-center text-sm font-medium">
        {index + 1}
      </div>

      {/* CD Text */}
      <div className="flex-1 text-[#13161f]">
        {cd}
      </div>

      {/* Selection Indicator */}
      {isSelected && (
        <div className="flex-shrink-0 w-6 h-6 bg-[#3f8b31] text-white rounded-full flex items-center justify-center">
          ✓
        </div>
      )}
    </div>
  );
}
