const float M_PI = 3.141592;
const vec3 OZN = vec3(1.0, 0.0, -1.0);

vec4 mixGamma4(vec4 c1, vec4 c2, float t) {
  vec4 ret;
  c1.xyz = pow(c1.xyz, vec3(2.2));
  c2.xyz = pow(c2.xyz, vec3(2.2));
  ret = mix(c1, c2, t);
  ret.xyz = pow(ret.xyz, vec3(1.0 / 2.2));
  return ret;
}

float udPlaneWithJacobian(vec2 p, vec2 n, mat2 J) {
  vec2 v = dot(n, p) * n;
  return length(v) / length(n * J);
}

float sdToFactor(float sd, float aa_width) {
  return 1.0 - smoothstep(0.0, 1.0, sd / aa_width + 0.5);
}

float udToFactor(float ud, float width, float aa_width) {
  return sdToFactor(ud - width / 2.0, aa_width);
}

mat2 T_rotate(float t) {
  return mat2(cos(t), sin(t), -sin(t), cos(t));
}

mat3 T_scale(vec2 s) {
  return mat3(s.x * OZN.xyy, s.y * OZN.yxy, OZN.yyx);
}

mat3 T_translate(vec2 p) {
  return mat3(OZN.xyy, OZN.yxy, vec3(p, 1.0));
}

float dot2(vec2 p) { return dot(p, p); }

const vec2 C_1 = OZN.xy;

const vec2 C_i = OZN.yx;

mat2 C_mul(vec2 z) {
  return mat2(z.x, z.y, -z.y, z.x);
}

// Signed distance of filled Julia set based on Bottcher coordinate at critical point ∞
float sdJulia(vec2 z, vec2 c, mat2 dzdw) {
  vec2 dz = C_1;
  vec2 z_min = z; // track "orbit trap" (smallest element during iteration)
  vec2 dz_min = dz;
  int iter = 0;
  bool escape = false;
  for (; iter < 256; iter++) {
    if (dot2(z) < dot2(z_min)) { z_min = z; dz_min = dz; }
    if (1e6 < dot2(z)) { escape = true; break; }
    dz = 2.0 * C_mul(z) * dz;
    z = C_mul(z) * z + c;
  }

  // if not escape , we use "orbit trap" of z
  if (!escape) { z = z_min; }

  float g = 0.5 * log(dot2(z));      // = log(|z|)
  vec2 dg = z * C_mul(dz) / dot2(z); // = grad log(|z|)
  float sd = g / length(dg * dzdw);  // factor 2^k cancels here
  return sd;
}

// Simple mandelbrot set test
bool mandelbrot(vec2 c) {
  vec2 z = c;
  for (int i = 0; i < 512; i++) {
    if (4.0 < dot2(z)) { return false; }
    z = C_mul(z) * z + c;
  }
  return true;
}

#define MIN_ASSIGN(X_OUT, D_OUT, X, D) \
  if (D < D_OUT) { D_OUT = D; X_OUT = X; }


//
// Main
//

#ifdef Main00
  #ifdef COMPILE_VERTEX
    uniform mat4 modelViewMatrix;
    uniform mat4 projectionMatrix;

    in vec3 position;

    void main() {
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  #endif

  #ifdef COMPILE_FRAGMENT
    uniform vec2 U_resolution;
    uniform float U_time;
    uniform vec2 U_c;
    uniform mat4 U_window_to_world;
    out vec4 Frag_color;

    vec4 renderPixel(vec2 frag_coord) {
      float height = 2.5;
      vec2 p = vec2(U_window_to_world * vec4(frag_coord, 0.0, 1.0));
      mat2 dpdw = mat2(dFdx(p), dFdy(p));

      float fac_julia;
      {
        vec2 c = U_c;
        c = - C_mul(c) * (c - 2.0 * C_1) / 4.0; // logistic map parameterization
        float sd = sdJulia(p, c, dpdw);
        fac_julia = sdToFactor(sd, 2.0);
      }

      float fac_mandelbrot;
      {
        vec2 c = p;
        c = - C_mul(c) * (c - 2.0 * C_1) / 4.0; // logistic map parameterization
        fac_mandelbrot = float(mandelbrot(c));
      }

      vec4 color = vec4(0.0);
      color = mixGamma4(color, vec4(OZN.xxx * 0.5, 1.0), fac_mandelbrot * 0.7);
      color = mixGamma4(color, vec4(OZN.yxx * 0.9, 1.0), fac_julia * 0.7);
      return color;
    }

    void main() {
      Frag_color = renderPixel(gl_FragCoord.xy);
    }
  #endif
#endif


#ifdef Main01
  uniform float U_point_size;

  #ifdef COMPILE_VERTEX
    uniform mat4 modelViewMatrix;
    uniform mat4 projectionMatrix;

    in vec3 position;

    void main() {
      gl_PointSize = 1.5 * U_point_size;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  #endif

  #ifdef COMPILE_FRAGMENT
    out vec4 Frag_color;

    void main() {
      vec2 p = 1.5 * U_point_size * (gl_PointCoord - 0.5);
      float sd = length(p) - 0.5 * U_point_size;
      float fac = sdToFactor(sd, 1.5);
      Frag_color = vec4(OZN.xxx, fac);
    }
  #endif
#endif
