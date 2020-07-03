#pragma once

#include <glm/glm.hpp>
#include "format.hpp"

//
// glm printf
//

namespace glm {

inline std::ostream& operator<<(std::ostream& os, const glm::vec2& a) {
  os << format::format("[%.5f, %.5f]", a[0], a[1]);
  return os;
}

inline std::ostream& operator<<(std::ostream& os, const glm::vec3& a) {
  os << format::format("[%.5f, %.5f, %.5f]", a[0], a[1], a[2]);
  return os;
}

inline std::ostream& operator<<(std::ostream& os, const glm::uvec3& a) {
  os << format::format("[%d, %d, %d]", a[0], a[1], a[2]);
  return os;
}

inline std::ostream& operator<<(std::ostream& os, const glm::mat2& a) {
  os << format::format("[%s,\n %s]", a[0], a[1]);
  return os;
}

inline std::ostream& operator<<(std::ostream& os, const glm::mat3& a) {
  os << format::format("[%s,\n %s,\n %s]", a[0], a[1], a[2]);
  return os;
}

} // namespace glm

//
// glm const iterator (begin/end)
//

template<typename T>
struct GlmIterator {
  T* ptr;

  T operator*() { return *ptr; }

  GlmIterator& operator++(int) {
    ptr++;
    return *this;
  }

  bool operator==(const GlmIterator& other) {
    return ptr == other.ptr;
  }

  bool operator!=(const GlmIterator& other) {
    return ptr != other.ptr;
  }
};

namespace std {

template<glm::length_t L, typename T>
inline GlmIterator<const T> begin(const glm::vec<L, T>& a) {
  const T* ptr = reinterpret_cast<const T*>(&a[0]);
  return GlmIterator<const T>{ptr};
}

template<glm::length_t L, typename T>
inline GlmIterator<const T> end(const glm::vec<L, T>& a) {
  const T* ptr = reinterpret_cast<const T*>(&a[0]);
  return GlmIterator<const T>{ptr + L};
}

template<glm::length_t C, glm::length_t R, typename T>
inline GlmIterator<const T> begin(const glm::mat<C, R, T>& a) {
  const T* ptr = reinterpret_cast<const T*>(&a[0][0]);
  return GlmIterator<const T>{ptr};
}

template<glm::length_t C, glm::length_t R, typename T>
inline GlmIterator<const T> end(const glm::mat<C, R, T>& a) {
  const T* ptr = reinterpret_cast<const T*>(&a[0][0]);
  return GlmIterator<const T>{ptr + C * R};
}

} // namespace std

//
// closeTo
//

inline bool closeTo(float a, float b, float delta = 1e-5) {
  using glm::abs, glm::max;
  return abs(a - b) <= delta;
}

template<typename Range>
inline bool closeTo(const Range& a, const Range& b, float delta = 1e-5) {
  auto a_it = std::begin(a);
  auto b_it = std::begin(b);
  auto a_end = std::end(a);
  auto b_end = std::end(b);
  bool result = true;
  for (; a_it != a_end; a_it++, b_it++) {
    result = result && closeTo(*a_it, *b_it, delta);
  }
  result = result && (b_it == b_end);
  return result;
}
