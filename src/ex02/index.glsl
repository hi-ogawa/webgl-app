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


#ifdef COMPILE_vertex
  // builtin
  uniform mat4 modelViewMatrix;
  uniform mat4 projectionMatrix;

  in vec3 position;

  // custom
  in vec2 custom_uv;

  out vec2 Vert_uv;
  out vec3 Vert_position;


  void main() {
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    Vert_position = position;
    Vert_uv = custom_uv;
    // Same can be achieved without custom attribute when geometry is non-indexed
    // Vert_uv = vec2[](OZN.yy, OZN.xy, OZN.yx)[gl_VertexId % 3];
  }
#endif


#ifdef COMPILE_fragment
  // custom
  uniform float U_width;
  uniform float U_aa;

  in vec3 Vert_position;
  in vec2 Vert_uv;
  out vec4 Frag_color;

  void main() {
    vec2 p = Vert_uv;
    mat2 dpdw = mat2(dFdx(p), dFdy(p));
    float ud;
    {
      ud = 1e7;
      ud = min(ud, udPlaneWithJacobian(p, normalize(OZN.xy), dpdw));
      ud = min(ud, udPlaneWithJacobian(p, normalize(OZN.yx), dpdw));
      ud = min(ud, udPlaneWithJacobian(p - OZN.xy, normalize(OZN.xx), dpdw));
    }
    float fac = udToFactor(ud, U_width, U_aa);
    vec3 c1 = vec3(0.0, 1.0, 0.5);
    vec3 c2 = vec3(1.0, 0.5, 0.0);
    vec3 color = mixGamma(c1, c2, fac, 2.2);
    Frag_color = vec4(color, 1.0);
  }
#endif
