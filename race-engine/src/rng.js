// Seeded PRNG (sfc32) with named sub-streams.
//
// Every round is replayable from (seed, stream): the payout draw, the reveal-shaping
// draws and cosmetic draws each get their own stream so they never share a sequence.
// That is the RNG-isolation rule from the RandomSkill manual (§10) and it is what
// makes a round auditable: same seed + same inputs => identical result.

import { randomBytes } from 'node:crypto';

function cyrb128(str) {
  let h1 = 1779033703, h2 = 3144134277, h3 = 1013904242, h4 = 2773480762;
  for (let i = 0, k; i < str.length; i++) {
    k = str.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  h1 ^= (h2 ^ h3 ^ h4); h2 ^= h1; h3 ^= h1; h4 ^= h1;
  return [h1 >>> 0, h2 >>> 0, h3 >>> 0, h4 >>> 0];
}

export class Rng {
  constructor(seed, stream = 'payout') {
    this.seed = String(seed);
    this.stream = stream;
    this.s = cyrb128(`${this.seed}::${stream}`);
    for (let i = 0; i < 12; i++) this.next();
  }

  /** Uniform float in [0, 1). */
  next() {
    let [a, b, c, d] = this.s;
    let t = (a + b) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    d = (d + 1) | 0;
    t = (t + d) | 0;
    c = (c + t) | 0;
    this.s = [a >>> 0, b >>> 0, c >>> 0, d >>> 0];
    return (t >>> 0) / 4294967296;
  }

  /** Integer in [0, n). */
  int(n) { return Math.floor(this.next() * n); }
  pick(arr) { return arr[this.int(arr.length)]; }
  chance(p) { return this.next() < p; }
  /** Independent stream derived from the same seed. */
  derive(stream) { return new Rng(this.seed, stream); }
}

/** Fresh 128-bit hex seed from the OS CSPRNG. Use this for live rounds. */
export function newSeed() { return randomBytes(16).toString('hex'); }
