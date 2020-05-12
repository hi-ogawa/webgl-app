const float M_PI = 3.141592;
const vec3 OZN = vec3(1.0, 0.0, -1.0);

vec3 mixGamma(vec3 c1, vec3 c2, float t, float gamma) {
  c1 = pow(c1, vec3(gamma));
  c2 = pow(c2, vec3(gamma));
  return pow(mix(c1, c2, t), vec3(1.0 / gamma));
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

// [0, w_res] x [0, h_res] -> [-x/2, x/2] x [-h/2, h/2] with x = y * w_res / h_res
mat3 T_invViewXform(float h, vec2 resolution) {
  float s = h / resolution.y;
  vec2 t = - 0.5 * s * resolution;
  return mat3(s * OZN.xyy, s * OZN.yxy, vec3(t, 1.0));
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
  vec2 w = z; // track "orbit trap" (smallest element during iteration)
  vec2 dw = dz;
  int iter = 0;
  bool escape = false;
  for (; iter < 256; iter++) {
    if (dot2(z) < dot2(w)) { w = z; dw = dz; }
    if (1e6 < dot2(z)) { escape = true; break; }
    dz = 2.0 * C_mul(z) * dz;
    z = C_mul(z) * z + c;
  }

  // if not escape , we use "orbit trap" of z
  if (!escape) { z = w; }

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


#ifdef COMPILE_vertex
  in vec3 position;

  void main() {
    gl_Position = vec4(position, 1.0);
  }
#endif


#ifdef COMPILE_fragment
  uniform vec2 U_resolution;
  uniform vec2 U_view_xy;
  uniform float U_view_zoom;
  uniform float U_time;
  uniform vec2 U_mouse;
  uniform vec2 U_c;
  uniform float U_use_mouse;
  out vec4 Frag_color;

  vec4 renderPixel(vec2 frag_coord) {
    float height = 2.5;
    mat3 inv_view_xform1 = T_scale(vec2(pow(2.0, U_view_zoom))) * T_translate(U_view_xy);
    mat3 inv_view_xform2 = T_invViewXform(height, U_resolution);
    mat3 inv_view_xform = inv_view_xform2 * inv_view_xform1;
    vec2 p = vec2(inv_view_xform * vec3(frag_coord, 1.0));
    mat2 dpdw = mat2(dFdx(p), dFdy(p));

    vec3 color_grid;
    {
      vec3 result;
      float sd = 1e7;
      MIN_ASSIGN(result, sd, OZN.xxx * 0.8, udPlaneWithJacobian(min(fract(p), 1.0 - fract(p)), OZN.xy, dpdw) - 1.0);
      MIN_ASSIGN(result, sd, OZN.xxx * 0.8, udPlaneWithJacobian(min(fract(p), 1.0 - fract(p)), OZN.yx, dpdw) - 1.0);
      MIN_ASSIGN(result, sd, OZN.xyy      , udPlaneWithJacobian(p, OZN.xy, dpdw) - 1.5);
      MIN_ASSIGN(result, sd, OZN.yxy      , udPlaneWithJacobian(p, OZN.yx, dpdw) - 1.5);
      float fac = sdToFactor(sd, 1.5);
      color_grid = mixGamma(OZN.yyy, result, fac, 2.2);
    }

    float fac_julia;
    {
      vec2 c = T_rotate(2.0 * M_PI * U_time / 16.0) * OZN.xy * 1.1;
      if (1.0 <= U_use_mouse) {
        c = vec2(inv_view_xform2 * vec3(U_c, 1.0));
      }
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

    vec3 color = color_grid;
    color = mixGamma(color, OZN.xxx * 0.5, fac_mandelbrot * 0.7, 2.2);
    color = mixGamma(color, vec3(0.0, 1.0, 1.0), fac_julia * 0.7, 2.2);
    return vec4(color, 1.0);
  }

  void main() {
    Frag_color = renderPixel(gl_FragCoord.xy);
  }
#endif
