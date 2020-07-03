#pragma once

#include <vector>
#include <glm/glm.hpp>

namespace misc {

using std::vector;
using glm::vec2, glm::mat2, glm::vec3, glm::mat3, glm::uvec3;
static_assert(sizeof(vec3) == 3 * 4, "Make sure `vec3 = float32 x 3`");

void _jacobi2(
    float a, float b, float d,
    float& a_next, float& d_next, float& co, float& si) {
  using glm::sqrt;
  float x = 0.5 * (a - d);
  float y = b;
  float l2 = x * x + y * y;
  float l = sqrt(l2);
  float p = x + l;
  float q = y;
  float r2 = p * p + q * q;
  if (r2 < 1e-14) {
    a_next = a;
    d_next = d;
    co = 1;
    si = 0;
    return;
  }
  float r = sqrt(r2);
  co = p / r;
  si = q / r;
  float co2 = p * p / r2;
  float si2 = q * q / r2;
  float cosi = p * q / r2;
  a_next = a * co2 + d * si2 + 2 * b * cosi;
  d_next = a * si2 + d * co2 - 2 * b * cosi;
}

void jacobi2(const mat2& A, vec2& U, vec2& D) {
  _jacobi2(A[0][0], A[1][0], A[1][1], D[0], D[1], U[0], U[1]);
}

void jacobi3_step(float& a, float& b, float& d, float& e, float& f,vec3& q0, vec3& q1) {
  float co, si;
  _jacobi2(a, b, d, a, d, co, si);
  b = 0;
  float _e = e;
  float _f = f;
  e = co * _e + si * _f;
  f = - si * _e + co * _f;
  vec3 _q0 = q0;
  vec3 _q1 = q1;
  q0 = co * _q0 + si * _q1;
  q1 = - si * _q0 + co * _q1;
}

void jacobi3(mat3& A, mat3& Q) {
  using glm::abs;
  Q = mat3(1.0);

  //
  // Manupulate only these 6 entries of symmetric A
  //   00 01
  //      11 12
  //   20    22
  //

  // Loop fixed amount
  int N = 20;
  for (auto i = 0; i < N; i++) {
    //
    // Find largest off-diagonal entry and apply Givens rotation
    //   A[0][1] ==> jacobi3_step(A[0][0], A[0][1], A[1][1], A[2][0], A[1][2], Q[0], Q[1]);
    //   A[1][2] ==> jacobi3_step(A[1][1], A[1][2], A[2][2], A[0][1], A[2][0], Q[1], Q[2]);
    //   A[2][0] ==> jacobi3_step(A[2][2], A[2][0], A[0][0], A[1][2], A[0][1], Q[2], Q[0]);
    //
    auto a01 = abs(A[0][1]);
    auto a12 = abs(A[1][2]);
    auto a20 = abs(A[2][0]);

    if (a01 < a12) {
      if (a12 < a20) {
        // A[2][0]
        if (a20 < 1e-14) { break; }
        jacobi3_step(A[2][2], A[2][0], A[0][0], A[1][2], A[0][1], Q[2], Q[0]);
        continue;
      }
      // A[1][2]
      if (a12 < 1e-14) { break; }
      jacobi3_step(A[1][1], A[1][2], A[2][2], A[0][1], A[2][0], Q[1], Q[2]);
      continue;
    }

    if (a01 < a20) {
      // A[2][0]
      if (a20 < 1e-14) { break; }
      jacobi3_step(A[2][2], A[2][0], A[0][0], A[1][2], A[0][1], Q[2], Q[0]);
      continue;
    }

    // A[0][1]
    if (a01 < 1e-14) { break; }
    jacobi3_step(A[0][0], A[0][1], A[1][1], A[2][0], A[1][2], Q[0], Q[1]);
  }
}

mat3 outer(const vec3& u, const vec3& v) {
  return mat3(
    u[0] * v[0], u[1] * v[0], u[2] * v[0],
    u[0] * v[1], u[1] * v[1], u[2] * v[1],
    u[0] * v[2], u[1] * v[2], u[2] * v[2]);
}

mat3 outer2(const vec3& u) {
  return outer(u, u);
}

void householderQR(const mat3& A, mat3& Q, mat3& R) {
  using glm::abs, glm::length, glm::normalize;

  mat3 QT = mat3(1);
  R = A;

  // 1st column
  if (!(abs(R[0][1]) < 1e-7 && abs(R[0][2]) < 1e-7)) {
    float l = length(R[0]);
    vec3 h = normalize(R[0] - vec3(l, 0, 0));
    mat3 H = mat3(1.0f) - 2.0f * outer2(h); // I - 2 h hT
    R = H * R;
    QT = H * QT;
  }

  // 2nd column
  if (!(abs(R[1][2]) < 1e-7)) {
    vec2 v = vec2(R[1][1], R[1][2]);
    float l = length(v);
    vec2 h = normalize(v - vec2(l, 0));
    // I - 2 h h^T
    mat3 H = mat3(
      1, 0, 0,
      0, 1 - 2 * h[0] * h[0], - 2 * h[0] * h[1],
      0, - 2 * h[0] * h[1], 1 - 2 * h[1] * h[1]);
    R = H * R;
    QT = H * QT;
  }

  Q = glm::transpose(QT);
}

mat3 permutation(const mat3& A, const uvec3& S) {
  return mat3(A[S[0]], A[S[1]], A[S[2]]);
}

uvec3 _sort(float l0, float l1, float l2) {
  // 3-elements insertion sort
  // [0, (1), 2]
  if (l1 > l0) {
    // [1, 0, (2)]
    if (l2 > l0) {
      // [1, (2), 0]
      if (l2 > l1) {
        return {2, 1, 0};
      }
      return {1, 2, 0};
    }
    return {1, 0, 2};
  }
  // [0, 1, (2)]
  if (l2 > l1) {
    // [0, (2), 1]
    if (l2 > l0) {
      return {2, 0, 1};
    }
    return {0, 2, 1};
  }
  return {0, 1, 2};
}

void sort(const mat3& A, uvec3& S, mat3& AS) {
  using glm::length;
  S = _sort(length(A[0]), length(A[1]), length(A[2]));
  AS = permutation(A, S);
}

// cf. mat3.svdV2 in src/utils/glm.js
//   1. AT A = P W PT (cf. spectral theorem)
//   2. B = A P
//   3. C = B S (where S: permutation s.t. C's colume vectors have decreasing length)
//   4. C = Q R = Q D (cf. QR decomposition where R turns out to be diagonal)
//   5. A = Q D (P S)T
void svd(const mat3& A, mat3& U, mat3& VT, vec3& D) {
  using glm::transpose;

  // 1.
  mat3 AT_A = transpose(A) * A;
  mat3 P;
  jacobi3(/* inout */ AT_A, /* out */ P);

  // 2. 3.
  mat3 B = A * P;
  mat3 C;
  uvec3 S;
  sort(B, /* out */ S, C);

  // 4.
  mat3 Q;
  mat3 R;
  householderQR(C, /* out */ Q, R);

  // 5.
  U = Q;
  D = vec3(R[0][0], R[1][1], R[2][2]);
  VT = transpose(permutation(P, S));
}

mat3 svdProjection(const mat3& A, const mat3& B) {
  using glm::transpose, glm::determinant;
  mat3 B_AT = B * transpose(A);
  mat3 U, VT;
  vec3 D;
  svd(B_AT, U, VT, D);
  mat3 E = mat3(
    1, 0, 0,
    0, 1, 0,
    0, 0, determinant(U) * determinant(VT));
  mat3 U_E_VT = U * E * VT;
  return U_E_VT;
}

void solve(const vector<float>& u1, const vector<float>& u2, vector<float>& result) {
  size_t n = u1.size();
  assert((n % 9 == 0));
  assert(u2.size() == n);
  assert(result.size() == n);

  for (size_t i = 0; i < n; i += 9) {
    auto A = reinterpret_cast<const mat3*>(&*(u1.begin() + i));
    auto B = reinterpret_cast<const mat3*>(&*(u2.begin() + i));
    auto PT = reinterpret_cast<mat3*>(&*(result.begin() + i));
    *PT = svdProjection(*A, *B);
  }
}

} // namespace misc
