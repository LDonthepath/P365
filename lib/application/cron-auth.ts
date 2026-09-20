/** Fail-closed Bearer authentication shared by independent cron boundaries. */
export function isCronRequestAuthorized(authorization: string | null, secret: string | undefined): boolean {
  if (!secret || !authorization) return false;
  const match = /^Bearer (.+)$/.exec(authorization);
  return match !== null && match[1] === secret;
}
