When we want to use WebGL2 in Aframe, then try this.

- Before import `AFRAME`

```
<script>
  // Make `AFRAME.AScene.prototype.setupRenderer` writable
  // in order to use `webgl2` context
  window.debug = true
</script>
```

- Monkey-patch `AFRAME.Ascene`

```
AFRAME.AScene.prototype.setupRenderer = function () {
  const { canvas } = this
  const context = canvas.getContext('webgl2', { alpha: false, antialias: true })
  this.renderer = new THREE.WebGLRenderer({ canvas, context })
}
```

- Simple translation from glsl 100 to 300

```
// cf. https://github.com/mrdoob/three.js/blob/a24d211f16e961aecb41f80ebb3127fd29ba24fc/src/renderers/webgl/WebGLProgram.js#L683
#ifdef COMPILE_VERTEX
  #define attribute in
  #define varying out
  #define texture2D texture
#endif

#ifdef COMPILE_FRAGMENT
  #define varying in
  #define texture2D texture
  #define gl_FragColor outFragColor
  out highp vec4 outFragColor;
#endif
```
