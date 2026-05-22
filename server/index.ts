import express from "express";
import { createServer } from "http";
import path from "path";
import { fileURLToPath } from "url";
import { spawn, spawnSync } from "child_process";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEMP_DIR = path.join(__dirname, "..", "temp-downloads");
const activeDownloads = new Map<string, { progress: number; status: string; filePath?: string; error?: string }>();

function ensureTempDir() {
  if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
  }
}

function findYtdlp(): string {
  const candidates = ["yt-dlp", "yt-dlp.exe"];
  for (const cmd of candidates) {
    try {
      const proc = spawnSync(cmd, ["--version"]);
      if (proc.status === 0) return cmd;
    } catch {}
  }
  throw new Error("yt-dlp no encontrado. Instalar: pip install yt-dlp");
}

function findFfmpeg(): string | null {
  const candidates = ["ffmpeg", "ffmpeg.exe"];

  for (const cmd of candidates) {
    try {
      const proc = spawnSync(cmd, ["-version"]);
      if (proc.status === 0) return cmd;
    } catch {}
  }

  const home = process.env.USERPROFILE || process.env.HOME || "";
  const localAppData = process.env.LOCALAPPDATA || "";
  const programFiles = process.env.ProgramFiles || "";
  const programFilesX86 = process.env["ProgramFiles(x86)"] || "";
  const programData = process.env.ProgramData || "";

  const winPaths = [
    `${home}\\AppData\\Local\\Microsoft\\WinGet\\Links\\ffmpeg.exe`,
    `${localAppData}\\ffmpeg\\bin\\ffmpeg.exe`,
    `${programFiles}\\ffmpeg\\bin\\ffmpeg.exe`,
    `${programFiles}\\FFmpeg\\bin\\ffmpeg.exe`,
    `${programFilesX86}\\ffmpeg\\bin\\ffmpeg.exe`,
    `${programFilesX86}\\FFmpeg\\bin\\ffmpeg.exe`,
    `${programData}\\chocolatey\\bin\\ffmpeg.exe`,
    `${programData}\\ffmpeg\\bin\\ffmpeg.exe`,
    "C:\\ffmpeg\\bin\\ffmpeg.exe",
  ];

  for (const p of winPaths) {
    if (!p) continue;
    try {
      const proc = spawnSync(p, ["-version"]);
      if (proc.status === 0) return p;
    } catch {}
  }

  return null;
}

function parseProgress(stderr: string): number | null {
  const match = stderr.match(/\[download\]\s+(\d+\.?\d*)%/);
  if (match) return parseFloat(match[1]);

  const mergeMatch = stderr.match(/\[Merger\]/) || stderr.match(/\[ExtractAudio\]/) || stderr.match(/\[VideoConvertor\]/);
  if (mergeMatch) {
    const pctMatch = stderr.match(/(\d+\.?\d*)%/);
    if (pctMatch) return parseFloat(pctMatch[1]);
    return 95;
  }

  if (stderr.includes("[download] Destination:") || stderr.includes("[ffmpeg]")) {
    return 90;
  }

  return null;
}

