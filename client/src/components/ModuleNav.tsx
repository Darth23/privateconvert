import { Image, Music, FileText, Moon, Sun, Download } from 'lucide-react';
import React from 'react';
import { useTheme } from '@/contexts/ThemeContext';

export type ModuleType = 'images' | 'audio' | 'documents' | 'downloader';

const modules = [
  {
    id: 'images' as ModuleType,
    label: 'Imágenes',
    icon: Image,
    description: 'Convertir y comprimir imágenes',
  },
  {
    id: 'audio' as ModuleType,
    label: 'Audio/Video',
    icon: Music,
    description: 'Convertir audio y video',
  },
  {
    id: 'documents' as ModuleType,
    label: 'Documentos',
    icon: FileText,
    description: 'Crear y optimizar PDFs',
  },
  {
    id: 'downloader' as ModuleType,
    label: 'Descargar',
    icon: Download,
    description: 'Descargar videos de la web',
  },
];

interface ModuleNavProps {
  activeModule: ModuleType;
  onModuleChange: (module: ModuleType) => void;
}

export function ModuleNav({ activeModule, onModuleChange }: ModuleNavProps) {
  const { resolvedTheme, toggleTheme } = useTheme();

  return (
    <nav className="flex flex-col gap-2 p-4 bg-card border-r border-border h-screen w-64 overflow-y-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">PrivaConvert</h1>
        <p className="text-xs text-muted-foreground mt-1">
          Conversión 100% privada en tu navegador
        </p>
      </div>

      {/* Module Buttons */}
      <div className="flex flex-col gap-2 flex-1">
        {modules.map((module) => {
          const Icon = module.icon;
          const isActive = activeModule === module.id;

          return (
            <button
              key={module.id}
              onClick={() => onModuleChange(module.id)}
              className={`
                flex items-start gap-3 p-3 rounded-lg transition-all duration-200
                ${isActive
                  ? 'bg-accent text-accent-foreground shadow-sm'
                  : 'text-foreground hover:bg-muted'
                }
              `}
            >
              <Icon className="w-5 h-5 mt-0.5 flex-shrink-0" />
              <div className="text-left">
                <p className="font-semibold text-sm">{module.label}</p>
                <p className={`text-xs ${isActive ? 'opacity-90' : 'text-muted-foreground'}`}>
                  {module.description}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Theme Toggle */}
      <div className="pt-4 border-t border-border">
        <button
          onClick={toggleTheme}
          className={`
            w-full flex items-center justify-center gap-2 p-3 rounded-lg
            transition-all duration-200 text-foreground hover:bg-muted
          `}
          title={`Cambiar a modo ${resolvedTheme === 'dark' ? 'claro' : 'oscuro'}`}
        >
          {resolvedTheme === 'dark' ? (
            <>
              <Sun className="w-4 h-4" />
              <span className="text-sm">Modo Claro</span>
            </>
          ) : (
            <>
              <Moon className="w-4 h-4" />
              <span className="text-sm">Modo Oscuro</span>
            </>
          )}
        </button>
      </div>

      {/* Footer Info */}
      <div className="pt-4 border-t border-border text-xs text-muted-foreground text-center">
        <p>Todos los archivos se procesan</p>
        <p>localmente en tu navegador</p>
      </div>
    </nav>
  );
}
