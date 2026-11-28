// Unpacks model.gz, the quantised weights of the "Machine Learning" player, back into the
// "qp2048TD0" model format that players.wasm reads (machine_learning/file_format.md in
// qpwoeirut/2048-solver). Loaded by ai_controller.js in the worker, and by the Node tools
// (2048/tools/pack-weights.mjs writes the file; 2048/tools/verify-weights.mjs checks it).
//
// model.gz is gzip around this payload (all integers little-endian):
//   "TD0Q", version (u8) = 1
//   header length H (u16), then H bytes: the original header ("qp2048TD0", m, n, c and the
//     m*n tuple positions), copied as is
//   step (f32): every weight is a whole multiple of it
//   L (u32): entries coded, from index 0 (the rest of the m*c^n table is zero)
//   B (u8), K (u8), then K neighbour offsets (u32 each)
//   (2B+1)^K stream lengths (u32 each), then the streams back to back
// Entry i of the table is step * q[i], q[i] a whole number. Entries are coded in index order,
// each in the stream picked by its context: the "size class" of the already decoded entries
// i - offset[0], ..., i - offset[K-1] (0 for an index below 0). Size class of v: the bit
// length of |v| capped at B, plus B when v < 0. Within a stream, q is zigzagged
// (0, -1, 1, -2, ... -> 0, 1, 2, 3, ...) and written as one byte, or as 255 then two bytes
// when it does not fit under 255. Grouping by context lets gzip's Huffman tables follow how
// the weights near an entry predict its size; that is most of the gain over plain gzip.
// Table entries that are zero are absent from the output's bitmask, as the format expects.

(function (root) {
    "use strict";

    function decodeTd0Weights(payload) {
        const bytes = ArrayBuffer.isView(payload)
            ? new Uint8Array(payload.buffer, payload.byteOffset, payload.byteLength)
            : new Uint8Array(payload);
        const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        let p = 0;
        const magic = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
        if (magic !== "TD0Q" || bytes[4] !== 1) throw new Error("not a packed TD0 model (version 1)");
        p = 5;
        const headerLength = view.getUint16(p, true); p += 2;
        const header = bytes.subarray(p, p + headerLength); p += headerLength;
        const tuples = header[9], tupleSize = header[10], tileCount = header[11];
        if (headerLength !== 12 + tuples * tupleSize) throw new Error("bad model header");
        const tableSize = tuples * Math.pow(tileCount, tupleSize);
        const step = view.getFloat32(p, true); p += 4;
        const coded = view.getUint32(p, true); p += 4;
        if (coded > tableSize) throw new Error("bad model length");
        const cap = bytes[p++], neighbours = bytes[p++];
        const offsets = [];
        for (let k = 0; k < neighbours; k++) { offsets.push(view.getUint32(p, true)); p += 4; }
        const width = 2 * cap + 1;
        const contexts = Math.pow(width, neighbours);
        const next = new Uint32Array(contexts);  // read position of each stream
        let start = p + 4 * contexts;
        for (let c = 0; c < contexts; c++) {
            next[c] = start;
            start += view.getUint32(p, true); p += 4;
        }
        if (start !== bytes.length) throw new Error("model streams do not add up");

        const q = new Int32Array(coded);
        const sizeClass = new Uint8Array(coded);
        let nonzero = 0;
        for (let i = 0; i < coded; i++) {
            let c = 0;
            for (let k = 0; k < neighbours; k++) {
                const j = i - offsets[k];
                c = c * width + (j >= 0 ? sizeClass[j] : 0);
            }
            let at = next[c];
            let z = bytes[at++];
            if (z === 255) { z = bytes[at] | (bytes[at + 1] << 8); at += 2; }
            next[c] = at;
            const v = (z >>> 1) ^ -(z & 1);
            q[i] = v;
            if (v !== 0) {
                nonzero++;
                const bits = 32 - Math.clz32(v < 0 ? -v : v);
                sizeClass[i] = (bits < cap ? bits : cap) + (v < 0 ? cap : 0);
            }
        }

        // The format: header, a bitmask over the whole table (bit i set: entry i is stored),
        // then the stored entries as float32, in index order.
        const maskBytes = Math.ceil(tableSize / 8);
        const out = new Uint8Array(headerLength + maskBytes + 4 * nonzero);
        out.set(header, 0);
        const outView = new DataView(out.buffer);
        let w = headerLength + maskBytes;
        for (let i = 0; i < coded; i++) {
            if (q[i] === 0) continue;
            out[headerLength + (i >> 3)] |= 1 << (i & 7);
            outView.setFloat32(w, q[i] * step, true);
            w += 4;
        }
        return out;
    }

    root.decodeTd0Weights = decodeTd0Weights;
})(typeof self !== "undefined" ? self : globalThis);
