import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { imagesToPDF, textToPDF, docxToPDF, markdownToPDF, PDFOptions, PDFResult } from '@/lib/pdfProcessor';
import { Download, FileText, Loader2, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';

interface DocumentFile {
  file: File;
  preview: string;
  type: 'image' | 'text' | 'docx' | 'markdown';
}

interface ConversionState {
  pageSize: 'a4' | 'letter' | 'a3';
  orientation: 'portrait' | 'landscape';
  quality: number;
  compression: boolean;
  isConverting: boolean;
  result?: PDFResult;
}

interface DocumentConverterProps {
  files: File[];
  onClear: () => void;
}

function detectFileType(file: File): 'image' | 'text' | 'docx' | 'markdown' {
  if (file.type.startsWith('image/')) return 'image';
  if (file.type === 'text/markdown' || file.name.endsWith('.md') || file.name.endsWith('.markdown')) return 'markdown';
  if (file.type === 'text/plain' || file.name.endsWith('.txt')) return 'text';
  if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || file.name.endsWith('.docx')) return 'docx';
  return 'image';
}

export function DocumentConverter({ files, onClear }: DocumentConverterProps) {
  const [docFiles, setDocFiles] = useState<DocumentFile[]>([]);
  const [conversionMode, setConversionMode] = useState<'auto' | 'images' | 'text' | 'docx' | 'markdown'>('auto');
  const [state, setState] = useState<ConversionState>({
    pageSize: 'a4',
    orientation: 'portrait',
    quality: 85,
    compression: true,
    isConverting: false,
  });

  React.useEffect(() => {
    const loaded: DocumentFile[] = files.map((file) => ({
      file,
      preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : '',
      type: detectFileType(file),
    }));

    setDocFiles(loaded);

    const hasImages = loaded.some((f) => f.type === 'image');
    const hasText = loaded.some((f) => f.type === 'text');
    const hasDocx = loaded.some((f) => f.type === 'docx');
    const hasMarkdown = loaded.some((f) => f.type === 'markdown');

    if (!hasImages && hasMarkdown) {
      setConversionMode('markdown');
    } else if (!hasImages && hasDocx) {
      setConversionMode('docx');
    } else if (!hasImages && hasText) {
      setConversionMode('text');
    } else {
      setConversionMode('auto');
    }
  }, [files]);

  const handleConvert = async () => {
    if (docFiles.length === 0) return;

    setState((s) => ({ ...s, isConverting: true }));

    try {
      const options: PDFOptions = {
        pageSize: state.pageSize,
        orientation: state.orientation,
        quality: state.quality,
        compression: state.compression,
      };

      let result: PDFResult;

      if (conversionMode === 'markdown' || (conversionMode === 'auto' && docFiles.every((f) => f.type === 'markdown'))) {
        result = await markdownToPDF(docFiles[0].file, options);
      } else if (conversionMode === 'docx' || (conversionMode === 'auto' && docFiles.every((f) => f.type === 'docx'))) {
        result = await docxToPDF(docFiles[0].file, options);
      } else if (conversionMode === 'text' || (conversionMode === 'auto' && docFiles.every((f) => f.type === 'text'))) {
        result = await textToPDF(docFiles[0].file, options);
      } else {
        result = await imagesToPDF(
          docFiles.map((d) => d.file),
          options
        );
      }

      setState((s) => ({
        ...s,
        isConverting: false,
        result,
      }));

      toast.success('Conversión completada exitosamente');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error en la conversión');
      setState((s) => ({ ...s, isConverting: false }));
    }
  };

  const handleDownload = () => {
    if (!state.result) return;

    const url = URL.createObjectURL(state.result.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `documento_${Date.now()}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast.success('PDF descargado');
  };

  const handleRemoveFile = (index: number) => {
    const newFiles = docFiles.filter((_, i) => i !== index);
    setDocFiles(newFiles);

    if (newFiles.length === 0) {
      onClear();
    }
  };

  if (docFiles.length === 0) {
    return null;
  }

  const hasImages = docFiles.some((f) => f.type === 'image');
  const hasText = docFiles.some((f) => f.type === 'text');
  const hasDocx = docFiles.some((f) => f.type === 'docx');
  const hasMarkdown = docFiles.some((f) => f.type === 'markdown');

  return (
    <div className="space-y-6">
      {/* File Gallery */}
      <Card className="p-4">
        <div className="space-y-4">
          <p className="text-sm font-medium text-foreground">
            {docFiles.length} archivo(s) seleccionado(s)
          </p>

          {/* Thumbnail Gallery */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-96 overflow-y-auto">
            {docFiles.map((doc, idx) => (
              <div key={idx} className="relative group">
                {doc.type === 'image' ? (
                  <>
                    <div className="bg-muted rounded-lg overflow-hidden aspect-square">
                      <img
                        src={doc.preview}
                        alt={`Page ${idx + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 text-center truncate">
                      {doc.file.name}
                    </p>
                  </>
                ) : (
                  <div className="bg-muted rounded-lg flex flex-col items-center justify-center aspect-square p-4">
                    <FileText className="w-10 h-10 text-muted-foreground mb-2" />
                    <p className="text-xs text-muted-foreground text-center truncate w-full">
                      {doc.file.name}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {doc.type === 'docx' ? 'Word' : doc.type === 'markdown' ? 'Markdown' : 'Texto'}
                    </p>
                  </div>
                )}
                <button
                  onClick={() => handleRemoveFile(idx)}
                  className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1 hover:bg-destructive/90 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Conversion Mode Selection */}
      {(hasImages || hasText || hasDocx || hasMarkdown) && (
        <Card className="p-6 space-y-6">
          <h3 className="font-semibold text-foreground text-lg">Modo de Conversión</h3>

          <Tabs value={conversionMode} onValueChange={(v) => setConversionMode(v as any)}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="auto" disabled={!hasImages}>
                Imágenes a PDF
              </TabsTrigger>
              <TabsTrigger value="text" disabled={!hasText}>
                Texto a PDF
              </TabsTrigger>
              <TabsTrigger value="docx" disabled={!hasDocx}>
                Word a PDF
              </TabsTrigger>
              <TabsTrigger value="markdown" disabled={!hasMarkdown}>
                Markdown a PDF
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </Card>
      )}

      {/* PDF Options */}
      <Card className="p-6 space-y-6">
        <h3 className="font-semibold text-foreground text-lg">Opciones de PDF</h3>

        {/* Page Size */}
        <div>
          <label className="text-sm font-medium text-foreground mb-2 block">
            Tamaño de Página
          </label>
          <Select value={state.pageSize} onValueChange={(v) => setState((s) => ({ ...s, pageSize: v as any }))}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="a3">A3</SelectItem>
              <SelectItem value="a4">A4</SelectItem>
              <SelectItem value="letter">Letter</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Orientation */}
        <div>
          <label className="text-sm font-medium text-foreground mb-2 block">
            Orientación
          </label>
          <Select
            value={state.orientation}
            onValueChange={(v) => setState((s) => ({ ...s, orientation: v as any }))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="portrait">Vertical</SelectItem>
              <SelectItem value="landscape">Horizontal</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Quality (images only) */}
        {conversionMode === 'auto' && (
          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">
              Calidad: {state.quality}%
            </label>
            <input
              type="range"
              min="50"
              max="100"
              step="5"
              value={state.quality}
              onChange={(e) => setState((s) => ({ ...s, quality: parseInt(e.target.value) }))}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground mt-2">
              Mayor calidad = archivo más grande
            </p>
          </div>
        )}

        {/* Compression */}
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="compression"
            checked={state.compression}
            onChange={(e) => setState((s) => ({ ...s, compression: e.target.checked }))}
            className="w-4 h-4 rounded cursor-pointer"
          />
          <label htmlFor="compression" className="text-sm font-medium text-foreground cursor-pointer">
            Comprimir PDF
          </label>
        </div>

        {/* Result */}
        {state.result && (
          <div className="bg-accent/10 border border-accent rounded-lg p-4 space-y-2">
            <p className="text-sm font-medium text-foreground">Resultado</p>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <p className="text-muted-foreground">Tamaño Original</p>
                <p className="font-medium">
                  {(state.result.originalSize / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Tamaño PDF</p>
                <p className="font-medium">
                  {(state.result.pdfSize / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
              <div className="col-span-2">
                <p className="text-muted-foreground">Páginas</p>
                <p className="font-medium text-accent">{state.result.pageCount} página(s)</p>
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
              'Convertir a PDF'
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
