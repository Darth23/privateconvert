# PrivaConvert - Herramienta de Conversión de Archivos 100% Privada

**PrivaConvert** es una aplicación web moderna para conversión y optimización de archivos con enfoque total en privacidad. Todos los archivos se procesan **100% en el navegador del usuario** — nada se envía a servidores externos.

## 🎯 Características Principales

### 📸 Módulo de Imágenes
- **Conversiones:** PNG, JPEG, WebP
- **Compresión inteligente:** Slider de calidad (10-100%) con previsualización en tiempo real
- **Privacidad:** Eliminación automática de metadatos EXIF
- **Información:** Dimensiones, tamaño original y comprimido, ratio de compresión
- **Múltiples archivos:** Procesa varias imágenes simultáneamente

### 🎵 Módulo de Audio/Video
- **Conversiones de audio:** MP3, WAV, AAC
- **Conversiones de video:** MP4, WebM, MKV
- **Extracción de audio:** Extrae audio de archivos de video
- **Opciones avanzadas:**
  - Bitrate personalizado (128k, 192k, 320k para audio)
  - Resolución (480p, 720p, 1080p para video)
  - FPS personalizado
- **Procesamiento local:** FFmpeg.wasm compilado a WebAssembly

### 📄 Módulo de Documentos
- **Creación de PDF:** Combina múltiples imágenes en un PDF
- **Opciones de página:** A3, A4, Letter
- **Orientación:** Vertical u Horizontal
- **Control de calidad:** Ajusta la compresión de imágenes (50-100%)
- **Compresión:** Reduce el tamaño del PDF automáticamente

### 🌙 Características Adicionales
- **Dark Mode:** Interfaz clara en modo claro y oscuro
- **Drag & Drop:** Arrastra archivos directamente a la aplicación
- **Validación:** Límites de seguridad (200MB por archivo, 500MB total)
- **Advertencias:** Notificaciones de memoria disponible
- **Responsive:** Funciona perfectamente en desktop, tablet y móvil

## 🔒 Privacidad y Seguridad

### 100% Client-Side
- ✅ No hay servidores backend
- ✅ No se almacenan archivos en servidores
- ✅ No hay tracking de usuario
- ✅ Los datos se destruyen al cerrar la pestaña

### Seguridad
- ✅ Validación de entrada en cliente
- ✅ Límites de memoria para prevenir crashes
- ✅ Headers de seguridad COOP/COEP
- ✅ Eliminación automática de metadatos EXIF

## 🚀 Inicio Rápido

### Instalación Local

```bash
# Clonar repositorio
git clone <repository-url>
cd privaconvert

# Instalar dependencias
pnpm install

# Iniciar servidor de desarrollo
pnpm run dev

# Acceder a http://localhost:3000
```

### Build para Producción

```bash
# Crear build optimizado
pnpm run build

# Previsualizar build
pnpm run preview
```

## 📦 Despliegue

### Vercel (Recomendado)

```bash
# Instalar Vercel CLI
npm i -g vercel

# Desplegar
vercel
```

El archivo `vercel.json` incluye configuración automática de headers COOP/COEP.

### Netlify

```bash
# Instalar Netlify CLI
npm i -g netlify-cli

# Desplegar
netlify deploy --prod --dir=dist
```

El archivo `netlify.toml` incluye configuración automática.

### GitHub Pages

```bash
# Build
pnpm run build

# Desplegar con gh-pages
npm i -g gh-pages
gh-pages -d dist
```

## 🏗️ Arquitectura

### Stack Tecnológico
- **Frontend:** React 19 + TypeScript
- **Build:** Vite 7
- **Estilos:** TailwindCSS 4
- **Componentes:** shadcn/ui
- **Procesamiento de Imágenes:** Canvas API + browser-image-compression
- **Procesamiento de Audio/Video:** FFmpeg.wasm
- **Generación de PDF:** jsPDF

### Estructura de Carpetas

