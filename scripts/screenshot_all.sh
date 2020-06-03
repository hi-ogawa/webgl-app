#!/bin/bash

URL_BASE='http://localhost:5000'
ARGS=()

for DIR in $(ls -d src/ex*); do
  ARGS+=( "${URL_BASE}/${DIR}/" )
  ARGS+=( scripts/screenshots/$(basename "${DIR}").png )
done

node scripts/screenshot.js "${ARGS[@]}" --width 400 --height 300
