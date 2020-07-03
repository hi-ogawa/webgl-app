#include <emscripten.h>
#include <emscripten/bind.h>
#include <emscripten/val.h>
#include "misc.hpp"

using namespace emscripten;

template<typename T>
val Vector_data(const std::vector<T>& self) {
  return val(typed_memory_view(self.size(), self.data()));
}

template<typename T>
std::vector<T> Vector_zeros(size_t n) {
  std::vector<T> a;
  a.resize(n, 0);
  return a;
}

EMSCRIPTEN_BINDINGS(ex05) {
  register_vector<float>("Vector")
    .function("data", &Vector_data<float>)
    .class_function("zeros", &Vector_zeros<float>);

  function("solve", &misc::solve);
}
