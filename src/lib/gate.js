// Address gate. Base58 is never rejected as a class: an address-shaped string
// is compared with the register, and the answer depends on what the register says.
import { isAddressShaped, isStated } from './register.js';

const NON_BASE58 = /[^1-9A-HJ-NP-Za-km-z]/;

// Pull address-shaped tokens out of pasted text (a bare address or a block explorer link).
export function candidates(input) {
  return String(input)
    .split(/[^1-9A-HJ-NP-Za-km-z0OIl]+/)
    .filter(Boolean);
}

export function classify(input, register) {
  const text = String(input == null ? '' : input).trim();
  if (!text) return { kind: 'empty', tone: 'idle', message: 'Drop an address in to check it against the record.' };

  const shaped = candidates(text).filter(isAddressShaped);
  if (!shaped.length) {
    const bad = text.length <= 64 && NON_BASE58.test(text);
    return {
      kind: 'not-address-shaped',
      tone: 'warn',
      message: bad
        ? 'Not address-shaped: it has characters outside the base58 set (0, O, I and l are not used).'
        : 'Not address-shaped: Solana addresses run 32 to 44 base58 characters.',
    };
  }

  const ca = register && register.records && register.records.ca;
  if (!isStated(ca)) {
    return {
      kind: 'unverifiable',
      tone: 'neutral',
      message: 'Address-shaped, but the record holds no stated contract yet. Nothing to compare with, so this is neither a match nor a mismatch.',
    };
  }
  if (shaped.includes(ca.value)) {
    return { kind: 'match', tone: 'ok', message: 'Match: that string equals our stated contract.' };
  }
  return {
    kind: 'mismatch',
    tone: 'warn',
    message: 'Address-shaped, but it is not the stated contract. Treat it as unrelated.',
  };
}
