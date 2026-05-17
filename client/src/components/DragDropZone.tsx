import { Upload } from 'lucide-react';
import React, { useRef, useState } from 'react';
import { validateFileSize, validateTotalSize } from '@/lib/memoryManager';
import { toast } from 'sonner';

interface DragDropZoneProps {
  onFilesSelected: (files: File[]) => void;
  accept?: string;
  multiple?: boolean;
  disabled?: boolean;
}

export function DragDropZone({
  onFilesSelected,
  accept = '*',
  multiple = true,
  disabled = false,
}: DragDropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (disabled) return;

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      // Validate file sizes
      const invalidFiles = files.filter((f) => !validateFileSize(f.size).valid);
      if (invalidFiles.length > 0) {
        toast.error('Algunos archivos son demasiado grandes');
        return;
      }

      const totalValidation = validateTotalSize(files);
      if (!totalValidation.valid) {
        toast.error(totalValidation.error);
        return;
      }

      onFilesSelected(files);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.currentTarget.files || []);
    if (files.length > 0) {
      // Validate file sizes
      const invalidFiles = files.filter((f) => !validateFileSize(f.size).valid);
      if (invalidFiles.length > 0) {
        toast.error('Algunos archivos son demasiado grandes');
        e.currentTarget.value = '';
        return;
      }

      const totalValidation = validateTotalSize(files);
      if (!totalValidation.valid) {
        toast.error(totalValidation.error);
        e.currentTarget.value = '';
        return;
      }

      onFilesSelected(files);
    }
    // Reset input so the same file can be selected again
    e.currentTarget.value = '';
  };

  const handleClick = () => {
    if (!disabled) {
      fileInputRef.current?.click();
    }
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleClick}
      className={`
        relative flex flex-col items-center justify-center gap-4 p-12 rounded-lg
        border-2 border-dashed transition-all duration-200 ease-out
        ${isDragging && !disabled
          ? 'border-accent bg-accent/5'
          : 'border-border bg-muted/30 hover:bg-muted/50'
        }
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
      `}
    >
      <Upload
        className={`w-12 h-12 transition-all duration-200 ${
          isDragging && !disabled ? 'text-accent scale-110' : 'text-muted-foreground'
        }`}
      />

      <div className="text-center">
        <p className="text-lg font-semibold text-foreground">
          {isDragging ? 'Suelta los archivos aquí' : 'Arrastra archivos aquí'}
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          o haz clic para seleccionar
        </p>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple={multiple}
        accept={accept}
        onChange={handleFileInput}
        className="hidden"
        disabled={disabled}
      />
    </div>
  );
}
