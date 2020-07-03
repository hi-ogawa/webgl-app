cmake_minimum_required(VERSION 3.0.0)
project(project000 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
add_compile_options(-Wall -Wextra)

# glm
add_library(glm INTERFACE)
target_include_directories(glm INTERFACE ${CMAKE_CURRENT_SOURCE_DIR}/../../../thirdparty/glm)

# Catch2
add_library(catch2 ${CMAKE_CURRENT_SOURCE_DIR}/../../../thirdparty/Catch2/examples/000-CatchMain.cpp)
target_include_directories(catch2 PUBLIC ${CMAKE_CURRENT_SOURCE_DIR}/../../../thirdparty/Catch2/single_include)

# executables
add_executable(main main.cpp)
target_link_libraries(main PRIVATE glm catch2)

add_executable(em em.cpp)
target_link_libraries(em PRIVATE glm)
set_target_properties(em PROPERTIES LINK_FLAGS "--bind --pre-js ${CMAKE_CURRENT_SOURCE_DIR}/em-pre.js")
