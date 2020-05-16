const vec3 OZN = vec3(1.0, 0.0, -1.0);

float sdToFactor(float sd, float aa_width) {
  return 1.0 - smoothstep(0.0, 1.0, sd / aa_width + 0.5);
}

float udToFactor(float ud, float width, float aa_width) {
  return sdToFactor(ud - width / 2.0, aa_width);
}

//
// Main
//

#ifdef Main00
  uniform vec2 U_resolution;
  uniform float U_line_width;
  uniform float U_aa_width;
  uniform vec3 U_color;
  uniform bool U_use_vertexColors;

  #ifdef COMPILE_VERTEX
    uniform mat4 modelViewMatrix;
    uniform mat4 projectionMatrix;

    in vec3 position1;
    in vec3 position2;
    in vec3 color;

    out vec3 Vert_color;
    out float Vert_side;

    void main() {
      float quad_width = U_line_width + U_aa_width;

      int idx = gl_VertexID % 4;
      vec4 p1 = projectionMatrix * modelViewMatrix * vec4(position1, 1.0);
      vec4 p2 = projectionMatrix * modelViewMatrix * vec4(position2, 1.0);
      vec4 p = (idx == 0 || idx == 3) ? p1 : p2;
      vec4 v = p2 - p1;
      float side = (idx == 2 || idx == 3) ? -1.0 : 1.0;

      // Extrude line along line normal in window space
      vec3 n;
      {
        // We will not touch clip space z
        vec3 q = p.xyw;
        vec3 u = v.xyw;

        // Derivative of perspective projection
        mat3x2 dF = mat3x2(OZN.xy, OZN.yx, -q.xy / q.z) / q.z;

        // Line normal in window space (i.e. dot(dF(n), dF(u)) = 0)
        // TODO: Prove this cross with (0, 0, 1) always works
        n = cross(transpose(dF) * dF * u, vec3(0, 0, 1.0));

        // Normalize in window space
        n /= length(0.5 * U_resolution * (dF * n));
        n *= quad_width / 2.0;
      }
      p.xyw += side * n;

      gl_Position = p;
      Vert_color = color;
      Vert_side = side * (quad_width / 2.0) * p.w; // manual "no perspective" (1)
    }
  #endif

  #ifdef COMPILE_FRAGMENT
    in vec3 Vert_color;
    in float Vert_side;

    out vec4 Frag_color;

    void main() {
      float side = Vert_side * gl_FragCoord.w; // manual "no perspective" (2)
      float ud = abs(side);
      float fac = udToFactor(ud, U_line_width, U_aa_width);
      vec3 color = U_use_vertexColors ? Vert_color : U_color;
      Frag_color = vec4(color, fac);
    }
  #endif
#endif
