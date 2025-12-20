cmake_minimum_required(VERSION 3.20)

project(ytcut LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

add_executable(ytcut ytcut.cpp)

if (MSVC)
  target_compile_options(ytcut PRIVATE /W4 /EHsc /utf-8)
else()
  target_compile_options(ytcut PRIVATE -Wall -Wextra -Wpedantic)
endif()
