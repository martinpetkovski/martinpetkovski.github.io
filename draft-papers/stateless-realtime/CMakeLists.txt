cmake_minimum_required(VERSION 3.16)
project(stateless_realtime_benchmarks VERSION 1.0 LANGUAGES C)

set(CMAKE_C_STANDARD 11)
set(CMAKE_C_STANDARD_REQUIRED ON)
set(CMAKE_C_EXTENSIONS OFF)

option(SR_ENABLE_SANITIZERS "Enable AddressSanitizer and UndefinedBehaviorSanitizer" OFF)

add_library(sr_algorithms src/algorithms.c)
target_include_directories(sr_algorithms PUBLIC include)

add_executable(sr_tests tests/test_algorithms.c)
target_link_libraries(sr_tests PRIVATE sr_algorithms)

add_executable(sr_benchmark src/benchmark.c)
target_link_libraries(sr_benchmark PRIVATE sr_algorithms)

if(NOT MSVC)
    target_link_libraries(sr_tests PRIVATE m)
    target_link_libraries(sr_benchmark PRIVATE m)
endif()

foreach(target sr_algorithms sr_tests sr_benchmark)
    if(MSVC)
        target_compile_options(${target} PRIVATE /W4)
    else()
        target_compile_options(${target} PRIVATE -Wall -Wextra -Wpedantic)
    endif()
endforeach()

if(SR_ENABLE_SANITIZERS AND CMAKE_C_COMPILER_ID MATCHES "Clang|GNU")
    foreach(target sr_algorithms sr_tests sr_benchmark)
        target_compile_options(${target} PRIVATE -fsanitize=address,undefined -fno-omit-frame-pointer)
        target_link_options(${target} PRIVATE -fsanitize=address,undefined)
    endforeach()
endif()

string(TOUPPER "${CMAKE_BUILD_TYPE}" SR_BUILD_TYPE_UPPER)
set(SR_ACTIVE_FLAGS "${CMAKE_C_FLAGS} ${CMAKE_C_FLAGS_${SR_BUILD_TYPE_UPPER}}")
set(SR_FLAG_LABEL
    "${CMAKE_C_COMPILER_ID} ${CMAKE_C_COMPILER_VERSION} ${CMAKE_BUILD_TYPE} ${SR_ACTIVE_FLAGS}")
# CMake treats semicolons as list separators, including inside definition values.
string(REPLACE ";" " " SR_FLAG_LABEL "${SR_FLAG_LABEL}")
string(REPLACE "\"" "'" SR_FLAG_LABEL "${SR_FLAG_LABEL}")
target_compile_definitions(sr_benchmark PRIVATE "SR_BUILD_FLAGS=\"${SR_FLAG_LABEL}\"")

if(WIN32)
    target_compile_definitions(sr_benchmark PRIVATE _CRT_SECURE_NO_WARNINGS)
endif()

enable_testing()
add_test(NAME algorithm_equivalence COMMAND sr_tests)
