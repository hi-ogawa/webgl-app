const vec3 OZN = vec3(1.0, 0.0, -1.0);

float sdToFactor(float sd, float aa_width) {
  return 1.0 - smoothstep(0.0, 1.0, sd / aa_width + 0.5);
}

//
// Main
//

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
