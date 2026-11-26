"use strict";

// -----------------------------------------------------------------------
// Imagem de demonstração (PNG gerado em código).
//
// Usada pelo seed para criar uma publicação de exemplo para o cuidador de
// teste sem precisar versionar nenhum arquivo binário no projeto.
// Só depende do módulo `zlib` do Node (nada de pacotes externos).
// -----------------------------------------------------------------------
const zlib = require("zlib");

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let crc = 0xffffffff;
  for (let i = 0; i < buffer.length; i++) {
    crc = CRC_TABLE[(crc ^ buffer[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeAndData = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData), 0);
  return Buffer.concat([length, typeAndData, crc]);
}

function mix(a, b, t) {
  return Math.round(a + (b - a) * t);
}

/**
 * PNG RGB de `width` x `height`: degradê vertical azul (#2C6491 -> #E0EAF5,
 * as cores da marca) com uma faixa clara no centro.
 */
function makeDemoPng(width = 480, height = 300) {
  const from = [0x2c, 0x64, 0x91];
  const to = [0xe0, 0xea, 0xf5];
  const stride = width * 3 + 1; // +1 = byte de filtro de cada linha
  const raw = Buffer.alloc(stride * height);

  for (let y = 0; y < height; y++) {
    const rowStart = y * stride;
    raw[rowStart] = 0; // filtro "None"
    const t = y / (height - 1);
    const band = y > height * 0.42 && y < height * 0.58;
    for (let x = 0; x < width; x++) {
      const o = rowStart + 1 + x * 3;
      raw[o] = band ? 255 : mix(from[0], to[0], t);
      raw[o + 1] = band ? 255 : mix(from[1], to[1], t);
      raw[o + 2] = band ? 255 : mix(from[2], to[2], t);
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // profundidade de bits
  ihdr[9] = 2; // tipo de cor: RGB
  ihdr[10] = 0; // compressão
  ihdr[11] = 0; // filtro
  ihdr[12] = 0; // sem entrelaçamento

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

module.exports = { makeDemoPng, crc32 };
