import { test, expect } from '@playwright/test';

test.describe('PrivaConvert Home Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('loads the home page with correct title', async ({ page }) => {
    await expect(page).toHaveTitle(/PrivaConvert/);
  });

  test('displays image converter module by default', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /Convertir Imágenes/ })).toBeVisible();
    await expect(page.getByText(/Convierte, comprime y optimiza tus imágenes/)).toBeVisible();
  });

  test('switches to audio/video module', async ({ page }) => {
    await page.getByRole('button', { name: /Audio/i }).click();
    await expect(page.getByRole('heading', { name: /Convertir Audio/ })).toBeVisible();
    await expect(page.getByText(/Convierte archivos de audio y video/)).toBeVisible();
  });

  test('switches to documents module', async ({ page }) => {
    await page.getByRole('button', { name: /Documento/i }).click();
    await expect(page.getByRole('heading', { name: /Crear Documentos/ })).toBeVisible();
    await expect(page.getByText(/Combina imágenes en PDFs/)).toBeVisible();
  });

  test('shows drag and drop zone', async ({ page }) => {
    await expect(page.getByText(/Arrastra y suelta archivos/i)).toBeVisible();
    await expect(page.getByText(/o haz clic para seleccionar/i)).toBeVisible();
  });
});
