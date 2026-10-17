// ESM copy of ajv/dist/runtime/ucs2length (MIT, Copyright (c) 2015-2021
// Evgeny Poberezkin) used by the precompiled validator: it counts Unicode code
// points exactly as Ajv's runtime minLength/maxLength checks do.
export default function ucs2length(str) {
  const len = str.length;
  let length = 0;
  let pos = 0;
  let value;
  while (pos < len) {
    length++;
    value = str.charCodeAt(pos++);
    if (value >= 0xd800 && value <= 0xdbff && pos < len) {
      value = str.charCodeAt(pos);
      if ((value & 0xfc00) === 0xdc00) pos++;
    }
  }
  return length;
}
