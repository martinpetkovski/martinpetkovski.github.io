# Generated benchmark summary

Values are aggregates of independent repetitions. The interval is a two-sided 95% Student-t confidence interval for the repetition-level bulk mean. Maximum is the largest per-update observation.

| Algorithm | Variant | Parameter | Mean ns (95% CI) | p99 ns | Max ns | Cycles/update | Relative overhead |
|---|---|---:|---:|---:|---:|---:|---:|
| crc32_prefix | explicit_incremental | 64 | 4.46 [3.47, 5.46] | 100 | 100 | 29.6 | -4.8% |
| crc32_prefix | explicit_incremental | 4096 | 3.85 [3.83, 3.86] | 100 | 300 | 14.9 | 0.3% |
| crc32_prefix | full_recompute | 64 | 126.79 [122.42, 131.16] | 300 | 300 | 491.9 | 2739.8% |
| crc32_prefix | full_recompute | 4096 | 8360.87 [8335.42, 8386.32] | 16600 | 54800 | 31689.3 | 217242.9% |
| crc32_prefix | hidden_incremental | 64 | 4.69 [3.24, 6.13] | 100 | 100 | 29.6 | — |
| crc32_prefix | hidden_incremental | 4096 | 3.84 [3.83, 3.84] | 100 | 300 | 14.9 | — |
| pid_controller | explicit_state | 1 | 3.40 [3.15, 3.65] | 100 | 24800 | 12.9 | -2.7% |
| pid_controller | hidden_state | 1 | 3.49 [3.18, 3.80] | 100 | 8400 | 13.8 | — |
| rolling_max | explicit_incremental | 4 | 10.58 [9.86, 11.31] | 100 | 7600 | 40.3 | 14.4% |
| rolling_max | explicit_incremental | 4096 | 11.79 [10.32, 13.25] | 100 | 2000 | 41.3 | 15.7% |
| rolling_max | full_recompute | 4 | 3.99 [3.29, 4.69] | 100 | 32900 | 14.7 | -62.3% |
| rolling_max | full_recompute | 4096 | 391.64 [380.68, 402.60] | 600 | 163100 | 1482.5 | 3222.6% |
| rolling_max | hidden_incremental | 4 | 9.25 [8.99, 9.50] | 100 | 300 | 35.5 | — |
| rolling_max | hidden_incremental | 4096 | 10.19 [9.98, 10.39] | 100 | 9800 | 38.9 | — |
| sliding_mean | explicit_incremental | 4 | 5.43 [5.39, 5.48] | 100 | 20900 | 20.7 | -0.1% |
| sliding_mean | explicit_incremental | 4096 | 4.74 [4.52, 4.97] | 100 | 14300 | 18.0 | 1.7% |
| sliding_mean | full_recompute | 4 | 4.66 [3.89, 5.44] | 100 | 1100 | 17.2 | -14.2% |
| sliding_mean | full_recompute | 4096 | 2283.75 [2264.07, 2303.43] | 3000 | 92400 | 8624.1 | 48050.0% |
| sliding_mean | hidden_incremental | 4 | 5.44 [5.43, 5.45] | 100 | 11000 | 20.8 | — |
| sliding_mean | hidden_incremental | 4096 | 4.66 [4.64, 4.68] | 100 | 400 | 17.8 | — |
