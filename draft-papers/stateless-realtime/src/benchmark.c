#include "algorithms.h"

#include <errno.h>
#include <inttypes.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>

#if defined(_WIN32)
#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#endif

#ifndef SR_BUILD_FLAGS
#define SR_BUILD_FLAGS "direct-build"
#endif

typedef enum {
    MODEL_STATELESS = 0,
    MODEL_STATEFUL_EVENT = 1,
    MODEL_TICK_SELECTIVE = 2
} model_kind;

typedef enum {
    PHASE_FRAME_TOTAL = 0,
    PHASE_TICK_ONLY = 1
} phase_kind;

typedef struct {
    size_t entities;
    unsigned change_percent;
    uint32_t rounds;
    const char *workload;
} benchmark_case;

typedef struct {
    sr_game_input *initial;
    sr_game_input *inputs;
    sr_game_output *outputs;
    uint32_t *input_versions;
    uint32_t *evaluated_versions;
    sr_game_change *changes;
    sr_stateful_world stateful;
    sr_hybrid_world hybrid;
    size_t entities;
    uint32_t rounds;
} benchmark_context;

static volatile uint64_t g_sink = 0U;

static uint64_t monotonic_ns(void) {
#if defined(_WIN32)
    static LARGE_INTEGER frequency;
    static int initialized = 0;
    LARGE_INTEGER counter;
    if (!initialized) {
        (void)QueryPerformanceFrequency(&frequency);
        initialized = 1;
    }
    (void)QueryPerformanceCounter(&counter);
    return (uint64_t)((counter.QuadPart * UINT64_C(1000000000)) /
                      frequency.QuadPart);
#else
    struct timespec value;
#if defined(CLOCK_MONOTONIC_RAW)
    (void)clock_gettime(CLOCK_MONOTONIC_RAW, &value);
#else
    (void)clock_gettime(CLOCK_MONOTONIC, &value);
#endif
    return (uint64_t)value.tv_sec * UINT64_C(1000000000) +
           (uint64_t)value.tv_nsec;
#endif
}

static uint64_t thread_cycles(void) {
#if defined(_WIN32)
    ULONG64 cycles = 0U;
    if (QueryThreadCycleTime(GetCurrentThread(), &cycles) == 0) {
        return 0U;
    }
    return (uint64_t)cycles;
#else
    return 0U;
#endif
}

static uint64_t timer_overhead_ns(void) {
    uint64_t best = UINT64_MAX;
    size_t index;
    for (index = 0U; index < 20000U; index++) {
        const uint64_t start = monotonic_ns();
        const uint64_t stop = monotonic_ns();
        if (stop - start < best) {
            best = stop - start;
        }
    }
    return best;
}

static int compare_u64(const void *left, const void *right) {
    const uint64_t a = *(const uint64_t *)left;
    const uint64_t b = *(const uint64_t *)right;
    return (a > b) - (a < b);
}

static uint64_t percentile(const uint64_t *sorted, size_t count, unsigned p) {
    size_t index;
    if (count == 0U) {
        return 0U;
    }
    index = ((size_t)p * count + 99U) / 100U;
    if (index == 0U) {
        index = 1U;
    }
    return sorted[index - 1U];
}

static void initialize_inputs(sr_game_input *inputs, size_t count) {
    size_t entity;
    for (entity = 0U; entity < count; entity++) {
        inputs[entity].seed = (sr_vec3f){
            (float)entity * 0.25f,
            (float)entity * -0.5f,
            10.0f + (float)(entity % 7U)
        };
        inputs[entity].bias = (sr_vec3f){
            0.0002f * (float)(1U + entity % 3U),
            -0.0001f * (float)(1U + entity % 5U),
            0.0003f * (float)(1U + entity % 11U)
        };
    }
}

static int context_create(benchmark_context *context,
                          size_t entities,
                          uint32_t rounds) {
    memset(context, 0, sizeof(*context));
    context->entities = entities;
    context->rounds = rounds;
    context->initial = (sr_game_input *)calloc(entities, sizeof(*context->initial));
    context->inputs = (sr_game_input *)calloc(entities, sizeof(*context->inputs));
    context->outputs = (sr_game_output *)calloc(entities, sizeof(*context->outputs));
    context->input_versions = (uint32_t *)calloc(entities, sizeof(uint32_t));
    context->evaluated_versions = (uint32_t *)calloc(entities, sizeof(uint32_t));
    context->changes = (sr_game_change *)calloc(entities, sizeof(*context->changes));
    if (context->initial == NULL || context->inputs == NULL ||
        context->outputs == NULL || context->input_versions == NULL ||
        context->evaluated_versions == NULL || context->changes == NULL) {
        return -1;
    }
    initialize_inputs(context->initial, entities);
    return 0;
}

