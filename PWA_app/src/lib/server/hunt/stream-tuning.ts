/** Tunables for the cross-instance stream follow loop. */
export const streamTuning = {
  /** ms between event-table polls while following another instance. */
  pollMs: 1000,
  /** give up following after this long (client can re-GET to replay). */
  timeoutMs: 15 * 60_000,
};
