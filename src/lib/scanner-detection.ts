/**
 * Email Scanner Bot Detection
 *
 * Identifies likely email security scanner behavior on RSVP links.
 * Scanners typically: click all links rapidly, use identifiable user-agents,
 * and hit multiple links within seconds of email delivery.
 */

/**
 * Known email security scanner user-agent patterns (case-insensitive).
 * These cover major corporate email security products.
 */
const SCANNER_UA_PATTERNS = [
  /barracuda/i,
  /mimecast/i,
  /proofpoint/i,
  /microsoft\s*office/i,
  /safelinks/i,
  /symantec/i,
  /sophos/i,
  /trend\s*micro/i,
  /fireeye/i,
  /forcepoint/i,
  /zscaler/i,
  /paloalto/i,
  /checkpoint/i,
  /ironport/i,
  /messagelabs/i,
  /spamhaus/i,
  /mailguard/i,
  /mailscanner/i,
  /fortinet/i,
  /trustwave/i,
  /websense/i,
  /mcafee/i,
  /norton/i,
  /bitdefender/i,
  /kaspersky/i,
  /avast/i,
  /avg\//i,
  /webroot/i,
  /google-safety/i,
  /url\s*defense/i,
  /link\s*?protect/i,
  /email\s*?security/i,
  /sandbox/i,
  /crawler/i,
  /scanner/i,
  /phish/i,
];

/**
 * Check if a user-agent string matches known email scanner patterns.
 */
export function isKnownScanner(userAgent: string | null): boolean {
  if (!userAgent) return false;
  return SCANNER_UA_PATTERNS.some((pattern) => pattern.test(userAgent));
}

/**
 * Check if a RSVP change happened within a rapid window of a previous change
 * for the same profile + schedule. Email scanners often click "In", "Out",
 * and "Not Sure" links within seconds of each other.
 *
 * @param recentHistory - Recent rsvp_history rows for this profile+schedule
 * @param thresholdSeconds - Window in seconds (default 30)
 */
export function isRapidChange(
  recentHistory: Array<{ created_at: string }>,
  thresholdSeconds = 30
): boolean {
  if (!recentHistory || recentHistory.length === 0) return false;

  const now = Date.now();
  return recentHistory.some((h) => {
    const prevTime = new Date(h.created_at).getTime();
    const diffMs = now - prevTime;
    return diffMs >= 0 && diffMs < thresholdSeconds * 1000;
  });
}

/**
 * Determine if an RSVP action is suspicious based on available signals.
 */
export function isSuspicious(
  userAgent: string | null,
  recentHistory: Array<{ created_at: string }>
): boolean {
  return isKnownScanner(userAgent) || isRapidChange(recentHistory);
}

/**
 * Extract client IP address from request headers.
 * Vercel sets X-Forwarded-For; falls back to x-real-ip.
 */
export function getClientIp(headers: Headers): string | null {
  const xff = headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return headers.get("x-real-ip") || null;
}
