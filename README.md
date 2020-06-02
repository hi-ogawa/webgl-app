WebGL shader examples using three.js

```
# Development
yarn install
yarn snowpack_install
yarn start # then open e.g. http://localhost:5000/src/ex04_julia/

# Testing
yarn test

# Linting
yarn lint src/utils/*.js # choose files
yarn lint_diff # files from `git diff --staged`

# Screenshot
yarn screenshot http://localhost:5000/src/ex04_julia/ julia.png # single example
yarn screenshot_all # all examples under src/

# Deployment
yarn deploy
```

References

- https://github.com/mrdoob/three.js
- https://github.com/mochajs/mocha
- https://www.snowpack.dev/
