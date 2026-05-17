import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  convertAudio,
  convertVideo,
  extractAudio,
  initFFmpeg,
  isFFmpegLoaded,
  AudioConversionOptions,
  VideoConversionOptions,
} from '@/lib/ffmpegProcessor';
import { Download, Loader2, Music, Trash2, Video, X } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

interface MediaFile {
  file: File;
  type: 'audio' | 'video';
}

interface ConversionState {
  isInitializing: boolean;
  isConverting: boolean;
  conversionType: 'audio' | 'video' | 'extract';
  audioFormat: 'mp3' | 'wav' | 'aac';
  videoFormat: 'mp4' | 'webm' | 'mkv' | 'ts';
  audioOptions: AudioConversionOptions;
  videoOptions: VideoConversionOptions;
  progress: number;
  error: string | null;
  result?: {
    blob: Blob;
    originalSize: number;
    convertedSize: number;
  };
}

interface AudioVideoConverterProps {
  files: File[];
  onClear: () => void;
}

export function AudioVideoConverter({ files, onClear }: AudioVideoConverterProps) {
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [state, setState] = useState<ConversionState>({
    isInitializing: false,
    isConverting: false,
    conversionType: 'audio',
    audioFormat: 'mp3',
    videoFormat: 'mp4',
    audioOptions: { bitrate: '192k', sampleRate: 44100 },
    videoOptions: { resolution: '480p', bitrate: '1500k', fps: 30, fastMode: true },
    progress: 0,
    error: null,
  });

  // Initialize FFmpeg and categorize files
  useEffect(() => {
    const init = async () => {
      setState((s) => ({ ...s, isInitializing: true }));

      try {
        if (!isFFmpegLoaded()) {
          await Promise.race([
            initFFmpeg(),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error('FFmpeg tardó demasiado en cargar. Verifica tu conexión.')), 30000)
            ),
          ]);
        }

        const categorized: MediaFile[] = files.map((file) => ({
          file,
          type: file.type.startsWith('audio/') ? 'audio' : 'video',
        }));

        setMediaFiles(categorized);
        setSelectedIndex(0);

        if (categorized.length > 0) {
          setState((s) => ({
            ...s,
            conversionType: categorized[0].type === 'audio' ? 'audio' : 'extract',
          }));
        }

        toast.success('FFmpeg cargado correctamente');
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Error al cargar FFmpeg. Intenta recargar la página.');
        console.error('FFmpeg initialization error:', error);

        const categorized: MediaFile[] = files.map((file) => ({
          file,
          type: file.type.startsWith('audio/') ? 'audio' : 'video',
        }));
        setMediaFiles(categorized);
        setSelectedIndex(0);

        if (categorized.length > 0) {
          setState((s) => ({
            ...s,
            conversionType: categorized[0].type === 'audio' ? 'audio' : 'extract',
          }));
        }
      } finally {
        setState((s) => ({ ...s, isInitializing: false }));
      }
    };

    if (files.length > 0) {
      init();
    }
  }, [files]);

  const currentFile = mediaFiles[selectedIndex];
  const progressRef = useRef(0);

  const handleConvert = async () => {
    if (!currentFile) return;

    setState((s) => ({ ...s, isConverting: true, progress: 0, error: null }));
    progressRef.current = 0;

    try {
      let result: Blob;
      const originalSize = currentFile.file.size;

      const onProgress = (progress: number) => {
        const rounded = Math.round(progress);
        if (rounded - progressRef.current >= 2) {
          progressRef.current = rounded;
          setState((s) => ({ ...s, progress: rounded }));
        }
      };

      if (state.conversionType === 'audio' && currentFile.type === 'audio') {
        result = await convertAudio(currentFile.file, state.audioFormat, { ...state.audioOptions, onProgress });
      } else if (state.conversionType === 'extract' && currentFile.type === 'video') {
        result = await extractAudio(currentFile.file, state.audioFormat, { ...state.audioOptions, onProgress });
      } else if (state.conversionType === 'video' && currentFile.type === 'video') {
        result = await convertVideo(currentFile.file, state.videoFormat, { ...state.videoOptions, onProgress });
      } else {
        throw new Error('Tipo de conversión no válido');
      }

      setState((s) => ({
        ...s,
        isConverting: false,
        progress: 100,
        result: {
          blob: result,
          originalSize,
          convertedSize: result.size,
        },
      }));

      toast.success('Conversión completada exitosamente');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido en la conversión';
      console.error('Conversion error:', error);
      setState((s) => ({ ...s, isConverting: false, error: message }));
      toast.error(message);
    }
  };

  const handleDownload = () => {
    if (!state.result || !currentFile) return;

    const url = URL.createObjectURL(state.result.blob);
    const a = document.createElement('a');
    const nameWithoutExt = currentFile.file.name.split('.')[0];

    let extension: string = state.audioFormat;
    if (state.conversionType === 'video') {
      extension = state.videoFormat as string;
    }

    a.href = url;
    a.download = `${nameWithoutExt}.${extension}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast.success('Archivo descargado');
  };

  const handleRemoveFile = (index: number) => {
    const newFiles = mediaFiles.filter((_, i) => i !== index);
    setMediaFiles(newFiles);

    if (selectedIndex >= newFiles.length) {
      setSelectedIndex(Math.max(0, newFiles.length - 1));
    }

    if (newFiles.length === 0) {
      onClear();
    }
  };

  if (mediaFiles.length === 0) {
    return null;
  }

  if (state.isInitializing) {
    return (
      <Card className="p-8 text-center">
        <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-accent" />
        <p className="text-muted-foreground">Inicializando FFmpeg...</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* File Gallery */}
      <Card className="p-4">
        <div className="space-y-4">
          {/* File Info */}
          {currentFile && (
            <div className="bg-muted rounded-lg p-6">
              <div className="flex items-center gap-4">
                {currentFile.type === 'audio' ? (
                  <Music className="w-12 h-12 text-accent flex-shrink-0" />
                ) : (
                  <Video className="w-12 h-12 text-accent flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground truncate">{currentFile.file.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {(currentFile.file.size / 1024 / 1024).toFixed(2)} MB • {currentFile.type.toUpperCase()}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Thumbnail Gallery */}
          {mediaFiles.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-2">
              {mediaFiles.map((media, idx) => (
                <div key={idx} className="relative flex-shrink-0">
                  <button
                    onClick={() => setSelectedIndex(idx)}
                    className={`
                      flex items-center gap-2 px-4 py-2 rounded-lg border-2 transition-all
                      ${selectedIndex === idx ? 'border-accent bg-accent/10' : 'border-border'}
                    `}
                  >
                    {media.type === 'audio' ? (
                      <Music className="w-4 h-4" />
                    ) : (
                      <Video className="w-4 h-4" />
                    )}
                    <span className="text-sm truncate max-w-xs">{media.file.name}</span>
                  </button>
                  <button
                    onClick={() => handleRemoveFile(idx)}
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

        {/* Conversion Type Selection */}
        <div>
          <label className="text-sm font-medium text-foreground mb-3 block">
            Tipo de Conversión
          </label>
          <Tabs
            value={state.conversionType}
            onValueChange={(v) => setState((s) => ({ ...s, conversionType: v as any }))}
          >
            <TabsList className="grid w-full grid-cols-2">
              {currentFile?.type === 'audio' ? (
                <TabsTrigger value="audio">Convertir Audio</TabsTrigger>
              ) : (
                <>
                  <TabsTrigger value="extract">Extraer Audio</TabsTrigger>
                  <TabsTrigger value="video">Convertir Video</TabsTrigger>
                </>
              )}
            </TabsList>
          </Tabs>
        </div>

        {/* Audio Conversion Options */}
        {(state.conversionType === 'audio' || state.conversionType === 'extract') && (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">
                Formato de Salida
              </label>
              <Select value={state.audioFormat} onValueChange={(v) => setState((s) => ({ ...s, audioFormat: v as any }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mp3">MP3</SelectItem>
                  <SelectItem value="wav">WAV</SelectItem>
                  <SelectItem value="aac">AAC</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">
                Bitrate: {state.audioOptions.bitrate}
              </label>
              <Select
                value={state.audioOptions.bitrate || '192k'}
                onValueChange={(v) =>
                  setState((s) => ({
                    ...s,
                    audioOptions: { ...s.audioOptions, bitrate: v },
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="128k">128 kbps (Bajo)</SelectItem>
                  <SelectItem value="192k">192 kbps (Medio)</SelectItem>
                  <SelectItem value="320k">320 kbps (Alto)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {/* Video Conversion Options */}
        {state.conversionType === 'video' && (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">
                Formato de Salida
              </label>
              <Select value={state.videoFormat} onValueChange={(v) => setState((s) => ({ ...s, videoFormat: v as any }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mp4">MP4</SelectItem>
                  <SelectItem value="webm">WebM</SelectItem>
                  <SelectItem value="mkv">MKV</SelectItem>
                  <SelectItem value="ts">TS (MPEG-TS)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">
                Calidad de Video
              </label>
              <Select
                onValueChange={(v) => {
                  const presets: Record<string, { resolution: string; bitrate: string; fastMode: boolean }> = {
                    fast: { resolution: '480p', bitrate: '1000k', fastMode: true },
                    balanced: { resolution: '720p', bitrate: '2000k', fastMode: true },
                    quality: { resolution: '1080p', bitrate: '5000k', fastMode: false },
                  };
                  const preset = presets[v];
                  setState((s) => ({
                    ...s,
                    videoOptions: {
                      ...s.videoOptions,
                      resolution: preset.resolution as any,
                      bitrate: preset.bitrate,
                      fastMode: preset.fastMode,
                    },
                  }));
                }}
                defaultValue="fast"
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar calidad" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fast">Rápido (480p, archivo pequeño)</SelectItem>
                  <SelectItem value="balanced">Balanceado (720p)</SelectItem>
                  <SelectItem value="quality">Alta calidad (1080p, archivo grande)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">
                Resolución
              </label>
              <Select
                value={state.videoOptions.resolution || '480p'}
                onValueChange={(v) =>
                  setState((s) => ({
                    ...s,
                    videoOptions: { ...s.videoOptions, resolution: v as any },
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="480p">480p</SelectItem>
                  <SelectItem value="720p">720p</SelectItem>
                  <SelectItem value="1080p">1080p</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">
                Bitrate: {state.videoOptions.bitrate}
              </label>
              <Select
                value={state.videoOptions.bitrate || '1500k'}
                onValueChange={(v) =>
                  setState((s) => ({
                    ...s,
                    videoOptions: { ...s.videoOptions, bitrate: v },
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1000k">1000 kbps (Bajo)</SelectItem>
                  <SelectItem value="1500k">1500 kbps (Medio)</SelectItem>
                  <SelectItem value="2000k">2000 kbps (Alto)</SelectItem>
                  <SelectItem value="5000k">5000 kbps (Muy Alto)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="fastMode"
                checked={state.videoOptions.fastMode ?? true}
                onChange={(e) =>
                  setState((s) => ({
                    ...s,
                    videoOptions: { ...s.videoOptions, fastMode: e.target.checked },
                  }))
                }
                className="w-4 h-4 rounded cursor-pointer"
              />
              <label htmlFor="fastMode" className="text-sm font-medium text-foreground cursor-pointer">
                Modo rápido (3-5x más rápido, archivo más grande)
              </label>
            </div>
          </div>
        )}

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
                <p className="text-muted-foreground">Tamaño Convertido</p>
                <p className="font-medium">
                  {(state.result.convertedSize / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Error Display */}
        {state.error && (
          <div className="bg-destructive/10 border border-destructive rounded-lg p-4 space-y-2">
            <p className="text-sm font-medium text-destructive">Error de Conversión</p>
            <p className="text-sm text-destructive/80">{state.error}</p>
          </div>
        )}

        {/* Conversion Progress */}
        {state.isConverting && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Progreso</span>
              <span className="font-medium">{state.progress.toFixed(0)}%</span>
            </div>
            <Progress value={state.progress} className="h-2" />
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
              'Convertir'
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