static void context_destroy(benchmark_context *context) {
    free(context->initial);
    free(context->inputs);
    free(context->outputs);
    free(context->input_versions);
    free(context->evaluated_versions);
    free(context->changes);
    memset(context, 0, sizeof(*context));
}

static int context_reset(benchmark_context *context, model_kind model) {
    memcpy(context->inputs, context->initial,
           context->entities * sizeof(*context->inputs));
    memset(context->outputs, 0,
           context->entities * sizeof(*context->outputs));
    if (model == MODEL_STATELESS) {
        sr_game_stateless_tick(context->inputs, context->entities,
                               context->rounds, context->outputs);
        return 0;
    }
    if (model == MODEL_STATEFUL_EVENT) {
        return sr_game_stateful_init(&context->stateful, context->inputs,
                                     context->outputs, context->entities,
                                     context->rounds);
    }
    return sr_game_hybrid_init(&context->hybrid, context->inputs,
                               context->outputs, context->input_versions,
                               context->evaluated_versions, context->entities,
                               context->rounds);
}

static size_t case_change_count(size_t entities, unsigned change_percent) {
    size_t count;
    if (change_percent == 0U) {
        return 0U;
    }
    count = (entities * (size_t)change_percent + 99U) / 100U;
    return count > entities ? entities : count;
}

static void prepare_changes(benchmark_context *context,
                            size_t frame,
                            size_t change_count) {
    size_t index;
    for (index = 0U; index < change_count; index++) {
        const size_t entity = (frame * 131U + index * 17U) % context->entities;
        sr_game_change *change = &context->changes[index];
        change->entity = (uint32_t)entity;
        change->value = context->initial[entity];
        change->value.seed.x += (float)(1U + frame % 1009U) * 0.0001f;
        change->value.seed.y -= (float)(1U + frame % 257U) * 0.0002f;
        change->value.bias.z += (float)(1U + index % 31U) * 0.0000001f;
    }
}

static uint64_t execute_tick(benchmark_context *context, model_kind model) {
    if (model == MODEL_STATELESS) {
        sr_game_stateless_tick(context->inputs, context->entities,
                               context->rounds, context->outputs);
        return context->outputs[context->entities / 2U].derived.x != 0.0f;
    }
    if (model == MODEL_STATEFUL_EVENT) {
        return sr_game_stateful_tick(&context->stateful);
    }
    return sr_game_hybrid_tick(&context->hybrid);
}

static void apply_outside_tick(benchmark_context *context,
                               model_kind model,
                               size_t change_count) {
    if (model == MODEL_STATELESS) {
        sr_game_apply_changes(context->inputs, context->entities,
                              context->changes, change_count);
    } else if (model == MODEL_STATEFUL_EVENT) {
        sr_game_stateful_dispatch(&context->stateful, context->changes,
                                  change_count);
    } else {
        sr_game_hybrid_mark_changes(&context->hybrid, context->changes,
                                    change_count);
    }
}

static uint64_t measure_one(benchmark_context *context,
                            model_kind model,
                            phase_kind phase,
                            size_t change_count,
                            uint64_t overhead) {
    uint64_t start;
    uint64_t stop;
    uint64_t token;
    if (phase == PHASE_TICK_ONLY) {
        apply_outside_tick(context, model, change_count);
        start = monotonic_ns();
        token = execute_tick(context, model);
        stop = monotonic_ns();
    } else {
        start = monotonic_ns();
        apply_outside_tick(context, model, change_count);
        token = execute_tick(context, model);
        stop = monotonic_ns();
    }
    g_sink ^= token;
    return stop - start > overhead ? stop - start - overhead : 0U;
}

static const char *model_name(model_kind model) {
    if (model == MODEL_STATELESS) {
        return "stateless_full";
    }
    if (model == MODEL_STATEFUL_EVENT) {
        return "stateful_event";
    }
    return "tick_selective";
}

static const char *phase_name(phase_kind phase) {
    return phase == PHASE_TICK_ONLY ? "tick_only" : "frame_total";
}

static size_t sample_count_for_case(const benchmark_case *test_case) {
    const uint64_t arithmetic = (uint64_t)test_case->entities *
                                (uint64_t)test_case->rounds *
                                SR_ARITHMETIC_PER_ROUND;
    const int calibration = strcmp(test_case->workload,
                                   "arithmetic_calibration") == 0;
    uint64_t count = arithmetic == 0U ? 2001U :
                     (calibration ? UINT64_C(30000000) : UINT64_C(80000000)) /
                     arithmetic;
    if (count < (calibration ? 31U : 101U)) {
        count = calibration ? 31U : 101U;
    }
    if (count > 2001U) {
        count = 2001U;
    }
    return (size_t)count;
}

