#include <cstdio>
#include <vector>
#include "misc.hpp" // sum, sum_parallel

int main() {
  std::vector<float> v{1 << 20, 1.0f};
  printf("sum = %f\n", sum(v));
  printf("sum_parallel = %f\n", sum_parallel(v));
  return 0;
}
