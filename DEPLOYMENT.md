# PrivaConvert - Guía de Despliegue

PrivaConvert es una aplicación web 100% client-side para conversión y optimización de archivos. Todos los archivos se procesan localmente en el navegador del usuario, garantizando privacidad total.

## Requisitos Previos

- Node.js 18+ o superior
- pnpm 10.4.1+ (gestor de paquetes)

## Instalación Local

```bash
# Clonar el repositorio
git clone <repository-url>
cd privaconvert

# Instalar dependencias
pnpm install

# Iniciar servidor de desarrollo
pnpm run dev

# Acceder a http://localhost:3000
```

## Build para Producción

```bash
# Crear build optimizado
pnpm run build

# Previsualizar build de producción
pnpm run preview
```

## Despliegue en Vercel

### Opción 1: Desde CLI

```bash
# Instalar Vercel CLI
npm i -g vercel

# Desplegar
vercel
```

### Opción 2: Desde GitHub

1. Conectar repositorio a Vercel
2. Vercel detectará automáticamente `vercel.json`
3. El despliegue ocurrirá automáticamente en cada push

### Configuración Vercel

El archivo `vercel.json` incluye:
- Headers COOP/COEP para FFmpeg.wasm
- Headers de seguridad (X-Content-Type-Options, X-Frame-Options, etc.)
- Caché optimizado para assets

## Despliegue en Netlify

### Opción 1: Desde CLI

```bash
# Instalar Netlify CLI
npm i -g netlify-cli

# Desplegar
netlify deploy --prod --dir=dist
```

### Opción 2: Desde GitHub

1. Conectar repositorio a Netlify
2. Netlify detectará automáticamente `netlify.toml`
3. El despliegue ocurrirá automáticamente en cada push

### Configuración Netlify

El archivo `netlify.toml` incluye:
- Headers COOP/COEP para FFmpeg.wasm
- Headers de seguridad
- Redirecciones para SPA
- Caché optimizado

## Despliegue en GitHub Pages

```bash
# Crear build estático
pnpm run build

# Desplegar contenido de dist/ a GitHub Pages
# Opción 1: Usar gh-pages
npm i -g gh-pages
gh-pages -d dist

# Opción 2: Usar GitHub Actions (recomendado)
# Ver .github/workflows/deploy.yml
```

## Headers COOP/COEP - Explicación Importante

PrivaConvert utiliza FFmpeg.wasm para procesamiento de audio/video. Esto requiere `SharedArrayBuffer`, que necesita headers específicos de seguridad:

- **Cross-Origin-Opener-Policy: same-origin** - Aísla la ventana de otros contextos
- **Cross-Origin-Embedder-Policy: require-corp** - Requiere CORS explícito para recursos

Estos headers están configurados en:
- `vercel.json` para Vercel
- `netlify.toml` para Netlify

Si despliegas en otra plataforma, asegúrate de configurar estos headers.

## Límites de Memoria

PrivaConvert implementa límites de seguridad:

- **Tamaño máximo por archivo:** 200 MB
- **Tamaño total máximo:** 500 MB
- **Advertencia de memoria:** 80% de heap utilizado

Estos límites se validan antes de procesar archivos.

## Características de Privacidad

1. **100% Client-Side:** No hay servidores backend
2. **Sin Almacenamiento:** Los archivos se procesan en memoria volátil
3. **Limpieza Automática:** Los datos se destruyen al cerrar la pestaña
4. **Eliminación EXIF:** Metadatos removidos automáticamente en imágenes
5. **Sin Tracking:** No hay análisis de usuario

## Optimización de Rendimiento

### Compresión de Código

```bash
pnpm run build
# Genera dist/ con código minificado y optimizado
```

### Caché de Assets

Los assets estáticos se cachean por 1 año:
```
Cache-Control: public, max-age=31536000, immutable
```

### Lazy Loading

Los módulos se cargan bajo demanda:
- Imágenes: Canvas API nativa
- Audio/Video: FFmpeg.wasm (cargado al acceder al módulo)
- Documentos: jsPDF (cargado al acceder al módulo)

## Monitoreo y Debugging

### Logs del Navegador

Abre la consola del navegador (F12) para ver:
- Errores de FFmpeg
- Progreso de conversión
- Mensajes de inicialización

### Performance

Usa Chrome DevTools:
1. Abre DevTools (F12)
2. Pestaña "Performance"
3. Graba mientras procesas un archivo
4. Analiza el timeline

## Troubleshooting

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
3. Divide archivos grandes en partes

### Conversión lenta

**Síntoma:** Procesamiento tarda más de lo esperado

**Solución:**
1. Reduce la calidad en opciones
2. Verifica que no haya otras aplicaciones usando CPU
3. Intenta en otro navegador

## Seguridad

### Headers de Seguridad

```
X-Content-Type-Options: nosniff
X-Frame-Options: SAMEORIGIN
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
```

### Validación de Entrada

- Validación de tipo MIME
- Validación de tamaño de archivo
- Validación de memoria disponible

### Gestión de Datos

- No se almacenan archivos en servidor
- No se envían archivos a terceros
- Limpieza automática de memoria

## Soporte

Para reportar issues o sugerencias:
1. Abre una issue en GitHub
2. Incluye navegador, SO y pasos para reproducir
3. Adjunta logs de la consola si es relevante

## Licencia

MIT - Ver LICENSE.md para detalles
