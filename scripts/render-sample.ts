// @ts-nocheck
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/cli/api';
import path from 'path';

async function main() {
  const compositionId = 'StaticCardsV1';
  console.log(`Bundling ${compositionId}...`);
  
  const bundled = await bundle({
    entryPoint: path.resolve(process.cwd(), 'src/remotion/index.ts'),
    webpackOverride: (config) => config,
  });

  const composition = await selectComposition({
    serveUrl: bundled,
    id: compositionId,
    inputProps: {
      hook: "¿Querés vigilar tu casa?",
      productTitle: "Cámara Inteligente",
      benefits: ["Fácil", "Wifi", "Nocturna"],
      cta: "Link en bio",
      disclaimer: "Enlace afiliado",
    },
  });

  console.log(`Rendering ${compositionId}...`);
  const outputLocation = path.resolve(process.cwd(), `storage/media/sample-${Date.now()}.mp4`);
  
  await renderMedia({
    composition,
    serveUrl: bundled,
    codec: 'h264',
    outputLocation,
    inputProps: composition.defaultProps,
  });

  console.log(`Render complete! Saved to ${outputLocation}`);
}

main().catch(console.error);
