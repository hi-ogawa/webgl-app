#include <cstdio>
#include <cassert>
#include <catch2/catch.hpp>
#include "misc.hpp"
#include "format.hpp"
#include "rng.hpp"
#include "utils.hpp"

using glm::vec2, glm::mat2;
using glm::vec3, glm::mat3, glm::transpose;

TEST_CASE("jacobi2") {
  mat2 A = mat2(1, 2, 2, 3);
  vec2 u, d;
  misc::jacobi2(A, u, d);
  mat2 D = mat2(d[0], 0, 0, d[1]);
  mat2 U = mat2(u[0], u[1], -u[1], u[0]);
  mat2 UT = transpose(U);

  CHECK(closeTo(U * UT, mat2(1)));
  CHECK(closeTo(U * D * UT, A));

  // [ Debug ]
  if (false) {
    puts("=== jacobi2 ===");
    format::prints("A:\n%s", A);
    format::prints("U:\n%s", U);
    format::prints("D:\n%s", D);
    format::prints("U * UT:\n%s", U * UT);
    format::prints("U * D * UT:\n%s", U * D * UT);
  }
}

TEST_CASE("jacobi3") {
  mat3 A = mat3(
    2, 3, 5,
    3, 5, 7,
    5, 7, 11);
  mat3 _D = A;
  mat3 Q;
  misc::jacobi3(_D, Q);
  mat3 D = mat3(
    _D[0][0], 0, 0,
    0, _D[1][1], 0,
    0, 0, _D[2][2]);
  mat3 QT = transpose(Q);

  CHECK(closeTo(Q * QT, mat3(1)));

  // TODO:
  // Can't we get more precision??
  // The number of iteration doesn't affect since
  // nothing progresses after off-diagonals are zeroed-out.
  CHECK(closeTo(Q * D * QT, A, 1e-3));

  // [ Debug ]
  if (false) {
    format::prints("D:\n%s", D);
    format::prints("Q:\n%s", Q);
    format::prints("Q * QT:\n%s", Q * QT);
    format::prints("Q * D * QT:\n%s", Q * D * QT);
  }
}

TEST_CASE("svd") {
  SECTION("rank2") {
    auto A1 = mat3(
      1, 2, 3,
      4, 5, 6,
      0, 0, 0);
    auto A2 = mat3(
      7, 8, 9,
      10, 11, 12,
      0, 0, 0);
    mat3 A = A1 * transpose(A2);
    mat3 U, VT;
    vec3 _D;
    misc::svd(A, U, VT, _D);
    mat3 D = mat3(
      _D[0], 0, 0,
      0, _D[1], 0,
      0, 0, _D[2]);
    mat3 UT = transpose(U);
    mat3 V = transpose(VT);

    CHECK(closeTo(U * UT, mat3(1)));
    CHECK(closeTo(V * VT, mat3(1)));
    CHECK(closeTo(U * D * VT, A, 1e-3)); // this much of error comes from "jacobi3"

    // [ Debug ]
    if (false) {
      format::prints("A:\n%s", A);
      format::prints("U * D * VT:\n%s", U * D * VT);
    }
  }

  SECTION("random") {
    auto uniformMat3 = [](Rng& rng) {
      return mat3(
        rng.uniform(), rng.uniform(), rng.uniform(),
        rng.uniform(), rng.uniform(), rng.uniform(),
        rng.uniform(), rng.uniform(), rng.uniform());
    };

    Rng rng;
    int n = 1024;
    bool result = true;
    for (auto i = 0; i < n; i++) {
      auto A = uniformMat3(rng);
      mat3 U, VT;
      vec3 _D;
      misc::svd(A, U, VT, _D);
      mat3 D = mat3(
        _D[0], 0, 0,
        0, _D[1], 0,
        0, 0, _D[2]);
      mat3 UT = transpose(U);
      mat3 V = transpose(VT);

      bool check =
        closeTo(U * UT, mat3(1)) &&
        closeTo(V * VT, mat3(1)) &&
        closeTo(U * D * VT, A, 1e-3);
      if (check) { continue; }
      result = false;

      // [ Debug ]
      if (false) {
        format::prints("A:\n%s", A);
        format::prints("U * D * VT:\n%s", U * D * VT);
      }
    }

    CHECK(result);
  }
}
