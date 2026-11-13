/** Replace known secrets in a message. Short values are left alone so ordinary words are not blanked. */
export function redactSecrets(message: string, secrets: readonly string[]): string {
  let output = message;
  for (const secret of secrets) {
    if (secret.length < 8) continue;
    output = output.split(secret).join("[redacted]");
  }
  return output;
}
