#version 300 es
precision highp float;
precision highp int;

#ifdef COMPILE_VERTEX
  in vec3 position;
  void main() { gl_Position = vec4(position, 1.0); }
#endif

//
// Utilities
//

const float M_PI = 3.141592;
const vec3 OZN = vec3(1.0, 0.0, -1.0);

float pow2(float x) { return x * x; }

float sdToFactor(float sd, float aa_width) {
  return 1.0 - smoothstep(0.0, 1.0, sd / aa_width + 0.5);
}

//
// Main
//

#ifdef MAIN00
  //
  // Advection by flow (initially used for debugging framebuffer)
  //

  #ifdef COMPILE_FRAGMENT
    uniform sampler2D U_buffer1;
    uniform vec2 U_buffer1_resolution;
    uniform float U_time;
    uniform float U_timeDelta;
    uniform float U_frame;
    out highp vec4 F_color;

    vec4 read1(vec2 frag_coord) {
      return textureLod(U_buffer1, frag_coord / U_buffer1_resolution, 0.0);
    }

    vec2 flow_LeVeque2(vec2 p, float period) {
      vec2 v;
      v.x = + pow2(sin(M_PI * p.x)) * sin(2.0 * M_PI * p.y);
      v.y = - pow2(sin(M_PI * p.y)) * sin(2.0 * M_PI * p.x);
      v *= sin(2.0 * M_PI * U_time / period);
      return v;
    }

    vec4 renderPixel(vec2 frag_coord) {
      vec2 resolution = U_buffer1_resolution;
      vec2 uv = frag_coord / resolution;

      // Initialize
      if (int(U_frame) == 0) {
        float fac = step(0.5, uv.x);
        return vec4(vec3(fac), 1.0);
      }

      // Semi-Lagrangian advection
      vec2 vel = resolution * flow_LeVeque2(uv, 4.0);
      vec4 data_adv = read1(frag_coord - U_timeDelta * vel);
      return data_adv;
    }

    void main() {
      F_color = renderPixel(gl_FragCoord.xy);
    }
  #endif
#endif

//
// Solve PDE
//

#ifdef MAIN01
  #ifdef COMPILE_FRAGMENT
    uniform sampler2D U_buffer1;
    uniform vec2 U_buffer1_resolution;
    uniform float U_time;
    uniform float U_timeDelta;
    uniform float U_frame;
    uniform vec2 U_mouse_uv;
    out highp vec4 F_color;

    const float dt = 0.7;
    const float dx = 1.0;
    const float c  = 1.0;
    const float mu = 0.01;
    float kBumpSize = 32.0; // in pixel
    float kPeriod = 0.5;

    vec4 read1(vec2 frag_coord) {
      return textureLod(U_buffer1, frag_coord / U_buffer1_resolution, 0.0);
    }

    vec2 solve(vec2 p) {
      float f_old = read1(p).y;
      float f = read1(p).x;

      // right, left, up, down
      float f_r = read1(p + OZN.xy).x;
      float f_l = read1(p - OZN.xy).x;
      float f_u = read1(p + OZN.yx).x;
      float f_d = read1(p - OZN.yx).x;

      // Explicit multistep formula
      //   f_n+1 = (1 / (1 + mu dt)) * (2 f_n - (1 - mu dt) f_n-1 + dt^2 c^2 ∆f_n)
      float div_grad_f = (f_r + f_l + f_u + f_d - 4.0 * f) / pow2(dx);
      float f_new = (1.0 / (1.0 + mu * dt)) * (2.0 * f - (1.0 - mu * dt) * f_old + pow2(dt * c) * div_grad_f);
      return vec2(f_new, f);
    }

    float getSource(vec2 frag_coord, vec2 source_coord) {
      float sd = length(frag_coord - source_coord) - kBumpSize / 2.0;
      return sdToFactor(sd, kBumpSize / 2.0);
    }

    vec4 renderPixel(vec2 frag_coord) {
      vec2 resolution = U_buffer1_resolution;
      vec2 p = frag_coord;

      // Initialize
      if (int(U_frame) == 0) {
        return vec4(0.0);
      }

      // Solve PDE
      vec2 data = solve(p);

      // Superpose external source
      float f; {
        vec2 src_uv = U_mouse_uv.x < 0.0 ? vec2(0.5) : U_mouse_uv;
        f = getSource(p, src_uv * resolution);
        f *= 0.5;
        f *= sin(2.0 * M_PI * U_time / kPeriod);
      }
      data += vec2(f, f);

      return vec4(data, 0, 0.0);
    }

    void main() {
      F_color = renderPixel(gl_FragCoord.xy);
    }
  #endif
#endif

//
// Visualize buffer1
//

#ifdef MAIN02
  #ifdef COMPILE_FRAGMENT
    uniform sampler2D U_buffer1;
    uniform vec2 U_buffer1_resolution;
    out highp vec4 F_color;

    float kScale = 0.3;
    vec3 kColor1 = vec3(1.0, 0.5, 0.0);
    vec3 kColor2 = vec3(0.0, 0.5, 1.0);

    vec4 renderPixel(vec2 frag_coord) {
      float f = texelFetch(U_buffer1, ivec2(frag_coord), 0).x;
      float fp = max(+f, 0.0);
      float fn = max(-f, 0.0);
      vec3 color = kScale * (fp * kColor1 + fn * kColor2);
      color = pow(color, vec3(1.0 / 2.2));
      return vec4(color, 1.0);
    }

    void main() {
      F_color = renderPixel(gl_FragCoord.xy);
    }
  #endif
#endif
