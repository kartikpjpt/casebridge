import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'adapters/angular': 'src/adapters/angular.ts',
    'adapters/fetch': 'src/adapters/fetch.ts',
    'adapters/axios': 'src/adapters/axios.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
  outDir: 'dist',
  // Keep angular/rxjs as externals — they're peer deps
  external: ['@angular/core', '@angular/common', 'rxjs'],
  // Separate output dirs per format
  outExtension({ format }) {
    return { js: format === 'cjs' ? '.cjs' : '.js' };
  },
});
