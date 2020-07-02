cmake_minimum_required(VERSION 3.0.0)
project(project000 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)

add_executable(main main.cpp)
set_target_properties(main PROPERTIES
  COMPILE_FLAGS "-s USE_PTHREADS=1"
  LINK_FLAGS "-s USE_PTHREADS=1 -s PTHREAD_POOL_SIZE=4") # cf. https://github.com/emscripten-core/emscripten/issues/8988

add_executable(em em.cpp)
set_target_properties(em PROPERTIES
  COMPILE_FLAGS "-s USE_PTHREADS=1"
  LINK_FLAGS "--bind -s ALLOW_MEMORY_GROWTH=1 -s USE_PTHREADS=1 -s PTHREAD_POOL_SIZE=4")
