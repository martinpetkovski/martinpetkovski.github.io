# Game-state execution-model benchmark

This is the reproducibility package for “Recompute, Dispatch, or Check? A
Game-Tick Study of Stateless and Event-Driven State.”

The package contains only video-game benchmark evidence. A derived vec3 game
state is evaluated under three models:

1. stateless_full: every entity is completely rebuilt inside Tick.
2. stateful_event: changed entities are recomputed by dispatcher/handler calls
   outside Tick; Tick consumes a cache.
3. tick_selective: changes increment versions outside Tick; Tick scans every
   entity and recomputes only version mismatches. This is the formal name for
   the phrase “stateless with events”; the complete model remains stateful
   because it retains cache and version metadata.

One work round performs one component-wise vec3 multiplication and one vec3
addition: six source-level scalar arithmetic operations. The benchmark varies
entity count, change density, and work rounds independently, and emits both
frame_total and tick_only timing rows.

## Build and test

GCC or Clang:

~~~sh
cmake -S . -B build -DCMAKE_BUILD_TYPE=Release
cmake --build build --config Release
ctest --test-dir build -C Release --output-on-failure
~~~

Direct Clang:

~~~sh
clang -std=c11 -O2 -Wall -Wextra -Wpedantic -Iinclude \
  src/algorithms.c tests/test_algorithms.c -lm -o build/sr_tests
clang -std=c11 -O3 -Wall -Wextra -Wpedantic -Iinclude \
  src/algorithms.c src/benchmark.c -lm -o build/sr_benchmark
~~~

On Windows, omit -lm and define _CRT_SECURE_NO_WARNINGS.

Sanitizers:

~~~sh
cmake -S . -B build-asan -DCMAKE_BUILD_TYPE=Debug \
  -DSR_ENABLE_SANITIZERS=ON
cmake --build build-asan
ctest --test-dir build-asan --output-on-failure
~~~

## Run and analyze

~~~sh
./build/sr_benchmark --profile quick --repetitions 7 \
  --output results/raw-game-smoke.csv
./build/sr_benchmark --profile full --repetitions 11 \
  --output results/raw-game-models-final.csv
python tools/analyze.py results/raw-game-models-final.csv \
  results/game-models-final
~~~

The final run contains 1,716 raw rows and 156 aggregate groups.
results/game-models-final/summary.csv contains confidence intervals, tail
latency, deadline misses, operation counts, allocations, and ratios.
noticeable-threshold.csv identifies sampled 1 ms p99 crossings. Five SVG
figures are generated with the Python standard library.

## Measurement semantics

- frame_total times input application, evaluation, and Tick consumption.
- tick_only applies changes before timing. It excludes stateful dispatch but
  retains stateless and selective evaluation in Tick.
- Change generation, allocation, initialization, checksums, I/O, and
  formatting are outside QPC timing.
- The Windows cycle field includes deterministic change preparation; it is
  contextual, not a phase-specific instruction count.
- Maximum observed latency is not formal WCET.
- The 1 ms p99 line is an engineering proxy, not a universal perception
  threshold.

## Memory accounting

Measured ABI sizes are 24 bytes per canonical input, 12 per derived output, 28
per change event, and 4 per version. Working memory is 36E bytes for full
stateless, 36E + 28C for stateful event, and 44E + 28C for Tick-selective.
There is no allocation inside an update. RSS is omitted because page
granularity is too coarse.

## Files

- include/algorithms.h: public model API.
- src/algorithms.c: all three implementations.
- tests/test_algorithms.c: equivalence, boundaries, long-run, and missed-event
  fault tests.
- src/benchmark.c: timer, matrix, phases, percentiles, operation/memory counts,
  deadlines, checksums, and CSV.
- tools/analyze.py: aggregation, threshold extraction, and SVGs.
- results/environment.txt: host and methodological notes.
- results/raw-game-models-final.csv: final measured data.
- results/game-models-final/: aggregate data and figures.

## Optional Linux counters

~~~sh
perf stat -r 7 \
  -e cycles,instructions,branches,branch-misses,cache-references,cache-misses \
  ./build/sr_benchmark --profile full --repetitions 1 \
  --output results/perf-run.csv
~~~

Record affinity, governor, turbo policy, kernel, compiler, permissions, and
event multiplexing alongside counter results.
