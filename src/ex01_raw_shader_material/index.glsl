const vec3 OZN = vec3(1.0, 0.0, -1.0);

vec3 mixGamma(vec3 c1, vec3 c2, float t, float gamma) {
  c1 = pow(c1, vec3(gamma));
  c2 = pow(c2, vec3(gamma));
  return pow(mix(c1, c2, t), vec3(1.0 / gamma));
}

mat3 outer2(vec3 v) {
  return mat3(v.x * v, v.y * v, v.z * v);
}

float udPlaneWithJacobian(vec3 p, vec3 n, mat2x3 J) {
  vec3 v = dot(n, p) * n;
  return length(v) / length(n * J);
}

vec3 reflectWithJacobian(vec3 p, vec3 n, inout mat3 J) {
  J = (mat3(1.0) - 2.0 * outer2(n)) * J;
  return p - 2.0 * dot(n, p) * n;
}

// Mobius triangle (4, 3, 2)
float sdMobius432(vec3 p, mat2x3 dpdw) {
  mat3 jacobian = mat3(1.0);

  // Fundamental triangle by intersection of 3 half spaces
  vec3 ns[3] = vec3[](
      OZN.yyx,
      normalize(OZN.xyz),
      normalize(OZN.zxy));

  int parity = 0;
  for (int i = 0; i < 32; i++) {
    bool ok = true;
    for (int i = 0; i < 3; i++) {
      vec3 n = ns[i];
      if (dot(n, p) < 0.0) {
        ok = false;
        parity++;
        p = reflectWithJacobian(p, n, jacobian);
      }
    }
    if (ok) { break; }
  }

  float ud = 1e7;
  for (int i = 0; i < 3; i++) {
    ud = min(ud, udPlaneWithJacobian(p, ns[i], jacobian * dpdw));
  }
  float sd = sign(float(parity % 2) - 0.5) * ud;
  return sd;
}


#ifdef COMPILE_vertex
  // cf. Builtin uniforms/attributes (https://threejs.org/docs/#api/en/renderers/webgl/WebGLProgram)

  // [ Builtin uniforms ]
  // uniform mat4 modelMatrix;
  uniform mat4 modelViewMatrix;
  uniform mat4 projectionMatrix;
  // uniform mat4 viewMatrix;
  // uniform mat3 normalMatrix;
  // uniform vec3 cameraPosition;

  // [ Builtin attributes ]
  in vec3 position;
  // in vec3 normal;
  // in vec2 uv;

  out vec3 Vert_position;

  void main() {
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    Vert_position = position;
  }
#endif


#ifdef COMPILE_fragment
  // [ Builtin uniforms ]
  // uniform mat4 viewMatrix;
  // uniform vec3 cameraPosition;

  in vec3 Vert_position;
  out vec4 Frag_color;

  void main() {
    vec3 p = normalize(Vert_position);
    mat2x3 dpdw = mat2x3(dFdx(p), dFdy(p));
    float sd = sdMobius432(p, dpdw);
    float aa = 2.0;
    float fac = 1.0 - smoothstep(0.0, 1.0, sd / aa + 0.5);
    vec3 c1 = vec3(0.0, 1.0, 0.5);
    vec3 c2 = vec3(1.0, 0.5, 0.0);
    vec3 color = mixGamma(c1, c2, fac, 2.2);
    Frag_color = vec4(color, 1.0);
  }
#endif
