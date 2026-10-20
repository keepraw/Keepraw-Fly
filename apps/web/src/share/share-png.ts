const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

export interface PngHeader {
  width: number;
  height: number;
  bitDepth: number;
  colorType: number;
}

/** Parses the PNG signature and the IHDR chunk; null when either is wrong. */
export function readPngHeader(bytes: Uint8Array): PngHeader | null {
  if (bytes.length < 33) return null;
  if (!SIGNATURE.every((value, index) => bytes[index] === value)) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const length = view.getUint32(8);
  const type = String.fromCharCode(...bytes.subarray(12, 16));
  if (length !== 13 || type !== "IHDR") return null;
  return {
    width: view.getUint32(16),
    height: view.getUint32(20),
    bitDepth: bytes[24]!,
    colorType: bytes[25]!,
  };
}

/** Chunk types in file order (used to prove no text/metadata chunks). */
export function listPngChunks(bytes: Uint8Array): string[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const chunks: string[] = [];
  let offset = 8;
  while (offset + 8 <= bytes.length) {
    const length = view.getUint32(offset);
    chunks.push(String.fromCharCode(...bytes.subarray(offset + 4, offset + 8)));
    offset += 12 + length;
  }
  return chunks;
}
