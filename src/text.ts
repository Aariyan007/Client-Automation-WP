const TAG = /<\s*\/?\s*(client_messages|earlier)\s*>/gi;

// Loops until stable so nested payloads such as "</client_mess</client_messages>ages>"
// cannot reassemble a data-block tag after a single pass.
export function sanitizeClientText(s: string): string {
  let prev: string;
  do {
    prev = s;
    s = s.replace(TAG, '');
  } while (s !== prev);
  return s;
}