static int write_case(FILE *output,
                      const benchmark_case *test_case,
                      model_kind model,
                      phase_kind phase,
                      unsigned repetition,
                      uint64_t overhead) {
    benchmark_context context;
    const size_t sample_count = sample_count_for_case(test_case);
    const size_t change_count = case_change_count(test_case->entities,
                                                  test_case->change_percent);
    uint64_t *samples = NULL;
    uint64_t sum = 0U;
    uint64_t cycle_start;
    uint64_t cycle_stop;
    uint64_t checksum;
    uint64_t arithmetic_entities;
    uint64_t arithmetic_count;
    uint64_t miss_100us = 0U;
    uint64_t miss_1ms = 0U;
    uint64_t miss_frame = 0U;
    size_t index;
    size_t persistent_bytes;
    size_t temporary_bytes;
    size_t event_bytes;
    unsigned call_depth;

    if (context_create(&context, test_case->entities, test_case->rounds) != 0) {
        fprintf(stderr, "allocation failed for %zu entities\n", test_case->entities);
        return -1;
    }
    samples = (uint64_t *)calloc(sample_count, sizeof(*samples));
    if (samples == NULL || context_reset(&context, model) != 0) {
        free(samples);
        context_destroy(&context);
        return -1;
    }

    for (index = 0U; index < 32U; index++) {
        prepare_changes(&context, index, change_count);
        (void)measure_one(&context, model, phase, change_count, overhead);
    }
    cycle_start = thread_cycles();
    for (index = 0U; index < sample_count; index++) {
        const size_t frame = index + 32U + (size_t)repetition * 4099U;
        prepare_changes(&context, frame, change_count);
        samples[index] = measure_one(&context, model, phase,
                                     change_count, overhead);
        sum += samples[index];
        miss_100us += samples[index] > UINT64_C(100000);
        miss_1ms += samples[index] > UINT64_C(1000000);
        miss_frame += samples[index] > UINT64_C(16666667);
    }
    cycle_stop = thread_cycles();
    checksum = sr_game_checksum(context.outputs, context.entities);
    g_sink ^= checksum;
    qsort(samples, sample_count, sizeof(*samples), compare_u64);

    arithmetic_entities = model == MODEL_STATELESS ?
                          test_case->entities : change_count;
    arithmetic_count = arithmetic_entities * test_case->rounds *
                       SR_ARITHMETIC_PER_ROUND;
    temporary_bytes = 0U;
    event_bytes = 0U;
    if (model == MODEL_STATELESS) {
        persistent_bytes = sizeof(sr_game_input) * test_case->entities;
        temporary_bytes = sizeof(sr_game_output) * test_case->entities;
        call_depth = 3U;
    } else if (model == MODEL_STATEFUL_EVENT) {
        persistent_bytes = (sizeof(sr_game_input) + sizeof(sr_game_output)) *
                           test_case->entities;
        event_bytes = sizeof(sr_game_change) * change_count;
        call_depth = 4U;
    } else {
        persistent_bytes = (sizeof(sr_game_input) + sizeof(sr_game_output) +
                            2U * sizeof(uint32_t)) * test_case->entities;
        event_bytes = sizeof(sr_game_change) * change_count;
        call_depth = 3U;
    }

    fprintf(output,
            "derived_vectors,%s,%s,%s,%zu,%u,%" PRIu32 ",%u,%zu,%zu,"
            "%" PRIu64 ",%" PRIu64 ",%.3f,%" PRIu64 ",%" PRIu64 ",%" PRIu64 ",%" PRIu64 ","
            "%.3f,%.3f,%" PRIu64 ",%" PRIu64 ",%" PRIu64 ",%zu,%zu,%zu,%zu,%u,%" PRIu64 "\n",
            test_case->workload, model_name(model), phase_name(phase),
            test_case->entities, test_case->change_percent, test_case->rounds,
            repetition, sample_count, change_count, arithmetic_count,
            arithmetic_entities,
            (double)sum / (double)sample_count,
            percentile(samples, sample_count, 50U),
            percentile(samples, sample_count, 95U),
            percentile(samples, sample_count, 99U),
            samples[sample_count - 1U],
            sum == 0U ? 0.0 : (double)sample_count * 1.0e9 / (double)sum,
            cycle_stop > cycle_start ?
                (double)(cycle_stop - cycle_start) / (double)sample_count : 0.0,
            miss_100us, miss_1ms, miss_frame,
            persistent_bytes, temporary_bytes, event_bytes,
            persistent_bytes + temporary_bytes + event_bytes,
            call_depth, checksum);

    free(samples);
    context_destroy(&context);
    return 0;
}

static void usage(const char *program) {
    fprintf(stderr,
            "usage: %s [--profile quick|full] [--repetitions N] [--output FILE]\n",
            program);
}

