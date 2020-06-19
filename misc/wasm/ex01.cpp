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

  val data() { return val(typed_memory_view(data_.size(), data_.data())); }

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


  static Matrix<T> matmul(const Matrix<T>& a, const Matrix<T>& b) {
    Matrix<T> c{a.shape_[0], b.shape_[1]};
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

template<typename T>
struct MatrixCSR {
  size_t shape_[2];
  vector<size_t> indptr_;
  vector<size_t> indices_;
  vector<T> data_;

  val indptr() { return val(typed_memory_view(indptr_.size(), indptr_.data())); }
  val indices() { return val(typed_memory_view(indices_.size(), indices_.data())); }
  val data() { return val(typed_memory_view(data_.size(), data_.data())); }

  MatrixCSR(size_t shape0, size_t shape1, size_t nnz)
    : shape_{shape0, shape1} {
    indptr_.resize(shape0 + 1);
    indices_.resize(nnz);
    data_.resize(nnz);
  }

  // c = a b
  static Matrix<T> matmul(const MatrixCSR<T>& a, const Matrix<T>& b) {
    Matrix<T> c{a.shape_[0], b.shape_[1]};
    matmul_(a, b, c);
    return c;
  }

  // y = A x
  static void matmul_(const MatrixCSR<T>& A, const Matrix<T>& x, Matrix<T>& y) {
    assert(y.shape_[0] == A.shape_[0]);
    assert(A.shape_[1] == x.shape_[0]);
    assert(x.shape_[1] == y.shape_[1]);
    size_t p = 0;
    for (auto i = 0; i < A.shape_[0]; i++) { // Loop A row
      for (; p < A.indptr_[i + 1]; p++) { // Loop A col
        size_t j = A.indices_[p];
        T Aij = A.data_[p];
        for (auto k = 0; k < x.shape_[1]; k++) { // Loop x col
          y(i, k) += Aij * x(j, k);
        }
      }
    }
  }

  // A x = b
  static void stepGaussSeidel(const MatrixCSR<T>& A, Matrix<T>& x, const Matrix<T>& b) {
    for (auto i = 0; i < A.shape_[0]; i++) { // Loop A row
      for (auto k = 0; k < x.shape_[1]; k++) { // Loop X col
        T diag = 0;
        T rhs = b(i, k);
        for (auto p = A.indptr_[i]; p < A.indptr_[i + 1]; p++) { // Loop A col
          size_t j = A.indices_[p];
          T Aij = A.data_[p];

          if (j == i) {
            diag += Aij; // Don't assume indices are unique
            continue;
          }

          rhs -= Aij * x(j, k);
        }
        x(i, k) = rhs / diag;
      }
    }
  }

  static void gaussSeidel(const MatrixCSR<T>& A, Matrix<T>& x, const Matrix<T>& b, int iteration) {
    for (auto i = 0; i < iteration; i++) {
      stepGaussSeidel(A, x, b);
    }
  }
};

EMSCRIPTEN_BINDINGS(ex01) {
  class_<Matrix<float>>("Matrix")
    .constructor<size_t, size_t>()
    .function("resize", &Matrix<float>::resize)
    .function("data", &Matrix<float>::data)
    .class_function("matmul", &Matrix<float>::matmul)
    .class_function("matmul_", &Matrix<float>::matmul_);

  class_<MatrixCSR<float>>("MatrixCSR")
    .constructor<size_t, size_t, size_t>()
    .function("indptr", &MatrixCSR<float>::indptr)
    .function("indices", &MatrixCSR<float>::indices)
    .function("data", &MatrixCSR<float>::data)
    .class_function("matmul", &MatrixCSR<float>::matmul)
    .class_function("matmul_", &MatrixCSR<float>::matmul_)
    .class_function("stepGaussSeidel", &MatrixCSR<float>::stepGaussSeidel)
    .class_function("gaussSeidel", &MatrixCSR<float>::gaussSeidel);
}
