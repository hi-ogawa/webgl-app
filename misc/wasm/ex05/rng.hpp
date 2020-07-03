//
// PCG32 (cf. https://github.com/imneme/pcg-c-basic)
//

struct Rng {
  uint64_t state, inc;
  Rng(uint64_t init_state = 0x1234u, uint64_t init_seq = 0x5678u) {
    seed(init_state, init_seq);
  }

  void seed(uint64_t init_state, uint64_t init_seq) {
    state = 0u;
    inc = (init_seq << 1u) | 1u;
    next();
    state += init_state;
    next();
  }

  uint32_t next() {
    uint64_t oldstate = state;
    state = oldstate * 6364136223846793005ULL + inc;
    uint32_t xorshifted = ((oldstate >> 18u) ^ oldstate) >> 27u;
    uint32_t rot = oldstate >> 59u;
    return (xorshifted >> rot) | (xorshifted << ((-rot) & 31));
  }

  float uniform() {
    // Normalize 23 bits
    return (next() >> 9) / static_cast<float>(1 << 23);
  }
};
