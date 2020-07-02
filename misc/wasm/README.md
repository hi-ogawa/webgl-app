- CMake example

```
cmake misc/wasm/ex03 -B misc/wasm/ex03/build -G Ninja -DCMAKE_TOOLCHAIN_FILE=$HOME/code/others/emsdk/upstream/emscripten/cmake/Modules/Platform/Emscripten.cmake
ninja -C misc/wasm/ex03/build
node misc/wasm/ex03/build/main.js
```

- C++ to WASM by Emscripten

```
# Compile (run in child bash since we don't want to emsdk to overwrite "node" path)
(source $HOME/code/others/emsdk/emsdk_env.sh > /dev/null && emcc --bind misc/wasm/ex00.cpp -o misc/wasm/ex00.em.js)

# Test
npx mocha misc/wasm/ex00.test.js
```

See src/utils/array.bench.js for example use of ex01.js.


- SIMD example (latest V8/D8 is setup by jsvu https://github.com/GoogleChromeLabs/jsvu)

```
# d8 only recognize relative path to current directory
$ cd misc/wasm

# Compile
$ (source $HOME/code/others/emsdk/emsdk_env.sh > /dev/null && emcc -O3 -msse -msimd128 --bind ex02.cpp -o ex02.em.js)

# Benchmark
$ ~/.jsvu/v8 --experimental-wasm-simd ex02.d8.js
buf.data().length = 1048576
buf.sum()     = 524400.5625
buf.sum_sse() = 524396.6875
[timeit] buf.sum()     => 1.4190 msec (stddev: 0.1372, min: 1.225, max: 1.540, n: 200, r: 5)
[timeit] buf.sum_sse() => 354.50 usec (stddev: 16.00, min: 340.0, max: 385.0, n: 400, r: 5)

# Comparing with pyhton/numpy
$ python -m timeit -s 'import numpy as np; a = np.zeros(2**20, dtype=np.float32)' -- 'a.sum()'
500 loops, best of 5: 499 usec per loop

# Disassemble SIMD code (grep "f32x4")
$ $HOME/code/others/emsdk/upstream/bin/wasm-dis ex02.em.wasm | head -n 11030 | tail -n $(( 11030 - 10975 ))
  (local.set $4        # __m128 resultv = {0, 0, 0, 0}
   (f32x4.splat
    (f32.const 0)
   )
  )
  (if
   (i32.lt_u
    (local.get $0)
    (local.get $1)
   )
   (loop $label$5
    (local.set $4        # resultv += *reinterpret_cast<const __m128*>(ptr)
     (f32x4.add
      (local.get $4)
      (v128.load
       (local.get $0)
      )
     )
    )
    (br_if $label$5
     (i32.lt_u
      (local.tee $0        # ptr += 4
       (i32.add
        (local.get $0)
        (i32.const 16)
       )
      )
      (local.get $1)
     )
    )
   )
  )
  (local.set $3        # result += resultv[0] + resultv[1] + resultv[2] + resultv[3]
   (f32.add
    (local.get $3)
    (f32.add
     (f32x4.extract_lane 3
      (local.get $4)
     )
     (f32.add
      (f32x4.extract_lane 2
       (local.get $4)
      )
      (f32.add
       (f32x4.extract_lane 0
        (local.get $4)
       )
       (f32x4.extract_lane 1
        (local.get $4)
       )
      )
     )
    )
   )
  )

# V8 JIT output (grep "addps") ("--print-code" is available to v8-debug from jsvu)
$ ~/.jsvu/v8-debug --experimental-wasm-simd ex02.d8.js --print-code
...
0x3b63d8d0ffa0   160  488b4e23       REX.W movq rcx,[rsi+0x23]         +
0x3b63d8d0ffa4   164  483b21         REX.W cmpq rsp,[rcx]              +
0x3b63d8d0ffa7   167  0f8661010000   jna 0x3b63d8d1010e  <+0x2ce>      +
0x3b63d8d0ffad   16d  8bc8           movl rcx,rax                      +
0x3b63d8d0ffaf   16f  4c8b159dfeffff REX.W movq r10,[rip+0xfffffe9d]   +
0x3b63d8d0ffb6   176  4c3bd1         REX.W cmpq r10,rcx                +
0x3b63d8d0ffb9   179  771d           ja 0x3b63d8d0ffd8  <+0x198>       +
0x3b63d8d0ffbb   17b  bf01000000     movl rdi,0x1
0x3b63d8d0ffc0   180  4989e2         REX.W movq r10,rsp
0x3b63d8d0ffc3   183  4883ec08       REX.W subq rsp,0x8
0x3b63d8d0ffc7   187  4883e4f0       REX.W andq rsp,0xf0
0x3b63d8d0ffcb   18b  4c891424       REX.W movq [rsp],r10
0x3b63d8d0ffcf   18f  488b05a0feffff REX.W movq rax,[rip+0xfffffea0]
0x3b63d8d0ffd6   196  ffd0           call rax
0x3b63d8d0ffd8   198  c5fa6f1c0b     vmovdqu xmm3,[rbx+rcx*1]          +
0x3b63d8d0ffdd   19d  c5f858c3       vaddps xmm0,xmm0,xmm3             +
0x3b63d8d0ffe1   1a1  83c010         addl rax,0x10                     +
0x3b63d8d0ffe4   1a4  4c8b1568feffff REX.W movq r10,[rip+0xfffffe68]   +
0x3b63d8d0ffeb   1ab  4c3bd0         REX.W cmpq r10,rax                +
0x3b63d8d0ffee   1ae  771d           ja 0x3b63d8d1000d  <+0x1cd>       +
0x3b63d8d0fff0   1b0  bf01000000     movl rdi,0x1
0x3b63d8d0fff5   1b5  4989e2         REX.W movq r10,rsp
0x3b63d8d0fff8   1b8  4883ec08       REX.W subq rsp,0x8
0x3b63d8d0fffc   1bc  4883e4f0       REX.W andq rsp,0xf0
0x3b63d8d10000   1c0  4c891424       REX.W movq [rsp],r10
0x3b63d8d10004   1c4  488b056bfeffff REX.W movq rax,[rip+0xfffffe6b]
0x3b63d8d1000b   1cb  ffd0           call rax
0x3b63d8d1000d   1cd  3bc2           cmpl rax,rdx                      +
0x3b63d8d1000f   1cf  728f           jc 0x3b63d8d0ffa0  <+0x160>       +
...

# Compare with clang's assembly
$ clang++ -O3 -msse -c ex02_impl.cpp
$ lldb --batch -o 'disassemble --name sum_sse' ./ex02_impl.o
...
ex02_impl.o[0xb2] <+130>:  movq   %rcx, %rdi
ex02_impl.o[0xb5] <+133>:  andq   $0x7, %rsi
ex02_impl.o[0xb9] <+137>:  je     0xcd                      ; <+157>
ex02_impl.o[0xbb] <+139>:  nopl   (%rax,%rax)
ex02_impl.o[0xc0] <+144>:  addps  (%rdi), %xmm1                             + (f32x4 reduction loop)
ex02_impl.o[0xc3] <+147>:  addq   $0x10, %rdi                               +
ex02_impl.o[0xc7] <+151>:  addq   $-0x1, %rsi                               +
ex02_impl.o[0xcb] <+155>:  jne    0xc0                      ; <+144>        +
ex02_impl.o[0xcd] <+157>:  leaq   0x4(,%rdx,4), %rdx
ex02_impl.o[0xd5] <+165>:  cmpq   $0x70, %r10
ex02_impl.o[0xd9] <+169>:  jb     0x108                     ; <+216>
ex02_impl.o[0xdb] <+171>:  nopl   (%rax,%rax)
...
```
