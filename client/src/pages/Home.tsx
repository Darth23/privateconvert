import { AudioVideoConverter } from '@/components/AudioVideoConverter';
import { DocumentConverter } from '@/components/DocumentConverter';
import { DragDropZone } from '@/components/DragDropZone';
import { ImageConverter } from '@/components/ImageConverter';
import { ModuleNav, ModuleType } from '@/components/ModuleNav';
import { VideoDownloader } from '@/components/VideoDownloader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useState } from 'react';
import { toast } from 'sonner';

/**
 * PrivaConvert Home Page
 * 
 * Design: Minimalismo Funcional Moderno
 * - Sidebar navigation (ModuleNav) for module selection
 * - Main content area with drag-drop zone
 * - Tab-based interface for different conversion modules
 */
export default function Home() {
  const [activeModule, setActiveModule] = useState<ModuleType>('images');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  const handleFilesSelected = (files: File[]) => {
    setSelectedFiles(files);
    toast.success(`${files.length} archivo(s) seleccionado(s)`);
  };

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar Navigation */}
      <ModuleNav activeModule={activeModule} onModuleChange={setActiveModule} />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="border-b border-border bg-card px-8 py-6">
          <h2 className="text-3xl font-bold text-foreground">
            {activeModule === 'images' && 'Convertir Imágenes'}
            {activeModule === 'audio' && 'Convertir Audio/Video'}
            {activeModule === 'documents' && 'Crear Documentos'}
            {activeModule === 'downloader' && 'Descargar Videos'}
          </h2>
          <p className="text-muted-foreground mt-2">
            {activeModule === 'images' && 'Convierte, comprime y optimiza tus imágenes de forma privada'}
            {activeModule === 'audio' && 'Convierte archivos de audio y video sin perder calidad'}
            {activeModule === 'documents' && 'Combina imágenes en PDFs y optimiza documentos'}
            {activeModule === 'downloader' && 'Descarga videos de YouTube, Facebook, Instagram, TikTok y más'}
          </p>
        </header>

        {/* Content Tabs */}
        <div className="flex-1 overflow-auto p-8">
          <Tabs value={activeModule} onValueChange={(v) => setActiveModule(v as ModuleType)}>
            {/* Images Module */}
            <TabsContent value="images" className="space-y-6">
              {selectedFiles.length === 0 ? (
                <DragDropZone
                  onFilesSelected={handleFilesSelected}
                  accept="image/*"
                  multiple={true}
                />
              ) : (
                <ImageConverter
                  files={selectedFiles}
                  onClear={() => setSelectedFiles([])}
                />
              )}
            </TabsContent>

            {/* Audio/Video Module */}
            <TabsContent value="audio" className="space-y-6">
              {selectedFiles.length === 0 ? (
                <DragDropZone
                  onFilesSelected={handleFilesSelected}
                  accept="audio/*,video/*"
                  multiple={true}
                />
              ) : (
                <AudioVideoConverter
                  files={selectedFiles}
                  onClear={() => setSelectedFiles([])}
                />
              )}
            </TabsContent>

            {/* Documents Module */}
            <TabsContent value="documents" className="space-y-6">
              {selectedFiles.length === 0 ? (
                <DragDropZone
                  onFilesSelected={handleFilesSelected}
                  accept="image/*,.txt,.md,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  multiple={true}
                />
              ) : (
                <DocumentConverter
                  files={selectedFiles}
                  onClear={() => setSelectedFiles([])}
                />
              )}
            </TabsContent>

            {/* Downloader Module */}
            <TabsContent value="downloader" className="space-y-6">
              <VideoDownloader />
            </TabsContent>
          </Tabs>

          {/* Selected Files List - Only show for audio/documents */}
          {selectedFiles.length > 0 && activeModule !== 'images' && (
            <div className="mt-8 bg-card rounded-lg border border-border p-6">
              <h3 className="font-semibold text-foreground mb-4">
                Archivos seleccionados ({selectedFiles.length})
              </h3>
              <ul className="space-y-2">
                {selectedFiles.map((file, idx) => (
                  <li key={idx} className="text-sm text-muted-foreground flex justify-between">
                    <span>{file.name}</span>
                    <span className="text-xs">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
