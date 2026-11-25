Full-resolution PNG sources are kept outside `public` so Vite does not ship them alongside the optimized WebP posters. Runtime theme paths are defined in `src/lib/tectonaThemes.ts`.

Export posters using FFmpeg's `libwebp` encoder at quality 92 and compression level 6. Preserve the source dimensions. The original PNGs remain available here for future edits and video rendering.
