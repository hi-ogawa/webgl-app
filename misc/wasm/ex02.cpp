#include "ex02_impl.cpp"
#include <vector>
#include <emscripten.h>
#include <emscripten/bind.h>
#include <emscripten/val.h>

using namespace emscripten;
using std::vector;

struct Buffer {
  vector<float> data_;

  Buffer(size_t size) {
    data_.resize(size);
  }

  val data() {
    return val(typed_memory_view(data_.size(), data_.data()));
  }

  float sum() {
    return impl::sum(data_);
  }

  float sum_sse() {
    return impl::sum_sse(data_);
  }
};

EMSCRIPTEN_BINDINGS(ex02) {
  class_<Buffer>("Buffer")
    .constructor<size_t>()
    .function("data", &Buffer::data)
    .function("sum", &Buffer::sum)
    .function("sum_sse", &Buffer::sum_sse);
}
