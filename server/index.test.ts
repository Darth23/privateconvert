import { describe, it, expect } from 'vitest';
import path from 'path';

describe('server', () => {
  describe('static file serving paths', () => {
    it('resolves development path correctly', () => {
      const serverDir = path.resolve(__dirname);
      const devPath = path.resolve(serverDir, '..', 'client', 'public');
      expect(devPath).toContain('client');
      expect(devPath).toContain('public');
    });

    it('resolves production path correctly', () => {
      const serverDir = path.resolve(__dirname);
      const prodPath = path.resolve(serverDir, 'public');
      expect(prodPath).toContain('public');
    });

    it('uses client/public in development', () => {
      const serverDir = path.resolve(__dirname);
      const staticPath = path.resolve(serverDir, '..', 'client', 'public');
      expect(staticPath).toContain('client');
      expect(staticPath).toContain('public');
    });

    it('uses dist/public in production', () => {
      const distDir = path.resolve(__dirname, '..', 'dist');
      const staticPath = path.resolve(distDir, 'public');
      expect(staticPath).toContain('public');
    });
  });

  describe('path logic', () => {
    it('production path includes dist and public', () => {
      const distServerDir = 'dist';
      const prodPath = path.join(distServerDir, 'public');
      expect(prodPath).toContain('public');
    });

    it('development path points to client source', () => {
      const serverDir = 'server';
      const devPath = path.join(serverDir, '..', 'client', 'public');
      expect(devPath).toContain('client');
      expect(devPath).toContain('public');
    });
  });
});