```
client/
  src/
    pages/          # Páginas principales
    components/     # Componentes React
    lib/            # Utilidades y lógica de negocio
    contexts/       # React Contexts
    hooks/          # Custom hooks
    types/          # Declaraciones de tipos
    index.css       # Estilos globales
  public/           # Assets estáticos
  index.html        # HTML principal
```

## 📊 Límites y Restricciones

| Límite | Valor |
|--------|-------|
| Tamaño máximo por archivo | 200 MB |
| Tamaño total máximo | 500 MB |
| Advertencia de memoria | 80% de heap utilizado |
| Timeout de conversión | Sin límite (depende del navegador) |

## 🔧 Configuración

### Headers de Seguridad

Los siguientes headers se configuran automáticamente en despliegue:

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
X-Content-Type-Options: nosniff
X-Frame-Options: SAMEORIGIN
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
```

### Variables de Entorno

No se requieren variables de entorno para desarrollo local. En producción, Manus inyecta automáticamente:

- `VITE_APP_ID` - ID de la aplicación
- `VITE_APP_TITLE` - Título de la aplicación
- `VITE_ANALYTICS_ENDPOINT` - Endpoint de analytics
- `VITE_ANALYTICS_WEBSITE_ID` - ID de website para analytics

## 🐛 Troubleshooting

### FFmpeg no carga
**Síntoma:** "Inicializando FFmpeg..." infinitamente

**Solución:**
1. Verifica que los headers COOP/COEP estén configurados
2. Comprueba la conexión a internet
3. Abre DevTools → Console para ver errores específicos

### Archivos muy grandes
**Síntoma:** "Memoria insuficiente"

**Solución:**
1. Cierra otras pestañas
2. Reinicia el navegador
3. Divide archivos en partes más pequeñas

### Conversión lenta
**Síntoma:** Procesamiento tarda más de lo esperado

**Solución:**
1. Reduce la calidad en opciones
2. Verifica que no haya otras aplicaciones usando CPU
3. Intenta en otro navegador

## 📈 Optimización de Rendimiento

### Compresión de Código
- Minificación automática con Vite
- Tree-shaking de dependencias no utilizadas
- Lazy loading de módulos

### Caché de Assets
```
Cache-Control: public, max-age=31536000, immutable
```

Los assets se cachean por 1 año en navegadores.

### Tamaño de Build
- HTML: ~367 KB (gzip: 105 KB)
- CSS: ~113 KB (gzip: 17 KB)
- JavaScript: ~1.5 MB (gzip: 333 KB)
- **Total:** ~1.6 MB de assets

## 🤝 Contribuir

Las contribuciones son bienvenidas. Por favor:

1. Fork el repositorio
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📝 Licencia

Este proyecto está bajo la licencia MIT. Ver `LICENSE` para más detalles.

## 📞 Soporte

Para reportar issues o sugerencias:

1. Abre una issue en GitHub
2. Incluye navegador, SO y pasos para reproducir
3. Adjunta logs de la consola si es relevante

## 🙏 Agradecimientos

- [React](https://react.dev/) - UI library
- [Vite](https://vitejs.dev/) - Build tool
- [TailwindCSS](https://tailwindcss.com/) - Utility-first CSS
- [shadcn/ui](https://ui.shadcn.com/) - Component library
- [FFmpeg.wasm](https://ffmpegwasm.netlify.app/) - FFmpeg in WebAssembly
- [jsPDF](https://github.com/parallax/jsPDF) - PDF generation

## 📅 Changelog

### v1.0.0 (2026-05-15)
- ✅ Módulo de imágenes con conversión y compresión
- ✅ Módulo de audio/video con FFmpeg.wasm
- ✅ Módulo de documentos con generación de PDF
- ✅ Dark mode
- ✅ Validación de archivos y límites de memoria
- ✅ Headers de seguridad COOP/COEP
- ✅ Configuración de despliegue (Vercel/Netlify)
