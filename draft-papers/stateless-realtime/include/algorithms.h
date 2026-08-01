#ifndef STATELESS_REALTIME_ALGORITHMS_H
#define STATELESS_REALTIME_ALGORITHMS_H

#include <stddef.h>
#include <stdint.h>

#define SR_MAX_ENTITIES 4096U
#define SR_ARITHMETIC_PER_ROUND 6U

typedef struct {
    float x;
    float y;
    float z;
} sr_vec3f;

/* Canonical gameplay input from which the complete derived vector is built. */
typedef struct {
    sr_vec3f seed;
    sr_vec3f bias;
} sr_game_input;

typedef struct {
    sr_vec3f derived;
} sr_game_output;

typedef struct {
    uint32_t entity;
    sr_game_input value;
} sr_game_change;

typedef struct {
    sr_game_input *inputs;
    sr_game_output *cache;
    size_t entity_count;
    uint32_t work_rounds;
} sr_stateful_world;

typedef struct {
    sr_game_input *inputs;
    sr_game_output *cache;
    uint32_t *input_versions;
    uint32_t *evaluated_versions;
    size_t entity_count;
    uint32_t work_rounds;
} sr_hybrid_world;

/* One round is one component-wise vec3 multiply followed by one vec3 add:
 * three floating-point multiplications and three floating-point additions. */
void sr_game_recompute_entity(const sr_game_input *input,
                              uint32_t work_rounds,
                              sr_game_output *output);

/* Model 1: the Tick reconstructs every entity output from canonical inputs. */
void sr_game_stateless_tick(const sr_game_input *inputs,
                            size_t entity_count,
                            uint32_t work_rounds,
                            sr_game_output *outputs);

/* Model 2: dispatchers update cached outputs when changes arrive outside Tick. */
int sr_game_stateful_init(sr_stateful_world *world,
                          sr_game_input *inputs,
                          sr_game_output *cache,
                          size_t entity_count,
                          uint32_t work_rounds);
void sr_game_stateful_dispatch(sr_stateful_world *world,
                               const sr_game_change *changes,
                               size_t change_count);
uint64_t sr_game_stateful_tick(const sr_stateful_world *world);

/* Model 3: changes only mark versions; Tick scans and selectively recomputes. */
int sr_game_hybrid_init(sr_hybrid_world *world,
                        sr_game_input *inputs,
                        sr_game_output *cache,
                        uint32_t *input_versions,
                        uint32_t *evaluated_versions,
                        size_t entity_count,
                        uint32_t work_rounds);
void sr_game_hybrid_mark_changes(sr_hybrid_world *world,
                                 const sr_game_change *changes,
                                 size_t change_count);
uint64_t sr_game_hybrid_tick(sr_hybrid_world *world);

/* Applies canonical input changes for the fully recomputed model. */
void sr_game_apply_changes(sr_game_input *inputs,
                           size_t entity_count,
                           const sr_game_change *changes,
                           size_t change_count);

uint64_t sr_game_checksum(const sr_game_output *outputs, size_t entity_count);

#endif
