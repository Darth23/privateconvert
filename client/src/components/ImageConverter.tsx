import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { convertImage, getImageDimensions, ImageFormat } from '@/lib/imageProcessor';
import { Download, Loader2, Trash2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

interface ImageFile {
  file: File;
  preview: string;
  width?: number;
  height?: number;
}

interface ConversionState {
  format: ImageFormat;
  quality: number;
  removeExif: boolean;
  isConverting: boolean;
  result?: {
    blob: Blob;
    originalSize: number;
    compressedSize: number;
    compressionRatio: number;
  };
}

interface ImageConverterProps {
  files: File[];
  onClear: () => void;
}

export function ImageConverter({ files, onClear }: ImageConverterProps) {
  const [imageFiles, setImageFiles] = useState<ImageFile[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [state, setState] = useState<ConversionState>({
    format: 'webp',
    quality: 80,
    removeExif: true,
    isConverting: false,
  });

  // Load image previews and dimensions
  useEffect(() => {
    const loadImages = async () => {
      const loaded: ImageFile[] = [];

      for (const file of files) {
        const preview = URL.createObjectURL(file);
        const dims = await getImageDimensions(file).catch(() => undefined);

        loaded.push({
          file,
          preview,
          width: dims?.width,
          height: dims?.height,
        });
      }

      setImageFiles(loaded);
      setSelectedIndex(0);
    };

    if (files.length > 0) {
      loadImages();
    }

    return () => {
      imageFiles.forEach((img) => URL.revokeObjectURL(img.preview));
    };
  }, [files]);

  const currentImage = imageFiles[selectedIndex];

  const handleConvert = async () => {
    if (!currentImage) return;

    setState((s) => ({ ...s, isConverting: true }));

    try {
      const result = await convertImage(currentImage.file, {
        format: state.format,
        quality: state.quality,
        removeExif: state.removeExif,
      });

      setState((s) => ({
        ...s,
        isConverting: false,
        result: {
          blob: result.blob,
          originalSize: result.originalSize,
          compressedSize: result.compressedSize,
          compressionRatio: result.compressionRatio,
        },
      }));

      toast.success('Imagen convertida exitosamente');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error en la conversión');
      setState((s) => ({ ...s, isConverting: false }));
    }
  };

  const handleDownload = () => {
    if (!state.result) return;

    const url = URL.createObjectURL(state.result.blob);
    const a = document.createElement('a');
    const nameWithoutExt = currentImage.file.name.split('.')[0];
    a.href = url;
    a.download = `${nameWithoutExt}.${state.format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast.success('Archivo descargado');
  };

  const handleRemoveImage = (index: number) => {
    const newImages = imageFiles.filter((_, i) => i !== index);
    setImageFiles(newImages);

    if (selectedIndex >= newImages.length) {
      setSelectedIndex(Math.max(0, newImages.length - 1));
    }

    if (newImages.length === 0) {
      onClear();
    }
  };

  if (imageFiles.length === 0) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Image Gallery */}
      <Card className="p-4">
        <div className="space-y-4">
          {/* Main Preview */}
          <div className="bg-muted rounded-lg overflow-hidden flex items-center justify-center h-96">
            {currentImage && (
              <img
                src={currentImage.preview}
                alt="Preview"
                className="max-w-full max-h-full object-contain"
              />
            )}
          </div>

          {/* Image Info */}
          {currentImage && (
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Nombre</p>
                <p className="font-medium text-foreground truncate">{currentImage.file.name}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Tamaño Original</p>
                <p className="font-medium text-foreground">
                  {(currentImage.file.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
              {currentImage.width && currentImage.height && (
                <>
                  <div>
                    <p className="text-muted-foreground">Dimensiones</p>
                    <p className="font-medium text-foreground">
                      {currentImage.width} × {currentImage.height}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Tipo</p>
                    <p className="font-medium text-foreground">{currentImage.file.type}</p>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Thumbnail Gallery */}
          {imageFiles.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-2">
              {imageFiles.map((img, idx) => (
                <div key={idx} className="relative flex-shrink-0">
                  <button
                    onClick={() => setSelectedIndex(idx)}
                    className={`
                      w-20 h-20 rounded-lg overflow-hidden border-2 transition-all
                      ${selectedIndex === idx ? 'border-accent' : 'border-border'}
                    `}
                  >
                    <img
                      src={img.preview}
                      alt={`Thumbnail ${idx}`}
                      className="w-full h-full object-cover"
                    />
                  </button>
                  <button
                    onClick={() => handleRemoveImage(idx)}
                    className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1 hover:bg-destructive/90"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      {/* Conversion Controls */}
      <Card className="p-6 space-y-6">
        <h3 className="font-semibold text-foreground text-lg">Opciones de Conversión</h3>

        {/* Format Selection */}
        <div>
          <label className="text-sm font-medium text-foreground mb-3 block">
            Formato de Salida
          </label>
          <Tabs value={state.format} onValueChange={(v) => setState((s) => ({ ...s, format: v as ImageFormat }))}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="jpeg">JPEG</TabsTrigger>
              <TabsTrigger value="png">PNG</TabsTrigger>
              <TabsTrigger value="webp">WebP</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Quality Slider */}
        <div>
          <label className="text-sm font-medium text-foreground mb-3 block">
            Calidad: {state.quality}%
          </label>
          <Slider
            value={[state.quality]}
            onValueChange={(v) => setState((s) => ({ ...s, quality: v[0] }))}
            min={10}
            max={100}
            step={5}
            className="w-full"
          />
          <p className="text-xs text-muted-foreground mt-2">
            Mayor calidad = archivo más grande
          </p>
        </div>

        {/* EXIF Removal */}
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="removeExif"
            checked={state.removeExif}
            onChange={(e) => setState((s) => ({ ...s, removeExif: e.target.checked }))}
            className="w-4 h-4 rounded cursor-pointer"
          />
          <label htmlFor="removeExif" className="text-sm font-medium text-foreground cursor-pointer">
            Eliminar metadatos EXIF (privacidad)
          </label>
        </div>

        {/* Conversion Result */}
        {state.result && (
          <div className="bg-accent/10 border border-accent rounded-lg p-4 space-y-2">
            <p className="text-sm font-medium text-foreground">Resultado de Conversión</p>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <p className="text-muted-foreground">Tamaño Original</p>
                <p className="font-medium">
                  {(state.result.originalSize / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Tamaño Comprimido</p>
                <p className="font-medium">
                  {(state.result.compressedSize / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
              <div className="col-span-2">
                <p className="text-muted-foreground">Compresión</p>
                <p className="font-medium text-accent">
                  {state.result.compressionRatio.toFixed(1)}% del tamaño original
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4">
          <Button
            onClick={handleConvert}
            disabled={state.isConverting}
            className="flex-1"
          >
            {state.isConverting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Convirtiendo...
              </>
            ) : (
              'Convertir Imagen'
            )}
          </Button>

          {state.result && (
            <Button
              onClick={handleDownload}
              variant="outline"
              className="flex-1"
            >
              <Download className="w-4 h-4 mr-2" />
              Descargar
            </Button>
          )}

          <Button
            onClick={onClear}
            variant="ghost"
            size="icon"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </Card>
    </div>
  );
}
