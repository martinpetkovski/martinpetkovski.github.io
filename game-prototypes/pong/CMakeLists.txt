cmake_minimum_required(VERSION 3.25)
project(pong LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

find_package(Allegro CONFIG REQUIRED)

add_executable(pong src/source.cpp)
target_link_libraries(
    pong
    PRIVATE
        Allegro::allegro
        Allegro::allegro_acodec
        Allegro::allegro_audio
        Allegro::allegro_font
        Allegro::allegro_image
        Allegro::allegro_primitives
        Allegro::allegro_ttf
)

if(MSVC)
    target_compile_options(pong PRIVATE /utf-8)
endif()

add_custom_target(
    copy_pong_assets ALL
    COMMAND
        ${CMAKE_COMMAND} -E copy_directory
        "${CMAKE_CURRENT_SOURCE_DIR}/assets"
        "$<TARGET_FILE_DIR:pong>"
    COMMENT "Copying Pong runtime assets"
)
add_dependencies(pong copy_pong_assets)
