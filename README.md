Various demo with three.js and A-Frame

https://webgl-app-hiogawa.vercel.app/src/

Examples

- WebGL shader
- Computational geometry
- Soft body simulation
- Visualization

```
# Development
npm install
npm run build
npm start # then open e.g. http://localhost:5000/src/ex04_julia/

# Testing
npm test

# Linting
npm run lint -- src/utils/*.js # choose files
npm run lint_diff # files from `git diff --staged`
npm run lint_all:watch

# Screenshot
npm install --prefix scripts
npm run screenshot -- http://localhost:5000/src/ex04_julia/ julia.png # single example
npm run screenshot_all # all examples under src/

# Benchmark
npm run bench -- -g 'readOFF bunny' # specific benchmark
npm run bench

# Deployment
npm run deploy
```

References

- https://github.com/mrdoob/three.js
- https://github.com/mochajs/mocha
- https://www.snowpack.dev/
