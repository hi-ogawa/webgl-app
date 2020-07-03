#pragma once

//
// Simple wraper of printf with ostringstream
//

#include <cstdio>
#include <cassert>
#include <string>
#include <sstream>

namespace format {

//
// toScalarOrChars / formatScalarOrString
//

template<typename T, std::enable_if_t<std::is_scalar_v<T>, int> = 0>
inline T toScalarOrChars(T v) {
  return v;
}

inline const char* toScalarOrChars(const std::string& v) {
  return v.c_str();
}

template<typename... Ts>
inline std::string formatScalarOrString(const char* format_str, const Ts&... vs) {
  // safe snprintf call
  int size = std::snprintf(nullptr, 0, format_str, toScalarOrChars(vs)...);
  assert(size >= 0);
  std::string result;
  result.resize(size);
  std::snprintf(result.data(), size + 1, format_str, toScalarOrChars(vs)...);
  return result;
}

//
// toScalarOrString
//

template<typename T, std::enable_if_t<std::is_scalar_v<T>, int> = 0>
inline T toScalarOrString(T v) {
  return v;
}

template<typename T, std::enable_if_t<!std::is_scalar_v<T>, int> = 0>
inline std::string toScalarOrString(const T& v) {
  std::ostringstream result;
  result << v;
  return result.str();
}

//
// format/print/prints
//

template<typename T, typename... Ts>
inline std::string format(const char* fmtstr, const T& v, const Ts&... vs) {
  return formatScalarOrString(fmtstr, toScalarOrString(v), toScalarOrString(vs)...);
}

// This prevents calling snprintf without vararg, which triggers clang warnings.
inline std::string format(const char* fmtstr) {
  return std::string{fmtstr};
}

template<typename... Ts>
inline void print(const char* fmtstr, const Ts&... vs) {
  std::string result = format(fmtstr, vs...);
  std::printf("%s", result.c_str());
}

template<typename... Ts>
inline void prints(const char* fmtstr, const Ts&... vs) {
  std::string result = format(fmtstr, vs...);
  std::printf("%s\n", result.c_str());
}

//
// format/print/prints (const string& variants)
//

template<typename... Ts>
inline std::string format(const std::string& fmtstr, const Ts&... vs) {
  return format(fmtstr.c_str(), vs...);
}

template<typename... Ts>
inline void print(const std::string& fmtstr, const Ts&... vs) {
  print(fmtstr.c_str(), vs...);
}

template<typename... Ts>
inline void prints(const std::string& fmtstr, const Ts&... vs) {
  prints(fmtstr.c_str(), vs...);
}

} // namespace format