int main(int argc, char **argv) {
    static const size_t full_entities[] = {64U, 256U, 1024U, 4096U};
    static const unsigned full_changes[] = {0U, 1U, 10U, 100U};
    static const uint32_t calibration_rounds[] = {
        1U, 4U, 16U, 64U, 96U, 128U, 160U, 192U, 256U, 1024U
    };
    const char *profile = "quick";
    const char *output_path = "results/raw-game-models.csv";
    unsigned repetitions = 7U;
    FILE *output;
    uint64_t overhead;
    int argument;
    size_t entity_index;
    size_t change_index;
    unsigned repetition;
    int model_value;
    int phase_value;

    for (argument = 1; argument < argc; argument++) {
        if (strcmp(argv[argument], "--profile") == 0 && argument + 1 < argc) {
            profile = argv[++argument];
        } else if (strcmp(argv[argument], "--repetitions") == 0 &&
                   argument + 1 < argc) {
            repetitions = (unsigned)strtoul(argv[++argument], NULL, 10);
            if (repetitions == 0U) {
                usage(argv[0]);
                return EXIT_FAILURE;
            }
        } else if (strcmp(argv[argument], "--output") == 0 &&
                   argument + 1 < argc) {
            output_path = argv[++argument];
        } else {
            usage(argv[0]);
            return EXIT_FAILURE;
        }
    }
    if (strcmp(profile, "quick") != 0 && strcmp(profile, "full") != 0) {
        usage(argv[0]);
        return EXIT_FAILURE;
    }
    if (strcmp(profile, "full") == 0 && repetitions == 7U) {
        repetitions = 11U;
    }

    output = fopen(output_path, "w");
    if (output == NULL) {
        fprintf(stderr, "cannot open %s: %s\n", output_path, strerror(errno));
        return EXIT_FAILURE;
    }
    fprintf(output,
            "algorithm,workload,variant,phase,entities,change_percent,work_rounds,"
            "repetition,samples,changed_entities,arithmetic_per_tick,recomputed_entities,"
            "mean_ns,median_ns,p95_ns,p99_ns,maximum_ns,throughput_per_s,cycles_per_tick,"
            "miss_100us,miss_1ms,miss_16_67ms,persistent_bytes,temporary_bytes,event_bytes,"
            "working_bytes,source_call_depth,checksum\n");
    overhead = timer_overhead_ns();

    for (entity_index = 0U;
         entity_index < (strcmp(profile, "full") == 0 ? 4U : 2U);
         entity_index++) {
        for (change_index = 0U;
             change_index < (strcmp(profile, "full") == 0 ? 4U : 2U);
             change_index++) {
            benchmark_case test_case;
            test_case.entities = full_entities[entity_index];
            test_case.change_percent = full_changes[change_index];
            test_case.rounds = 16U;
            test_case.workload = "change_density";
            for (repetition = 1U; repetition <= repetitions; repetition++) {
                for (phase_value = (int)PHASE_FRAME_TOTAL;
                     phase_value <= (int)PHASE_TICK_ONLY; phase_value++) {
                    for (model_value = (int)MODEL_STATELESS;
                         model_value <= (int)MODEL_TICK_SELECTIVE; model_value++) {
                        if (write_case(output, &test_case,
                                       (model_kind)model_value,
                                       (phase_kind)phase_value,
                                       repetition, overhead) != 0) {
                            fclose(output);
                            return EXIT_FAILURE;
                        }
                    }
                }
            }
        }
    }

    if (strcmp(profile, "full") == 0) {
        size_t round_index;
        for (round_index = 0U;
             round_index < sizeof(calibration_rounds) /
                           sizeof(calibration_rounds[0]);
             round_index++) {
            benchmark_case test_case;
            test_case.entities = 4096U;
            test_case.change_percent = 100U;
            test_case.rounds = calibration_rounds[round_index];
            test_case.workload = "arithmetic_calibration";
            for (repetition = 1U; repetition <= repetitions; repetition++) {
                for (phase_value = (int)PHASE_FRAME_TOTAL;
                     phase_value <= (int)PHASE_TICK_ONLY; phase_value++) {
                    for (model_value = (int)MODEL_STATELESS;
                         model_value <= (int)MODEL_TICK_SELECTIVE; model_value++) {
                        if (write_case(output, &test_case,
                                       (model_kind)model_value,
                                       (phase_kind)phase_value,
                                       repetition, overhead) != 0) {
                            fclose(output);
                            return EXIT_FAILURE;
                        }
                    }
                }
            }
        }
    }
    if (fclose(output) != 0) {
        return EXIT_FAILURE;
    }
    printf("Wrote benchmark CSV to %s with timer overhead %" PRIu64
           " ns and sink %" PRIu64 " (%s; %s).\n",
           output_path, overhead, g_sink, profile, SR_BUILD_FLAGS);
    return EXIT_SUCCESS;
}
