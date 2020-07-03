```
# for native
cmake -G Ninja misc/wasm/ex05 -B misc/wasm/ex05/build/native/Debug -DCMAKE_BUILD_TYPE=Debug
ninja -C misc/wasm/ex05/build/native/Debug main # you cannot compile "em.cpp"
misc/wasm/ex05/build/native/Debug/main -s --use-colour no

# for js
cmake -G Ninja misc/wasm/ex05 -B misc/wasm/ex05/build/js/Debug -DCMAKE_BUILD_TYPE=Debug -DCMAKE_TOOLCHAIN_FILE=$HOME/code/others/emsdk/upstream/emscripten/cmake/Modules/Platform/Emscripten.cmake
ninja -C misc/wasm/ex05/build/js/Debug
node misc/wasm/ex05/build/js/Debug/main.js -s --use-colour no
npx mocha misc/wasm/ex05/test.js
```
