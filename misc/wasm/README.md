Wasm Examples

```
# Compile (run in child bash since we don't want to emsdk to overwrite "node" path)
(source $HOME/code/others/emsdk/emsdk_env.sh > /dev/null && emcc --bind misc/wasm/ex00.cpp -o misc/wasm/ex00.em.js)

# Test
npx mocha misc/wasm/ex00.test.js
```

See src/utils/array.bench.js for example use of ex01.js.
