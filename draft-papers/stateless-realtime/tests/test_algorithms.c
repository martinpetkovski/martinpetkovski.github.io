#include "algorithms.h"

#include <math.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#define CHECK(condition) do { \
    if (!(condition)) { \
        fprintf(stderr, "FAIL %s:%d: %s\n", __FILE__, __LINE__, #condition); \
        return 1; \
    } \
} while (0)

static int close_float(float left, float right) {
    const float scale = fmaxf(1.0f, fmaxf(fabsf(left), fabsf(right)));
    return fabsf(left - right) <= 2.0e-6f * scale;
}

static int outputs_equal(const sr_game_output *left,
                         const sr_game_output *right,
                         size_t count) {
    size_t entity;
    for (entity = 0U; entity < count; entity++) {
        if (!close_float(left[entity].derived.x, right[entity].derived.x) ||
            !close_float(left[entity].derived.y, right[entity].derived.y) ||
            !close_float(left[entity].derived.z, right[entity].derived.z)) {
            return 0;
        }
    }
    return 1;
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

static int test_initialization_and_boundaries(void) {
    sr_stateful_world stateful;
    sr_hybrid_world hybrid;
    sr_game_input input[1];
    sr_game_output output[1];
    uint32_t versions[1];
    initialize_inputs(input, 1U);
    CHECK(sr_game_stateful_init(NULL, input, output, 1U, 1U) != 0);
    CHECK(sr_game_stateful_init(&stateful, NULL, output, 1U, 1U) != 0);
    CHECK(sr_game_stateful_init(&stateful, input, output, 0U, 1U) != 0);
    CHECK(sr_game_stateful_init(&stateful, input, output,
                                SR_MAX_ENTITIES + 1U, 1U) != 0);
    CHECK(sr_game_hybrid_init(&hybrid, input, output, versions, versions,
                              1U, 0U) != 0);
    CHECK(sr_game_hybrid_init(&hybrid, input, output, NULL, versions,
                              1U, 1U) != 0);
    sr_game_stateless_tick(NULL, 1U, 1U, output);
    CHECK(sr_game_checksum(NULL, 1U) == 0U);
    return 0;
}

static int test_three_model_equivalence(void) {
    enum { ENTITIES = 257, FRAMES = 211 };
    sr_game_input initial[ENTITIES];
    sr_game_input stateless_inputs[ENTITIES];
    sr_game_input stateful_inputs[ENTITIES];
    sr_game_input hybrid_inputs[ENTITIES];
    sr_game_output stateless_outputs[ENTITIES];
    sr_game_output stateful_outputs[ENTITIES];
    sr_game_output hybrid_outputs[ENTITIES];
    uint32_t input_versions[ENTITIES];
    uint32_t evaluated_versions[ENTITIES];
    sr_game_change changes[ENTITIES];
    sr_stateful_world stateful;
    sr_hybrid_world hybrid;
    size_t frame;

    initialize_inputs(initial, ENTITIES);
    memcpy(stateless_inputs, initial, sizeof(initial));
    memcpy(stateful_inputs, initial, sizeof(initial));
    memcpy(hybrid_inputs, initial, sizeof(initial));
    CHECK(sr_game_stateful_init(&stateful, stateful_inputs, stateful_outputs,
                                ENTITIES, 17U) == 0);
    CHECK(sr_game_hybrid_init(&hybrid, hybrid_inputs, hybrid_outputs,
                              input_versions, evaluated_versions,
                              ENTITIES, 17U) == 0);
    sr_game_stateless_tick(stateless_inputs, ENTITIES, 17U, stateless_outputs);

    for (frame = 0U; frame < FRAMES; frame++) {
        const size_t change_count = (frame % 4U == 0U) ? 0U :
                                    (frame % 4U == 1U) ? 3U :
                                    (frame % 4U == 2U) ? 26U : ENTITIES;
        size_t index;
        for (index = 0U; index < change_count; index++) {
            const size_t entity = (frame * 131U + index * 17U) % ENTITIES;
            changes[index].entity = (uint32_t)entity;
            changes[index].value = initial[entity];
            changes[index].value.seed.x += (float)(frame + 1U) * 0.001f;
            changes[index].value.bias.z += (float)(index + 1U) * 0.0000001f;
        }
        sr_game_apply_changes(stateless_inputs, ENTITIES, changes, change_count);
        sr_game_stateful_dispatch(&stateful, changes, change_count);
        sr_game_hybrid_mark_changes(&hybrid, changes, change_count);
        sr_game_stateless_tick(stateless_inputs, ENTITIES, 17U,
                               stateless_outputs);
        (void)sr_game_stateful_tick(&stateful);
        (void)sr_game_hybrid_tick(&hybrid);
        CHECK(outputs_equal(stateless_outputs, stateful_outputs, ENTITIES));
        CHECK(outputs_equal(stateless_outputs, hybrid_outputs, ENTITIES));
        CHECK(sr_game_checksum(stateless_outputs, ENTITIES) ==
              sr_game_checksum(stateful_outputs, ENTITIES));
        CHECK(sr_game_checksum(stateless_outputs, ENTITIES) ==
              sr_game_checksum(hybrid_outputs, ENTITIES));
    }
    return 0;
}

static int test_stale_event_and_hybrid_mark_faults(void) {
    enum { ENTITIES = 3 };
    sr_game_input initial[ENTITIES];
    sr_game_input stateful_inputs[ENTITIES];
    sr_game_input hybrid_inputs[ENTITIES];
    sr_game_output expected[ENTITIES];
    sr_game_output stateful_outputs[ENTITIES];
    sr_game_output hybrid_outputs[ENTITIES];
    uint32_t input_versions[ENTITIES];
    uint32_t evaluated_versions[ENTITIES];
    sr_stateful_world stateful;
    sr_hybrid_world hybrid;
    sr_game_change change;

    initialize_inputs(initial, ENTITIES);
    memcpy(stateful_inputs, initial, sizeof(initial));
    memcpy(hybrid_inputs, initial, sizeof(initial));
    CHECK(sr_game_stateful_init(&stateful, stateful_inputs, stateful_outputs,
                                ENTITIES, 8U) == 0);
    CHECK(sr_game_hybrid_init(&hybrid, hybrid_inputs, hybrid_outputs,
                              input_versions, evaluated_versions,
                              ENTITIES, 8U) == 0);

    change.entity = 1U;
    change.value = initial[1];
    change.value.seed.y += 99.0f;
    initial[1] = change.value;
    sr_game_stateless_tick(initial, ENTITIES, 8U, expected);

    /* Missing the dispatcher/dirty-mark protocol leaves cached state stale. */
    stateful_inputs[1] = change.value;
    hybrid_inputs[1] = change.value;
    (void)sr_game_stateful_tick(&stateful);
    (void)sr_game_hybrid_tick(&hybrid);
    CHECK(!outputs_equal(expected, stateful_outputs, ENTITIES));
    CHECK(!outputs_equal(expected, hybrid_outputs, ENTITIES));

    /* Correct event delivery or version marking restores equivalence. */
    sr_game_stateful_dispatch(&stateful, &change, 1U);
    sr_game_hybrid_mark_changes(&hybrid, &change, 1U);
    (void)sr_game_hybrid_tick(&hybrid);
    CHECK(outputs_equal(expected, stateful_outputs, ENTITIES));
    CHECK(outputs_equal(expected, hybrid_outputs, ENTITIES));
    return 0;
}

static int test_long_running_finite_output(void) {
    sr_game_input input;
    sr_game_output output;
    initialize_inputs(&input, 1U);
    sr_game_recompute_entity(&input, 65536U, &output);
    CHECK(isfinite(output.derived.x));
    CHECK(isfinite(output.derived.y));
    CHECK(isfinite(output.derived.z));
    return 0;
}

int main(void) {
    if (test_initialization_and_boundaries() != 0 ||
        test_three_model_equivalence() != 0 ||
        test_stale_event_and_hybrid_mark_faults() != 0 ||
        test_long_running_finite_output() != 0) {
        return EXIT_FAILURE;
    }
    puts("All game-state correctness tests passed.");
    return EXIT_SUCCESS;
}
