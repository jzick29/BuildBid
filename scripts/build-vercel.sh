#!/bin/bash
# Build Vercel serverless output from TanStack Start build + esbuild bundle
set -e

echo "==> Running vite build..."
bun run build

echo "==> Bundling vercel-entry.ts into serverless function..."
rm -rf .vercel/output
mkdir -p .vercel/output/functions/render.func .vercel/output/static

npx esbuild vercel-entry.ts \
  --bundle \
  --platform=node \
  --target=node22 \
  --outfile=.vercel/output/functions/render.func/index.js \
  --format=cjs

cat > .vercel/output/functions/render.func/.vc-config.json << 'VCCONFIG'
{"runtime":"nodejs22.x","handler":"index.js","launcherType":"Nodejs","supportsResponseStreaming":true}
VCCONFIG

cat > .vercel/output/config.json << 'ROUTES'
{"version":3,"routes":[{"src":"/robots.txt","dest":"/robots.txt"},{"src":"/sitemap.xml","dest":"/sitemap.xml"},{"src":"/favicon.svg","dest":"/favicon.svg"},{"src":"/assets/(.*)","dest":"/assets/$1"},{"handle":"filesystem"},{"src":"/(.*)","dest":"/render"}]}
ROUTES

cp -r dist/client/* .vercel/output/static/ 2>/dev/null || true
for f in robots.txt sitemap.xml favicon.svg; do
  [ -f "$f" ] && cp "$f" .vercel/output/static/
done

echo "==> Done! Deploy with: npx vercel deploy --prebuilt --prod -y"
