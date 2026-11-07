export function sanitizeClientText(s: string): string {
  return s.replace(/<\/?(client_messages|earlier)>/gi, '');
}
