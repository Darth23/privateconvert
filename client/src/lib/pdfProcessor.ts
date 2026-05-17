import jsPDF from 'jspdf';
import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';
import { marked } from 'marked';
import { validateDocumentType, withTimeout } from './validation';

pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

export interface PDFOptions {
  pageSize?: 'a4' | 'letter' | 'a3';
  orientation?: 'portrait' | 'landscape';
  quality?: number; // 0-100
  compression?: boolean;
}

export interface PDFResult {
  blob: Blob;
  originalSize: number;
  pdfSize: number;
  pageCount: number;
}

/**
 * Convert images to PDF
 */
export async function imagesToPDF(
  files: File[],
  options: PDFOptions = {}
): Promise<PDFResult> {
  const {
    pageSize = 'a4',
    orientation = 'portrait',
    quality = 85,
    compression = true,
  } = options;

  const pdf = new jsPDF({
    orientation,
    unit: 'mm',
    format: pageSize,
    compress: compression,
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  let isFirstPage = true;

  let totalOriginalSize = 0;

  try {
    for (const file of files) {
      totalOriginalSize += file.size;

      // Load image
      const imageData = await loadImage(file, quality);

      if (!isFirstPage) {
        pdf.addPage();
      }

      // Calculate dimensions to fit page
      const img = new Image();
      img.src = imageData;

      await new Promise<void>((resolve) => {
        img.onload = () => {
          const imgWidth = img.width;
          const imgHeight = img.height;
          const ratio = imgWidth / imgHeight;

          let width = pageWidth - 10;
          let height = width / ratio;

          if (height > pageHeight - 10) {
            height = pageHeight - 10;
            width = height * ratio;
          }

          const x = (pageWidth - width) / 2;
          const y = (pageHeight - height) / 2;

          pdf.addImage(imageData, 'JPEG', x, y, width, height);
          isFirstPage = false;
          resolve();
        };
      });
    }

    // Generate PDF blob
    const pdfBlob = pdf.output('blob');

    return {
      blob: pdfBlob,
      originalSize: totalOriginalSize,
      pdfSize: pdfBlob.size,
      pageCount: pdf.internal.pages.length - 1, // -1 because of internal structure
    };
  } catch (error) {
    throw new Error(`PDF creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Load and compress image
 */
async function loadImage(file: File, quality: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const canvas = document.createElement('canvas');
      const img = new Image();

      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }

        ctx.drawImage(img, 0, 0);

        // Convert to JPEG with quality
        const dataUrl = canvas.toDataURL('image/jpeg', quality / 100);
        resolve(dataUrl);
      };

      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = e.target?.result as string;
    };

    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/**
 * Optimize PDF by reducing image quality
 */
export async function optimizePDF(
  pdfFile: File,
  quality: number = 70
): Promise<PDFResult> {
  const mimeValidation = validateDocumentType(pdfFile);
  if (!mimeValidation.valid) {
    throw new Error(mimeValidation.error);
  }

  try {
    return await withTimeout((async () => {
    const info = await getPDFInfo(pdfFile);
    const arrayBuffer = await pdfFile.arrayBuffer();
    const pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true,
    });

    let isFirstPage = true;

    for (let i = 1; i <= pdfDoc.numPages; i++) {
      const page = await pdfDoc.getPage(i);
      const viewport = page.getViewport({ scale: 1.5 });

      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) continue;

      await page.render({ canvasContext: ctx as any, viewport, canvas }).promise;

      const imageData = canvas.toDataURL('image/jpeg', quality / 100);

      if (!isFirstPage) {
        pdf.addPage();
      }

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const ratio = viewport.width / viewport.height;

      let width = pageWidth - 10;
      let height = width / ratio;

      if (height > pageHeight - 10) {
        height = pageHeight - 10;
        width = height * ratio;
      }

      const x = (pageWidth - width) / 2;
      const y = (pageHeight - height) / 2;

      pdf.addImage(imageData, 'JPEG', x, y, width, height);
      isFirstPage = false;
    }

    const optimizedBlob = pdf.output('blob');

    return {
      blob: optimizedBlob,
      originalSize: pdfFile.size,
      pdfSize: optimizedBlob.size,
      pageCount: pdfDoc.numPages,
    };
    })());
  } catch (error) {
    throw new Error(`PDF optimization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get PDF info
 */
export async function getPDFInfo(file: File): Promise<{ pageCount: number; size: number }> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    return {
      pageCount: pdfDoc.numPages,
      size: file.size,
    };
  } catch (error) {
    console.error('Failed to get PDF info:', error);
    return { pageCount: 0, size: file.size };
  }
}

/**
 * Convert text file to PDF
 */
export async function textToPDF(
  file: File,
  options: PDFOptions = {}
): Promise<PDFResult> {
  const {
    pageSize = 'a4',
    orientation = 'portrait',
  } = options;

  const text = await file.text();

  const pdf = new jsPDF({
    orientation,
    unit: 'mm',
    format: pageSize,
    compress: true,
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 15;
  const maxWidth = pageWidth - margin * 2;
  const lineHeight = 7;
  const fontSize = 11;

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(fontSize);

  const lines = pdf.splitTextToSize(text, maxWidth);
  let y = margin;

  for (let i = 0; i < lines.length; i++) {
    if (y + lineHeight > pageHeight - margin) {
      pdf.addPage();
      y = margin;
    }
    pdf.text(lines[i], margin, y);
    y += lineHeight;
  }

  const pdfBlob = pdf.output('blob');

  return {
    blob: pdfBlob,
    originalSize: file.size,
    pdfSize: pdfBlob.size,
    pageCount: pdf.internal.pages.length - 1,
  };
}

/**
 * Convert DOCX file to PDF
 */
export async function docxToPDF(
  file: File,
  options: PDFOptions = {}
): Promise<PDFResult> {
  const {
    pageSize = 'a4',
    orientation = 'portrait',
  } = options;

  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.convertToHtml({ arrayBuffer });
  const html = result.value;

  const pdf = new jsPDF({
    orientation,
    unit: 'mm',
    format: pageSize,
    compress: true,
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 15;
  const maxWidth = pageWidth - margin * 2;
  const lineHeight = 7;
  const fontSize = 11;

  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;
  const textContent = tempDiv.textContent || tempDiv.innerText || '';

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(fontSize);

  const lines = pdf.splitTextToSize(textContent, maxWidth);
  let y = margin;

  for (let i = 0; i < lines.length; i++) {
    if (y + lineHeight > pageHeight - margin) {
      pdf.addPage();
      y = margin;
    }
    pdf.text(lines[i], margin, y);
    y += lineHeight;
  }

  const pdfBlob = pdf.output('blob');

  return {
    blob: pdfBlob,
    originalSize: file.size,
    pdfSize: pdfBlob.size,
    pageCount: pdf.internal.pages.length - 1,
  };
}

/**
 * Convert Markdown file to PDF
 */
export async function markdownToPDF(
  file: File,
  options: PDFOptions = {}
): Promise<PDFResult> {
  const {
    pageSize = 'a4',
    orientation = 'portrait',
  } = options;

  const markdown = await file.text();
  const html = marked.parse(markdown) as string;

  const pdf = new jsPDF({
    orientation,
    unit: 'mm',
    format: pageSize,
    compress: true,
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 15;
  const maxWidth = pageWidth - margin * 2;

  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;

  pdf.setFont('helvetica', 'normal');

  const processNode = (node: Node, y: number): number => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent || '';
      if (!text.trim()) return y;

      const lines = pdf.splitTextToSize(text, maxWidth);
      for (const line of lines) {
        if (y + 7 > pageHeight - margin) {
          pdf.addPage();
          y = margin;
        }
        pdf.text(line, margin, y);
        y += 7;
      }
      return y;
    }

    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      const tag = el.tagName.toLowerCase();

      if (tag === 'h1') {
        pdf.setFontSize(24);
        pdf.setFont('helvetica', 'bold');
        if (el.firstChild) y = processNode(el.firstChild, y);
        y += 4;
        pdf.setFontSize(11);
        pdf.setFont('helvetica', 'normal');
      } else if (tag === 'h2') {
        pdf.setFontSize(18);
        pdf.setFont('helvetica', 'bold');
        if (el.firstChild) y = processNode(el.firstChild, y);
        y += 3;
        pdf.setFontSize(11);
        pdf.setFont('helvetica', 'normal');
      } else if (tag === 'h3') {
        pdf.setFontSize(14);
        pdf.setFont('helvetica', 'bold');
        if (el.firstChild) y = processNode(el.firstChild, y);
        y += 2;
        pdf.setFontSize(11);
        pdf.setFont('helvetica', 'normal');
      } else if (tag === 'p') {
        if (el.firstChild) y = processNode(el.firstChild, y);
        y += 5;
      } else if (tag === 'li') {
        if (y + 7 > pageHeight - margin) {
          pdf.addPage();
          y = margin;
        }
        pdf.text('•', margin, y);
        if (el.firstChild) y = processNode(el.firstChild, y);
        y += 2;
      } else if (tag === 'ul' || tag === 'ol') {
        for (let i = 0; i < el.childNodes.length; i++) {
          y = processNode(el.childNodes[i], y);
        }
        y += 3;
      } else if (tag === 'code' || tag === 'pre') {
        pdf.setFont('courier', 'normal');
        if (el.firstChild) y = processNode(el.firstChild, y);
        pdf.setFont('helvetica', 'normal');
        y += 3;
      } else if (tag === 'blockquote') {
        pdf.setLineWidth(0.5);
        pdf.line(margin - 2, y, margin - 2, pageHeight - margin);
        if (el.firstChild) y = processNode(el.firstChild, y);
        y += 3;
      } else {
        for (let i = 0; i < el.childNodes.length; i++) {
          y = processNode(el.childNodes[i], y);
        }
      }
    }

    return y;
  };

  let y = margin;
  for (let i = 0; i < tempDiv.childNodes.length; i++) {
    y = processNode(tempDiv.childNodes[i], y);
  }

  const pdfBlob = pdf.output('blob');

  return {
    blob: pdfBlob,
    originalSize: file.size,
    pdfSize: pdfBlob.size,
    pageCount: pdf.internal.pages.length - 1,
  };
}
