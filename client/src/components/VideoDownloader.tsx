import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Download, Loader2, Play, Search, Video, AlertCircle, Music, Film } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

interface VideoFormat {
  formatId: string;
  ext: string;
  resolution: string;
  height: number;
  filesize: number;
  vcodec: string;
  acodec: string;
  fps?: number;
  tbr?: number;
  label: string;
}

interface VideoInfo {
  title: string;
  thumbnail: string;
  duration: number;
  uploader: string;
  viewCount?: number;
  formats: VideoFormat[];
}

interface VideoDownloaderProps {
  onClear?: () => void;
}

const QUALITY_PRESETS = [
  { value: 'best', label: 'Mejor calidad disponible' },
  { value: '1080p', label: '1080p (Full HD)' },
  { value: '720p', label: '720p (HD)' },
  { value: '480p', label: '480p (SD)' },
  { value: '360p', label: '360p (Baja)' },
];

const DOWNLOAD_TYPES = [
  { value: 'combined', label: 'Video + Audio', icon: Film, description: 'Archivo completo con video y audio' },
  { value: 'video-only', label: 'Solo Video', icon: Video, description: 'Video sin audio' },
  { value: 'audio-only', label: 'Solo Audio', icon: Music, description: 'Audio extraído del video' },
];

export function VideoDownloader({ onClear }: VideoDownloaderProps) {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
  const [quality, setQuality] = useState('720p');
  const [downloadType, setDownloadType] = useState('combined');
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');

  const handleGetInfo = async () => {
    if (!url.trim()) {
      toast.error('Ingresa una URL válida');
      return;
    }

    setLoading(true);
    setError(null);
    setVideoInfo(null);

    try {
      const res = await fetch('/api/video/info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Error obteniendo información del video');
      }

      setVideoInfo(data);
      toast.success('Video encontrado');
    } catch (err: any) {
      setError(err.message);
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!videoInfo) return;

    setDownloading(true);
    setError(null);
    setProgress(0);
    setStatus('Iniciando descarga...');

    try {
      const res = await fetch('/api/video/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim(), quality, downloadType }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Error descargando');
      }

      const { downloadId } = await res.json();

      // Connect to SSE progress stream
      await new Promise<void>((resolve, reject) => {
        const eventSource = new EventSource(`/api/video/progress/${downloadId}`);
        let lastError = '';

        eventSource.onmessage = (event) => {
          const data = JSON.parse(event.data);
          setProgress(Math.round(data.progress));
          setStatus(data.status);

          if (data.error) {
            lastError = data.error;
          }

          if (data.status === 'completed') {
            eventSource.close();
            resolve();
          } else if (data.status === 'error') {
            eventSource.close();
            reject(new Error(data.error || 'Error en la descarga'));
          }
        };

        eventSource.onerror = () => {
          eventSource.close();
          // Check if we have a stored error from the last message
          if (lastError) {
            reject(new Error(lastError));
          } else {
            reject(new Error('Conexión perdida con el servidor'));
          }
        };

        // Timeout after 30 minutes
        setTimeout(() => {
          eventSource.close();
          reject(new Error('Tiempo de espera agotado'));
        }, 30 * 60 * 1000);
      });

      // Fetch the file
      setStatus('Preparando archivo...');
      setProgress(100);

      const fileRes = await fetch(`/api/video/file/${downloadId}`);
      if (!fileRes.ok) {
        const data = await fileRes.json();
        throw new Error(data.error || 'Error obteniendo el archivo');
      }

      const contentType = fileRes.headers.get('content-type') || '';
      const ext = contentType.includes('audio') ? (contentType.includes('mp4') ? 'm4a' : 'webm') : 'mp4';
      const safeTitle = videoInfo.title.replace(/[^a-zA-Z0-9áéíóúñÑÁÉÍÓÚ ]/g, '_').slice(0, 80);

      const blob = await fileRes.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `${safeTitle}.${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);

      const typeLabel = downloadType === 'audio-only' ? 'Audio' : 'Video';
      toast.success(`${typeLabel} descargado exitosamente`);
    } catch (err: any) {
      setError(err.message);
      toast.error(err.message);
    } finally {
      setDownloading(false);
      setProgress(0);
      setStatus('');
    }
  };

  const formatDuration = (seconds: number): string => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const formatViews = (views?: number): string => {
    if (!views) return '';
    if (views >= 1000000) return `${(views / 1000000).toFixed(1)}M vistas`;
    if (views >= 1000) return `${(views / 1000).toFixed(1)}K vistas`;
    return `${views} vistas`;
  };

  const getFormatTypeIcon = (format: VideoFormat) => {
    if (format.vcodec === 'none') return Music;
    if (format.acodec === 'none') return Video;
    return Film;
  };

  return (
    <div className="space-y-6">
      {/* URL Input */}
      <Card className="p-6">
        <h3 className="font-semibold text-foreground text-lg mb-4">Descargar Video</h3>
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Video className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=..."
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent"
              onKeyDown={(e) => e.key === 'Enter' && handleGetInfo()}
            />
          </div>
          <Button onClick={handleGetInfo} disabled={loading || !url.trim()}>
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Buscando...
              </>
            ) : (
              <>
                <Search className="w-4 h-4 mr-2" />
                Buscar
              </>
            )}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Soporta: YouTube, Facebook, Instagram, TikTok, Twitter/X, y más
        </p>
      </Card>

      {/* Error Display */}
      {error && (
        <Card className="p-4 bg-destructive/10 border-destructive">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-destructive">Error</p>
              <p className="text-sm text-destructive/80 mt-1">{error}</p>
            </div>
          </div>
        </Card>
      )}

      {/* Loading State */}
      {loading && (
        <Card className="p-8 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-accent" />
          <p className="text-muted-foreground">Obteniendo información del video...</p>
        </Card>
      )}

      {/* Video Info */}
      {videoInfo && (
        <>
          <Card className="p-4">
            <div className="flex gap-4">
              {videoInfo.thumbnail && (
                <div className="w-40 h-24 rounded-lg overflow-hidden flex-shrink-0 bg-muted">
                  <img
                    src={videoInfo.thumbnail}
                    alt={videoInfo.title}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-foreground truncate">{videoInfo.title}</h4>
                <div className="flex flex-wrap gap-3 mt-2 text-sm text-muted-foreground">
                  {videoInfo.uploader && (
                    <span className="flex items-center gap-1">
                      <Play className="w-3 h-3" />
                      {videoInfo.uploader}
                    </span>
                  )}
                  {videoInfo.duration > 0 && (
                    <span>{formatDuration(videoInfo.duration)}</span>
                  )}
                  {videoInfo.viewCount && (
                    <span>{formatViews(videoInfo.viewCount)}</span>
                  )}
                </div>
              </div>
            </div>
          </Card>

          {/* Download Options */}
          <Card className="p-6 space-y-4">
            <h3 className="font-semibold text-foreground text-lg">Opciones de Descarga</h3>

            {/* Download Type Selection */}
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">
                Tipo de descarga
              </label>
              <div className="grid grid-cols-3 gap-2">
                {DOWNLOAD_TYPES.map((type) => {
                  const Icon = type.icon;
                  const isActive = downloadType === type.value;
                  return (
                    <button
                      key={type.value}
                      onClick={() => setDownloadType(type.value)}
                      className={`p-3 rounded-lg border-2 text-center transition-all ${
                        isActive
                          ? 'border-accent bg-accent/10'
                          : 'border-border hover:border-muted-foreground/50'
                      }`}
                    >
                      <Icon className={`w-5 h-5 mx-auto mb-1 ${isActive ? 'text-accent' : 'text-muted-foreground'}`} />
                      <span className={`text-sm font-medium ${isActive ? 'text-accent' : 'text-foreground'}`}>
                        {type.label}
                      </span>
                      <span className="text-xs text-muted-foreground block mt-0.5">
                        {type.description}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Quality Selection (hidden for audio-only) */}
            {downloadType !== 'audio-only' && (
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">
                  Calidad
                </label>
                <Select value={quality} onValueChange={setQuality}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {QUALITY_PRESETS.map((preset) => (
                      <SelectItem key={preset.value} value={preset.value}>
                        {preset.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Available Formats */}
            {videoInfo.formats.length > 0 && (
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">
                  Formatos disponibles ({videoInfo.formats.length})
                </label>
                <div className="max-h-48 overflow-y-auto space-y-1 text-sm">
                  {videoInfo.formats.slice(0, 15).map((f) => {
                    const TypeIcon = getFormatTypeIcon(f);
                    const isVideoOnly = f.acodec === 'none' || f.acodec === null;
                    const isAudioOnly = f.vcodec === 'none' || f.vcodec === null;
                    const typeLabel = isAudioOnly ? 'Audio' : isVideoOnly ? 'Video' : 'Combinado';
                    return (
                      <div key={f.formatId} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-muted">
                        <div className="flex items-center gap-2">
                          <TypeIcon className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="text-foreground">{f.label}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                            {typeLabel}
                          </span>
                          <span className="text-muted-foreground text-xs">
                            {f.filesize ? `${(f.filesize / 1024 / 1024).toFixed(1)} MB` : ''}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Download Progress */}
            {downloading && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-foreground">{status}</span>
                  <span className="text-accent font-medium">{progress}%</span>
                </div>
                <Progress value={progress} className="h-2" />
              </div>
            )}

            <Button onClick={handleDownload} disabled={downloading} className="w-full">
              {downloading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {status}
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 mr-2" />
                  Descargar {downloadType === 'audio-only' ? 'Audio' : 'Video'}
                </>
              )}
            </Button>
          </Card>
        </>
      )}
    </div>
  );
}
