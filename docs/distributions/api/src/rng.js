// Seeded PRNG (sfc32) with named sub-streams.
//
// Every round is replayable from (seed, stream): the payout draw, the reveal-shaping
// draws and cosmetic draws each get their own stream so they never share a sequence.
// That is the RNG-isolation rule from the RandomSkill manual (§10) and it is what
// makes a round auditable: same seed + same inputs => identical result.


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

/** Fresh 128-bit hex seed from the platform CSPRNG (Node ≥ 20 and browsers). Use this for live rounds. */
export function newSeed() { const b = new Uint8Array(16); globalThis.crypto.getRandomValues(b); return Array.from(b, x => x.toString(16).padStart(2, '0')).join(''); }

// ─── Hash-based generator and commitment (production path) ─────────────────────────────────────
//
// Every uniform the contract hands to an engine comes from HashRng: u_k = SHA-256(seed | stream | k) mapped
// to [0,1). Knowing any number of outputs reveals nothing about the seed (preimage resistance), and the
// seed itself is 128 bits from the platform CSPRNG. The seed stays server-side until the round ends;
// the bet response carries only sha256(seed) so the house is committed before any live money, and the
// seed is revealed at the end so anyone can recompute the round and check it matches the commitment.
// Pure JS SHA-256 so the same bytes come out in Node and in a browser.

const K = new Uint32Array([0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2]);
const rotr = (x, n) => (x >>> n) | (x << (32 - n));

/** SHA-256 of a UTF-8 string, as a Uint8Array(32). */
export function sha256(str) {
  const msg = new TextEncoder().encode(str); const len = msg.length; const bitLen = len * 8;
  const padLen = ((len + 9 + 63) >> 6) << 6; const buf = new Uint8Array(padLen); buf.set(msg); buf[len] = 0x80;
  const dv = new DataView(buf.buffer); dv.setUint32(padLen - 8, Math.floor(bitLen / 0x100000000)); dv.setUint32(padLen - 4, bitLen >>> 0);
  const H = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]); const w = new Uint32Array(64);
  for (let off = 0; off < padLen; off += 64) {
    for (let i = 0; i < 16; i++) w[i] = dv.getUint32(off + i * 4);
    for (let i = 16; i < 64; i++) { const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3), s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10); w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0; }
    let [a, b, c, d, e, f, g, h] = H;
    for (let i = 0; i < 64; i++) { const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25), ch = (e & f) ^ (~e & g), t1 = (h + S1 + ch + K[i] + w[i]) >>> 0, S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22), maj = (a & b) ^ (a & c) ^ (b & c), t2 = (S0 + maj) >>> 0; h = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0; }
    H[0] += a; H[1] += b; H[2] += c; H[3] += d; H[4] += e; H[5] += f; H[6] += g; H[7] += h;
  }
  const out = new Uint8Array(32); const ov = new DataView(out.buffer); for (let i = 0; i < 8; i++) ov.setUint32(i * 4, H[i]); return out;
}
export const sha256Hex = str => Array.from(sha256(str), b => b.toString(16).padStart(2, '0')).join('');

/** Hash-based uniform generator: u_k = SHA-256(seed | stream | k) → 53-bit float in [0,1). Same interface as Rng. */
export class HashRng {
  constructor(seed, stream = 'payout') { this.seed = String(seed); this.stream = stream; this.k = 0; }
  next() {
    const h = sha256(`${this.seed}|${this.stream}|${this.k++}`); const dv = new DataView(h.buffer);
    return (dv.getUint32(0) * 2097152 + (dv.getUint32(4) >>> 11)) / 9007199254740992;   // 32 + 21 = 53 bits
  }
  int(n) { return Math.floor(this.next() * n); }
  pick(arr) { return arr[this.int(arr.length)]; }
  chance(p) { return this.next() < p; }
  derive(stream) { return new HashRng(this.seed, stream); }
}
/** The public commitment to a seed. */
export const commit = seed => sha256Hex(`commit|${seed}`);
