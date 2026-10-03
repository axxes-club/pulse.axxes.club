export type VerificationChallenge = {
  token: string;
  environment: string;
  issuedAt: string;
  expiresAt: string;
};
export function matchVerification(
  challenge: VerificationChallenge,
  event: { token: string; environment: string; receivedAt: string } | null,
  now = new Date(),
) {
  return (
    !!event &&
    challenge.token === event.token &&
    challenge.environment === event.environment &&
    Date.parse(challenge.expiresAt) > now.getTime() &&
    Date.parse(event.receivedAt) >= Date.parse(challenge.issuedAt)
  );
}
