#include "algorithms.h"

#include <string.h>

#if defined(_MSC_VER)
#define SR_NOINLINE __declspec(noinline)
#elif defined(__GNUC__) || defined(__clang__)
#define SR_NOINLINE __attribute__((noinline))
#else
#define SR_NOINLINE
#endif

static uint32_t sr_float_bits(float value) {
    uint32_t bits = 0U;
    memcpy(&bits, &value, sizeof(bits));
    return bits;
}

SR_NOINLINE void sr_game_recompute_entity(const sr_game_input *input,
                                           uint32_t work_rounds,
                                           sr_game_output *output) {
    sr_vec3f value = input->seed;
    uint32_t round;
    for (round = 0U; round < work_rounds; round++) {
        /* A stable, game-style vector transform. The perturbation stops the
         * loop from collapsing to a single closed-form expression. */
        const float phase = (float)(round & 7U) * 0.000001f;
        const sr_vec3f scale = {
            0.999991f + phase,
            0.999987f - phase,
            0.999983f + phase
        };
        value.x = value.x * scale.x + input->bias.x;
        value.y = value.y * scale.y + input->bias.y;
        value.z = value.z * scale.z + input->bias.z;
    }
    output->derived = value;
}

static SR_NOINLINE void sr_game_recompute_all(const sr_game_input *inputs,
                                               size_t entity_count,
                                               uint32_t work_rounds,
                                               sr_game_output *outputs) {
    size_t entity;
    for (entity = 0U; entity < entity_count; entity++) {
        sr_game_recompute_entity(&inputs[entity], work_rounds, &outputs[entity]);
    }
}

void sr_game_stateless_tick(const sr_game_input *inputs,
                            size_t entity_count,
                            uint32_t work_rounds,
                            sr_game_output *outputs) {
    if (inputs == NULL || outputs == NULL || entity_count == 0U) {
        return;
    }
    sr_game_recompute_all(inputs, entity_count, work_rounds, outputs);
}

int sr_game_stateful_init(sr_stateful_world *world,
                          sr_game_input *inputs,
                          sr_game_output *cache,
                          size_t entity_count,
                          uint32_t work_rounds) {
    if (world == NULL || inputs == NULL || cache == NULL ||
        entity_count == 0U || entity_count > SR_MAX_ENTITIES ||
        work_rounds == 0U) {
        return -1;
    }
    world->inputs = inputs;
    world->cache = cache;
    world->entity_count = entity_count;
    world->work_rounds = work_rounds;
    sr_game_recompute_all(inputs, entity_count, work_rounds, cache);
    return 0;
}

static SR_NOINLINE void sr_game_component_on_changed(sr_stateful_world *world,
                                                      const sr_game_change *change) {
    const size_t entity = (size_t)change->entity;
    if (entity >= world->entity_count) {
        return;
    }
    world->inputs[entity] = change->value;
    sr_game_recompute_entity(&world->inputs[entity], world->work_rounds,
                             &world->cache[entity]);
}

static SR_NOINLINE void sr_game_dispatch_one(sr_stateful_world *world,
                                              const sr_game_change *change) {
    sr_game_component_on_changed(world, change);
}

void sr_game_stateful_dispatch(sr_stateful_world *world,
                               const sr_game_change *changes,
                               size_t change_count) {
    size_t index;
    if (world == NULL || (changes == NULL && change_count != 0U)) {
        return;
    }
    for (index = 0U; index < change_count; index++) {
        sr_game_dispatch_one(world, &changes[index]);
    }
}

static SR_NOINLINE uint64_t sr_game_consume_cache(const sr_game_output *cache,
                                                  size_t entity_count) {
    uint64_t token;
    size_t middle;
    if (cache == NULL || entity_count == 0U) {
        return 0U;
    }
    middle = entity_count / 2U;
    token = (uint64_t)sr_float_bits(cache[0U].derived.x);
    token ^= (uint64_t)sr_float_bits(cache[middle].derived.y) << 16U;
    token ^= (uint64_t)sr_float_bits(cache[entity_count - 1U].derived.z) << 32U;
    return token;
}

