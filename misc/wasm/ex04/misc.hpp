#include <vector>
#include <thread>

void sum_ptr(const float* ptr, const float* end, float* result) {
  while (ptr < end) {
    *result += *ptr++;
  }
}

float sum(const std::vector<float>& v) {
  float result = 0.0f;
  sum_ptr(&*v.begin(), &*v.end(), &result);
  return result;
}

float sum_parallel(const std::vector<float>& v) {
  auto begin = v.begin();
  auto size = v.size();
  auto middle = begin + size / 2;
  auto end = begin + size;
  float result1 = 0.0f;
  float result2 = 0.0f;
  std::thread t1(sum_ptr, &*begin, &*middle, &result1);
  std::thread t2(sum_ptr, &*middle, &*end, &result2);
  t1.join();
  t2.join();
  return result1 + result2;
}
