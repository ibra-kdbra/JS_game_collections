#!/bin/sh
# Rebuild solver.wasm from solver.cpp. Needs clang and wasm-ld (LLVM 15+);
# no Emscripten or WASI SDK. The .wasm is committed so the site needs no build.
set -e
cd "$(dirname "$0")"
clang++ --target=wasm32 -std=c++17 -O3 -nostdlib -ffreestanding -fno-exceptions -fno-rtti \
  -fvisibility=hidden -Wall -Wextra \
  -Wl,--no-entry -Wl,--strip-all -Wl,--initial-memory=33554432 \
  -o solver.wasm solver.cpp
ls -l solver.wasm
