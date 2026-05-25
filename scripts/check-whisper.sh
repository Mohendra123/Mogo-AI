#!/bin/bash
# Run from anywhere — checks whisper.cpp for MOGO server
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
W="$ROOT/whisper.cpp"
BIN="$W/build/bin/whisper-cli"

echo "MOGO root: $ROOT"
echo ""

if [[ ! -f "$BIN" ]]; then
  echo "FAIL: whisper-cli not found at:"
  echo "  $BIN"
  echo ""
  echo "Build:"
  echo "  cd \"$W\" && cmake -B build && cmake --build build -j"
  exit 1
fi

export DYLD_LIBRARY_PATH="$W/build/src:$W/build/ggml/src:$W/build/ggml/src/ggml-blas:$W/build/ggml/src/ggml-metal"

echo "Testing whisper-cli..."
if ! "$BIN" -h >/dev/null 2>&1; then
  echo "FAIL: whisper-cli cannot load libraries (dyld error)."
  echo "DYLD_LIBRARY_PATH=$DYLD_LIBRARY_PATH"
  "$BIN" -h 2>&1 | head -5
  exit 1
fi
echo "OK: whisper-cli runs"

for m in small base medium; do
  if [[ -f "$W/models/ggml-$m.bin" ]]; then
    echo "OK: model ggml-$m.bin"
  else
    echo "MISSING: ggml-$m.bin — run: cd \"$W/models\" && ./download-ggml-model.sh $m"
  fi
done

echo ""
echo "Start server:"
echo "  cd \"$ROOT\" && node server.js"
