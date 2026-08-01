# Generated benchmark summary

Values are aggregates of independent repetitions. The interval is a two-sided 95% Student-t confidence interval for the repetition-level bulk mean. Maximum is the largest per-update observation.

| Algorithm | Workload | Variant | Parameter | Mean ns (95% CI) | p99 ns | Max ns | Cycles/update | Relative overhead |
|---|---|---|---:|---:|---:|---:|---:|---:|
| crc32_prefix | continuous | explicit_incremental | 64 | 10.86 [9.33, 12.40] | 100 | 200 | 29.2 | -9.2% |
| crc32_prefix | continuous | explicit_incremental | 4096 | 8.04 [5.81, 10.27] | 100 | 303900 | 26.4 | 13.2% |
| crc32_prefix | continuous | full_recompute | 64 | 282.94 [241.13, 324.75] | 400 | 7400 | 676.0 | 2504.5% |
| crc32_prefix | continuous | full_recompute | 4096 | 14109.52 [10442.84, 17776.21] | 53500 | 11709800 | 41745.3 | 175407.5% |
| crc32_prefix | continuous | hidden_incremental | 64 | 11.97 [8.82, 15.12] | 100 | 100 | 28.4 | — |
| crc32_prefix | continuous | hidden_incremental | 4096 | 7.10 [6.17, 8.03] | 100 | 8500 | 25.0 | — |
| game_tick_motion | entities_4096 | explicit_stateful | 1 | 13697.65 [10132.96, 17262.34] | 25000 | 17682800 | 41721.8 | 5.2% |
| game_tick_motion | entities_4096 | explicit_stateful | 16 | 22587.52 [20452.03, 24723.01] | 47000 | 105100 | 84398.5 | -7.5% |
| game_tick_motion | entities_4096 | explicit_stateful | 64 | 32221.71 [27980.34, 36463.07] | 63400 | 4179700 | 110961.1 | -20.3% |
| game_tick_motion | entities_4096 | hidden_stateful | 1 | 13022.67 [10225.93, 15819.40] | 19500 | 821000 | 42655.7 | — |
| game_tick_motion | entities_4096 | hidden_stateful | 16 | 24428.98 [20409.51, 28448.44] | 63800 | 308000 | 82631.5 | — |
| game_tick_motion | entities_4096 | hidden_stateful | 64 | 40415.73 [22280.58, 58550.89] | 85200 | 378200 | 116692.3 | — |
| game_tick_motion | entities_4096 | stateless_replay | 1 | 12536.60 [11229.43, 13843.76] | 36700 | 449200 | 43573.6 | -8.5% |
| game_tick_motion | entities_4096 | stateless_replay | 16 | 192289.35 [162622.35, 221956.34] | 405900 | 1825200 | 636678.7 | 751.3% |
| game_tick_motion | entities_4096 | stateless_replay | 64 | 1171836.22 [906476.90, 1437195.54] | 2573000 | 9391200 | 3569995.2 | 3536.8% |
| pid_controller | continuous | explicit_state | 1 | 4.61 [3.84, 5.38] | 100 | 31900 | 16.2 | 2.2% |
| pid_controller | continuous | hidden_state | 1 | 4.51 [3.83, 5.19] | 100 | 186500 | 16.5 | — |
| rolling_max | continuous | explicit_incremental | 4 | 8.65 [8.41, 8.88] | 100 | 34500 | 32.3 | -25.5% |
| rolling_max | continuous | explicit_incremental | 4096 | 20.42 [14.52, 26.33] | 100 | 5437600 | 60.0 | 7.0% |
| rolling_max | continuous | full_recompute | 4 | 3.80 [3.59, 4.01] | 100 | 27000 | 14.4 | -56.0% |
| rolling_max | continuous | full_recompute | 4096 | 820.36 [626.84, 1013.88] | 1100 | 11354000 | 2648.9 | 3917.0% |
| rolling_max | continuous | hidden_incremental | 4 | 11.60 [11.43, 11.77] | 100 | 57600 | 43.8 | — |
| rolling_max | continuous | hidden_incremental | 4096 | 19.09 [16.50, 21.69] | 100 | 4207400 | 65.0 | — |
| sliding_mean | continuous | explicit_incremental | 4 | 5.46 [5.44, 5.47] | 100 | 15400 | 20.6 | -1.4% |
| sliding_mean | continuous | explicit_incremental | 4096 | 8.77 [6.04, 11.50] | 100 | 215600 | 23.6 | 11.9% |
| sliding_mean | continuous | full_recompute | 4 | 4.09 [3.62, 4.55] | 100 | 16600 | 15.4 | -25.1% |
| sliding_mean | continuous | full_recompute | 4096 | 4714.61 [4035.78, 5393.45] | 4500 | 12554400 | 13348.4 | 53657.3% |
| sliding_mean | continuous | hidden_incremental | 4 | 5.53 [5.36, 5.71] | 100 | 28400 | 20.6 | — |
| sliding_mean | continuous | hidden_incremental | 4096 | 7.84 [6.07, 9.60] | 100 | 2841900 | 25.3 | — |