uint64_t sr_game_stateful_tick(const sr_stateful_world *world) {
    if (world == NULL) {
        return 0U;
    }
    return sr_game_consume_cache(world->cache, world->entity_count);
}

int sr_game_hybrid_init(sr_hybrid_world *world,
                        sr_game_input *inputs,
                        sr_game_output *cache,
                        uint32_t *input_versions,
                        uint32_t *evaluated_versions,
                        size_t entity_count,
                        uint32_t work_rounds) {
    size_t entity;
    if (world == NULL || inputs == NULL || cache == NULL ||
        input_versions == NULL || evaluated_versions == NULL ||
        entity_count == 0U || entity_count > SR_MAX_ENTITIES ||
        work_rounds == 0U) {
        return -1;
    }
    world->inputs = inputs;
    world->cache = cache;
    world->input_versions = input_versions;
    world->evaluated_versions = evaluated_versions;
    world->entity_count = entity_count;
    world->work_rounds = work_rounds;
    for (entity = 0U; entity < entity_count; entity++) {
        input_versions[entity] = 1U;
        evaluated_versions[entity] = 1U;
    }
    sr_game_recompute_all(inputs, entity_count, work_rounds, cache);
    return 0;
}

static SR_NOINLINE void sr_game_mark_one(sr_hybrid_world *world,
                                          const sr_game_change *change) {
    const size_t entity = (size_t)change->entity;
    if (entity >= world->entity_count) {
        return;
    }
    world->inputs[entity] = change->value;
    world->input_versions[entity]++;
    if (world->input_versions[entity] == 0U) {
        /* Reserve zero and preserve inequality across a practical wrap. */
        world->input_versions[entity] = 1U;
        world->evaluated_versions[entity] = 0U;
    }
}

void sr_game_hybrid_mark_changes(sr_hybrid_world *world,
                                 const sr_game_change *changes,
                                 size_t change_count) {
    size_t index;
    if (world == NULL || (changes == NULL && change_count != 0U)) {
        return;
    }
    for (index = 0U; index < change_count; index++) {
        sr_game_mark_one(world, &changes[index]);
    }
}

static SR_NOINLINE void sr_game_scan_entity(sr_hybrid_world *world,
                                             size_t entity) {
    if (world->input_versions[entity] != world->evaluated_versions[entity]) {
        sr_game_recompute_entity(&world->inputs[entity], world->work_rounds,
                                 &world->cache[entity]);
        world->evaluated_versions[entity] = world->input_versions[entity];
    }
}

uint64_t sr_game_hybrid_tick(sr_hybrid_world *world) {
    size_t entity;
    if (world == NULL) {
        return 0U;
    }
    for (entity = 0U; entity < world->entity_count; entity++) {
        sr_game_scan_entity(world, entity);
    }
    return sr_game_consume_cache(world->cache, world->entity_count);
}

void sr_game_apply_changes(sr_game_input *inputs,
                           size_t entity_count,
                           const sr_game_change *changes,
                           size_t change_count) {
    size_t index;
    if (inputs == NULL || (changes == NULL && change_count != 0U)) {
        return;
    }
    for (index = 0U; index < change_count; index++) {
        const size_t entity = (size_t)changes[index].entity;
        if (entity < entity_count) {
            inputs[entity] = changes[index].value;
        }
    }
}

uint64_t sr_game_checksum(const sr_game_output *outputs, size_t entity_count) {
    uint64_t hash = UINT64_C(1469598103934665603);
    size_t entity;
    if (outputs == NULL) {
        return 0U;
    }
    for (entity = 0U; entity < entity_count; entity++) {
        const uint32_t values[3] = {
            sr_float_bits(outputs[entity].derived.x),
            sr_float_bits(outputs[entity].derived.y),
            sr_float_bits(outputs[entity].derived.z)
        };
        size_t component;
        for (component = 0U; component < 3U; component++) {
            hash ^= values[component];
            hash *= UINT64_C(1099511628211);
        }
    }
    return hash;
}
