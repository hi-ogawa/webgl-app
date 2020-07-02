#include <emscripten.h>
#include <emscripten/bind.h>
#include <emscripten/val.h>
#include "misc.hpp" // sum, sum_parallel

using namespace emscripten;

template<typename T>
val Vector_data(const std::vector<T>& self) {
  return val(typed_memory_view(self.size(), self.data()));
}

EMSCRIPTEN_BINDINGS(ex04) {
  register_vector<float>("Vectorf")
    .function("data", &Vector_data<float>)
    .function("sum", &sum)
    .function("sum_parallel", &sum_parallel);
}