async function startServer() {
  const app = express();
  const server = createServer(app);

  app.use(express.json({ limit: "10mb" }));

  const staticPath =
    process.env.NODE_ENV === "production"
      ? path.resolve(__dirname, "public")
      : path.resolve(__dirname, "..", "client", "public");

  app.use(express.static(staticPath));

  // API: Get video info from URL
  app.post("/api/video/info", async (req, res) => {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ error: "URL es requerida" });
    }

    try {
      const ytdlp = findYtdlp();
      const args = [
        "--dump-json",
        "--no-warnings",
        "--no-playlist",
        "--user-agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "--referer", "https://www.dailymotion.com/",
        "--force-ipv4",
        "--impersonate", "Chrome",
        "--extractor-args", "youtube:player_client=android,web",
      ];

      if (process.env.PROXY_URL) {
        args.push("--proxy", process.env.PROXY_URL);
      }
      if (process.env.COOKIES_FILE) {
        args.push("--cookies", process.env.COOKIES_FILE);
      }

      args.push(url);

      const proc = spawn(ytdlp, args);

      let stdout = "";
      let stderr = "";

      proc.stdout.on("data", (data) => (stdout += data.toString()));
      proc.stderr.on("data", (data) => (stderr += data.toString()));

      proc.on("close", (code) => {
        if (code !== 0) {
          const errText = stderr.slice(0, 500);
          let userError = "No se pudo obtener información del video. Verifica la URL.";

          if (errText.toLowerCase().includes("forbidden") || errText.toLowerCase().includes("access denied")) {
            userError = "El sitio está bloqueando el acceso automatizado. Intenta con otro video o plataforma.";
          } else if (errText.toLowerCase().includes("private") || errText.toLowerCase().includes("unavailable")) {
            userError = "El video es privado o no está disponible.";
          } else if (errText.toLowerCase().includes("sign in") || errText.toLowerCase().includes("login")) {
            userError = "El video requiere inicio de sesión.";
          }

          return res.status(400).json({
            error: userError,
            details: errText,
          });
        }

        try {
          const trimmed = stdout.trim();

          if (!trimmed) {
            console.error("yt-dlp produced empty stdout");
            console.error("stderr:", stderr.slice(0, 1000));
            return res.status(400).json({
              error: "No se pudo obtener información del video. Verifica la URL.",
              details: stderr.slice(0, 500) || "yt-dlp no produjo salida. Revisa los logs del servidor.",
            });
          }

          let info: any = null;
          const lines = trimmed.split("\n");

          for (const line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine) continue;
            try {
              const parsed = JSON.parse(trimmedLine);
              if (!info || (parsed.formats && parsed.formats.length > 0)) {
                info = parsed;
              }
            } catch {
              // Skip incomplete/malformed lines
            }
          }

          if (!info) {
            console.error("No valid JSON found in yt-dlp output");
            console.error("Raw stdout (first 1000 chars):", stdout.slice(0, 1000));
            return res.status(500).json({
              error: "Error parseando información del video",
              details: "No se encontró información válida en la salida de yt-dlp",
            });
          }

          const formats = (info.formats || [])
            .filter((f: any) => f.vcodec !== "none" || f.acodec !== "none")
            .map((f: any) => ({
              formatId: f.format_id,
              ext: f.ext,
              resolution: f.resolution || "audio only",
              height: f.height || 0,
              filesize: f.filesize || 0,
              vcodec: f.vcodec,
              acodec: f.acodec,
              fps: f.fps,
              tbr: f.tbr,
              label: f.format_note || f.format || `${f.resolution || "audio"} (${f.ext})`,
            }))
            .sort((a: any, b: any) => b.height - a.height);

          res.json({
            title: info.title,
            thumbnail: info.thumbnail,
            duration: info.duration,
            uploader: info.uploader || info.channel,
            viewCount: info.view_count,
            formats,
          });
        } catch (parseError: any) {
          console.error("JSON parse error:", parseError.message);
          console.error("Raw stdout (first 1000 chars):", stdout.slice(0, 1000));
          console.error("Stderr (first 1000 chars):", stderr.slice(0, 1000));
          res.status(500).json({
            error: "Error parseando información del video",
            details: parseError.message,
            rawOutput: stdout.slice(0, 500),
          });
        }
      });

      proc.on("error", (err) => {
        res.status(500).json({ error: `Error ejecutando yt-dlp: ${err.message}` });
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // SSE: Progress stream for active downloads
  app.get("/api/video/progress/:id", (req, res) => {
    const downloadId = req.params.id;
    const dl = activeDownloads.get(downloadId);

    if (!dl) {
      return res.status(404).json({ error: "Descarga no encontrada" });
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    // Send initial state
    res.write(`data: ${JSON.stringify({ progress: dl.progress, status: dl.status })}\n\n`);

    const interval = setInterval(() => {
      const current = activeDownloads.get(downloadId);
      if (!current) {
        res.write(`data: ${JSON.stringify({ progress: 100, status: "error", error: "Descarga perdida" })}\n\n`);
        res.end();
        clearInterval(interval);
        return;
      }

      res.write(`data: ${JSON.stringify({ progress: current.progress, status: current.status, error: current.error })}\n\n`);

      if (current.status === "completed" || current.status === "error") {
        res.end();
        clearInterval(interval);
      }
    }, 500);

    res.on("close", () => {
      clearInterval(interval);
    });
  });

  // API: Get downloaded file
  app.get("/api/video/file/:id", (req, res) => {
    const downloadId = req.params.id;
    const dl = activeDownloads.get(downloadId);

    if (!dl || !dl.filePath) {
      return res.status(404).json({ error: "Archivo no disponible" });
    }

    if (!fs.existsSync(dl.filePath)) {
      return res.status(404).json({ error: "Archivo eliminado" });
    }

    const stat = fs.statSync(dl.filePath);
    const ext = path.extname(dl.filePath).toLowerCase();
    const contentTypeMap: Record<string, string> = {
      ".mp4": "video/mp4",
      ".webm": "video/webm",
      ".mkv": "video/x-matroska",
      ".m4a": "audio/mp4",
      ".ogg": "audio/ogg",
      ".opus": "audio/opus",
    };

    res.setHeader("Content-Disposition", `attachment; filename="video_${downloadId}${ext}"`);
    res.setHeader("Content-Length", stat.size);
    res.setHeader("Content-Type", contentTypeMap[ext] || "application/octet-stream");

    const fileStream = fs.createReadStream(dl.filePath);
    fileStream.pipe(res);
    fileStream.on("close", () => {
      setTimeout(() => {
        try { fs.unlinkSync(dl.filePath!); } catch {}
        activeDownloads.delete(downloadId);
      }, 30000);
    });
  });

  // API: Start download
  app.post("/api/video/download", async (req, res) => {
    const { url, formatId, quality, downloadType } = req.body;
    if (!url) {
      return res.status(400).json({ error: "URL es requerida" });
    }

    ensureTempDir();

    // Clean old temp files
    try {
      const oldFiles = fs.readdirSync(TEMP_DIR);
      for (const f of oldFiles) {
        try { fs.unlinkSync(path.join(TEMP_DIR, f)); } catch {}
      }
    } catch {}

    const downloadId = `dl_${Date.now()}`;
    activeDownloads.set(downloadId, { progress: 0, status: "starting" });

    const type = downloadType || "combined";

    const qualityMap: Record<string, string> = {
      best: "bestvideo[ext=mp4]+bestaudio[ext=m4a]/bestvideo+bestaudio/best[ext=mp4]/best",
      "1080p": "bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=1080]+bestaudio/best[height<=1080][ext=mp4]/best[height<=1080]",
      "720p": "bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=720]+bestaudio/best[height<=720][ext=mp4]/best[height<=720]",
      "480p": "bestvideo[height<=480][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=480]+bestaudio/best[height<=480][ext=mp4]/best[height<=480]",
      "360p": "bestvideo[height<=360][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=360]+bestaudio/best[height<=360][ext=mp4]/best[height<=360]",
    };

    let format: string;
    if (formatId) {
      // If a specific format is selected and it's video-only but user wants combined, append bestaudio
      if (type === "combined") {
        format = `${formatId}+bestaudio[ext=m4a]/bestaudio/best`;
      } else {
        format = formatId;
      }
    } else if (type === "audio-only") {
      format = "bestaudio[ext=m4a]/bestaudio/best";
    } else if (type === "video-only") {
      const q = quality || "720p";
      format = `bestvideo[height<=${q === "best" ? "9999" : q.replace("p", "")}]/best`;
    } else {
      format = qualityMap[quality || "720p"] || qualityMap.best;
    }

    const filename = `video_${downloadId}`;
    const outputPath = path.join(TEMP_DIR, filename);

    const ytdlp = findYtdlp();
    const ffmpegPath = findFfmpeg();

    const args = [
      "--format", format,
      "--no-playlist",
      "--no-warnings",
      "--newline",
      "--force-ipv4",
      "--impersonate", "Chrome",
      "--extractor-args", "youtube:player_client=android,web",
    ];

    if (process.env.PROXY_URL) {
      args.push("--proxy", process.env.PROXY_URL);
    }
    if (process.env.COOKIES_FILE) {
      args.push("--cookies", process.env.COOKIES_FILE);
    }

    if (ffmpegPath) {
      args.push("--ffmpeg-location", path.dirname(ffmpegPath));
      console.log(`[download ${downloadId}] Using FFmpeg: ${ffmpegPath}`);
    } else {
      console.warn(`[download ${downloadId}] FFmpeg not found — merge/conversion will fail`);
    }

    if (type === "combined") {
      args.push("--merge-output-format", "mp4");
    }

    if (type === "audio-only") {
      args.push("--extract-audio", "--audio-format", "m4a");
    }

    args.push("--output", `${outputPath}.%(ext)s`);
    args.push(url);

    const proc = spawn(ytdlp, args);

    let stderr = "";
    let lastProgress = 0;

    proc.stderr.on("data", (data) => {
      const text = data.toString();
      stderr += text;

      const progress = parseProgress(stderr);
      if (progress !== null && progress > lastProgress) {
        lastProgress = progress;
        const status = stderr.includes("[Merger]") || stderr.includes("[ffmpeg]")
          ? "Merging audio + video..."
          : stderr.includes("[download] Destination:")
            ? "Downloading..."
            : "Downloading...";
        activeDownloads.set(downloadId, { progress, status, filePath: undefined });
      }
    });

    proc.on("close", (code) => {
      console.log(`[download ${downloadId}] yt-dlp exited with code ${code}`);
      console.log(`[download ${downloadId}] stderr (last 500):`, stderr.slice(-500));

      if (code !== 0) {
        console.error(`[download ${downloadId}] FAILED:`, stderr.slice(0, 500));
        activeDownloads.set(downloadId, { progress: 0, status: "error", error: stderr.slice(0, 500) });
        return;
      }

      const files = fs.readdirSync(TEMP_DIR).filter((f) => f.startsWith(filename));
      console.log(`[download ${downloadId}] Files found:`, files);

      if (files.length === 0) {
        activeDownloads.set(downloadId, { progress: 0, status: "error", error: "No se encontró el archivo" });
        return;
      }

      let videoFile: string;
      if (type === "audio-only") {
        videoFile = files.find((f) => f.endsWith(".m4a"))
          || files.find((f) => f.endsWith(".mp3"))
          || files.find((f) => f.endsWith(".mp4"))
          || files.find((f) => f.endsWith(".webm"))
          || files[0];
      } else if (type === "video-only") {
        videoFile = files.find((f) => f.endsWith(".mp4"))
          || files.find((f) => f.endsWith(".webm"))
          || files[0];
      } else {
        videoFile = files.find((f) => f.endsWith(".mp4"))
          || files.find((f) => f.endsWith(".mkv"))
          || files.find((f) => f.endsWith(".webm"))
          || files[0];
      }

      // Clean up other temp files
      for (const f of files) {
        if (f !== videoFile) {
          try { fs.unlinkSync(path.join(TEMP_DIR, f)); } catch {}
        }
      }

      const filePath = path.join(TEMP_DIR, videoFile);
      activeDownloads.set(downloadId, { progress: 100, status: "completed", filePath });
    });

    proc.on("error", (err) => {
      activeDownloads.set(downloadId, { progress: 0, status: "error", error: err.message });
    });

    res.json({ downloadId });
  });

  // Handle client-side routing - serve index.html for all routes
  app.get("*", (_req, res) => {
    res.sendFile(path.join(staticPath, "index.html"));
  });

  const port = process.env.PORT || (process.env.NODE_ENV === "production" ? 3000 : 3001);

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
    const ffmpeg = findFfmpeg();
    console.log(ffmpeg ? `FFmpeg found: ${ffmpeg}` : "FFmpeg not found (merge may fail)");
  });
}

startServer().catch(console.error);
