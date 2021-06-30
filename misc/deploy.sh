#!/bin/bash

rm -rf build
mkdir -p build
cp -rf .vercel config/vercel.json build

rsync -avR \
  --include="src" \
  --include="src/**" \
  --include="web_modules" \
  --include="web_modules/**" \
  --include="misc" \
  --include="misc/data" \
  --include="misc/data/**" \
  --include="thirdparty" \
  --include="thirdparty/libigl-tutorial-data" \
  --include="thirdparty/libigl-tutorial-data/bunny.mesh" \
  --include="thirdparty/libigl-tutorial-data/bunny.off" \
  --include="thirdparty/libigl-tutorial-data/3holes.off" \
  --include="thirdparty/libigl-tutorial-data/camelhead.off" \
  --exclude="*" \
  . build

cd build
npx vercel ${@}
