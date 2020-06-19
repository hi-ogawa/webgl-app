#include <cassert>
#include <vector>
#include <array>
#include <emscripten.h>
#include <emscripten/bind.h>
#include <emscripten/val.h>

using namespace emscripten;
using std::vector;
using std::array;

template<typename T>
struct Matrix {
  array<size_t, 2> shape_;
  vector<T> data_;

  Matrix() : Matrix(0, 0) {}

  Matrix(size_t shape0, size_t shape1) {
    resize(shape0, shape1);
  }

  void resize(size_t shape0, size_t shape1) {
    shape_ = { shape0, shape1 };
    data_.resize(shape_[0] * shape_[1]);
  }

  T& operator()(size_t i, size_t j) {
    return data_.data()[shape_[1] * i + j];
  }

  const T& operator()(size_t i, size_t j) const {
    return data_.data()[shape_[1] * i + j];
  }

  T get(size_t i, size_t j) {
    return this->operator()(i, j);
  }

  void set(size_t i, size_t j, T v) {
    this->operator()(i, j) = v;
  }

  val data() {
    return val(typed_memory_view(data_.size(), data_.data()));
  }

  static Matrix<T> matmul(const Matrix<T>& a, const Matrix<T>& b) {
    Matrix<T> c;
    c.resize(a.shape_[0], b.shape_[1]);
    matmul_(a, b, c);
    return c;
  }

  static void matmul_(const Matrix<T>& a, const Matrix<T>& b, Matrix<T>& c) {
    assert(c.shape_[0] == a.shape_[0]);
    assert(a.shape_[1] == b.shape_[0]);
    assert(b.shape_[1] == c.shape_[1]);
    for (auto i = 0; i < a.shape_[0]; i++) {
      for (auto j = 0; j < b.shape_[1]; j++) {
        c(i, j) = 0;
        for (auto k = 0; k < a.shape_[1]; k++) {
          c(i, j) += a(i, k) * b(k, j);
        }
      }
    }
  }
};

EMSCRIPTEN_BINDINGS(ex00) {
  class_<Matrix<float>>("Matrix")
    .constructor<>()
    .constructor<size_t, size_t>()
    .function("resize", &Matrix<float>::resize)
    .function("get", &Matrix<float>::get)
    .function("set", &Matrix<float>::set)
    .function("data", &Matrix<float>::data)
    .class_function("matmul", &Matrix<float>::matmul)
    .class_function("matmul_", &Matrix<float>::matmul_);
}
