#include <cstdint>
#include <vector>
#include <xmmintrin.h>

using std::vector;

namespace impl {
  float sum(const vector<float>& v) {
    float result = 0;
    for (auto i = 0; i < v.size(); i++) {
      result += v[i];
    }
    return result;
  }

  float sum_sse(const vector<float>& v) {
    auto ptr = v.data();
    auto end = ptr + v.size();
    auto end_sse = end - ((uintptr_t)end % 16) / 4;

    float result = 0;

    // Before 16 bytes block
    while (((uintptr_t)ptr % 16 == 0) && ptr < end) {
      result += *ptr++;
    }

    // 16 bytes block
    __m128 resultv = {0, 0, 0, 0};
    while (ptr < end) {
      resultv += *reinterpret_cast<const __m128*>(ptr);
      ptr += 4;
    }
    result += resultv[0] + resultv[1] + resultv[2] + resultv[3];

    // After 16 bytes block
    while (ptr < end) {
      result += *ptr++;
    }

    return result;
  }
}
