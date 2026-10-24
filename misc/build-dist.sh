#!/bin/bash
set -eu

# Collect static files served by Cloudflare Workers (see wrangler.jsonc)
rm -rf dist
mkdir -p dist/misc dist/thirdparty/libigl-tutorial-data

cp -R src web_modules dist
cp -R misc/data dist/misc
for file in bunny.mesh bunny.off 3holes.off camelhead.off; do
  cp thirdparty/libigl-tutorial-data/$file dist/thirdparty/libigl-tutorial-data
done

# Example index (previously provided by Vercel's directory listing)
{
  echo '<!DOCTYPE html>'
  echo '<head><meta charset="utf-8"><title>WebGL App</title></head>'
  echo '<body>'
  echo '<h1>WebGL App</h1>'
  echo '<ul>'
  for dir in src/ex*/; do
    name=$(basename "$dir")
    echo "<li><a href=\"./$name/\">$name</a></li>"
  done
  echo '</ul>'
  echo '</body>'
} > dist/src/index.html

echo '/ /src/ 302' > dist/_redirects
