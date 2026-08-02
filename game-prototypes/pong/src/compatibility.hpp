#pragma once

#include <charconv>
#include <cstdio>
#include <cstdlib>
#include <ctime>

// itoa was available in the original Windows toolchain but is not standard C++.
inline char* itoa(int value, char* buffer, int radix)
{
    const auto result = std::to_chars(buffer, buffer + 33, value, radix);
    if (result.ec == std::errc())
        *result.ptr = '\0';
    else
        *buffer = '\0';
    return buffer;
}

