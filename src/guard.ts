const RULES: { re: RegExp; reason: string }[] = [
  {
    re: /\.env\b|\b(send|share|give|reveal|email)\b.{0,40}\b(api[ _-]?keys?|secrets?|passwords?|credentials?|tokens?|env)\b/i,
    reason: 'asks for secrets or credentials',
  },
  {
    re: /\b(delete|remove|wipe|drop|destroy)\b.{0,20}\b(repo|repository|database|everything|all (the )?files)\b/i,
    reason: 'destructive request',
  },
  {
    re: /\b(billing|invoice|credit card|payment details)\b|\b(change|transfer|buy|renew|point|update)\b.{0,20}\b(domain|dns|hosting)\b/i,
    reason: 'billing, domain or hosting is outside website edits',
  },
  { re: /\b(force[- ]?push|git reset|rm -rf|sudo)\b/i, reason: 'git or shell commands are not website edits' },
];

export function checkRequest(text: string): { allowed: true } | { allowed: false; reason: string } {
  const t = text.replace(/\s+/g, ' ');
  for (const rule of RULES) if (rule.re.test(t)) return { allowed: false, reason: rule.reason };
  return { allowed: true };
}
