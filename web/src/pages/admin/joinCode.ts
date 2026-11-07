export const JOIN_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function generateJoinCode(random = crypto) {
  const result: string[] = [];
  while (result.length < 8) {
    for (const byte of random.getRandomValues(new Uint8Array(16))) {
      if (byte < Math.floor(256 / JOIN_ALPHABET.length) * JOIN_ALPHABET.length)
        result.push(JOIN_ALPHABET[byte % JOIN_ALPHABET.length]);
      if (result.length === 8) break;
    }
  }
  return result.join('');
}
