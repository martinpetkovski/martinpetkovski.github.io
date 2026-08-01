# Generated benchmark summary

Values are aggregates of independent repetitions. The interval is a two-sided 95% Student-t confidence interval for the repetition-level bulk mean. Maximum is the largest per-update observation.

| Algorithm | Variant | Parameter | Mean ns (95% CI) | p99 ns | Max ns | Cycles/update | Relative overhead |
|---|---|---:|---:|---:|---:|---:|---:|
| crc32_prefix | explicit_incremental | 64 | 3.98 [3.43, 4.53] | 100 | 100 | 29.6 | -6.7% |
| crc32_prefix | explicit_incremental | 4096 | 3.96 [3.68, 4.24] | 100 | 1100 | 14.8 | -1.7% |
| crc32_prefix | full_recompute | 64 | 125.85 [122.66, 129.05] | 300 | 400 | 486.0 | 3064.1% |
| crc32_prefix | full_recompute | 4096 | 8372.36 [8343.39, 8401.32] | 16500 | 120400 | 31621.5 | 211114.7% |
| crc32_prefix | hidden_incremental | 64 | 4.26 [3.31, 5.21] | 100 | 100 | 29.6 | — |
| crc32_prefix | hidden_incremental | 4096 | 4.03 [3.61, 4.45] | 100 | 500 | 14.9 | — |
| pid_controller | explicit_state | 1 | 3.53 [3.19, 3.87] | 100 | 16700 | 12.7 | -2.4% |
| pid_controller | hidden_state | 1 | 3.62 [3.22, 4.01] | 100 | 28600 | 12.8 | — |
| rolling_max | explicit_incremental | 4 | 9.24 [8.61, 9.87] | 100 | 17100 | 33.4 | -20.5% |
| rolling_max | explicit_incremental | 4096 | 10.14 [9.62, 10.66] | 100 | 78900 | 37.6 | -17.0% |
| rolling_max | full_recompute | 4 | 3.56 [3.43, 3.68] | 100 | 15200 | 13.1 | -61.5% |
| rolling_max | full_recompute | 4096 | 471.44 [450.17, 492.71] | 700 | 33800 | 1721.6 | 4551.3% |
| rolling_max | hidden_incremental | 4 | 11.62 [11.51, 11.73] | 100 | 22100 | 43.7 | — |
| rolling_max | hidden_incremental | 4096 | 12.22 [11.68, 12.76] | 100 | 41000 | 46.5 | — |
| sliding_mean | explicit_incremental | 4 | 5.46 [5.41, 5.52] | 100 | 21900 | 20.6 | -0.7% |
| sliding_mean | explicit_incremental | 4096 | 5.44 [5.38, 5.50] | 100 | 26900 | 20.5 | 0.2% |
| sliding_mean | full_recompute | 4 | 3.82 [3.60, 4.03] | 100 | 12400 | 14.2 | -30.2% |
| sliding_mean | full_recompute | 4096 | 2711.53 [2688.91, 2734.16] | 3300 | 348500 | 10232.8 | 49743.5% |
| sliding_mean | hidden_incremental | 4 | 5.50 [5.43, 5.57] | 100 | 27400 | 20.7 | — |
| sliding_mean | hidden_incremental | 4096 | 5.43 [5.36, 5.50] | 100 | 16100 | 20.4 | — |
