/**
 * Escalation Service — handles progressive escalation when clients miss workouts
 * or show concerning patterns. Levels: 1 (nudge), 2 (concern), 3 (book call).
 */

/** Create an escalation event for a user */
export async function createEscalation(
  _userId: string,
  _triggerReason: string,
  _level: number
): Promise<{ id: string; level: number }> {
  // TODO: implement — determine level based on history,
  // create EscalationEvent, trigger appropriate messaging
  throw new Error("Not implemented");
}

/** Resolve an escalation event */
export async function resolveEscalation(
  _escalationId: string,
  _resolution: string
): Promise<void> {
  // TODO: implement — set resolvedAt + resolution on EscalationEvent
  throw new Error("Not implemented");
}

/** Get recent escalation events for a user */
export async function getEscalationHistory(
  _userId: string
): Promise<unknown[]> {
  // TODO: implement — return EscalationEvent[] ordered by createdAt desc
  throw new Error("Not implemented");
}

/** Get the current escalation level for a user (based on unresolved events in last 30 days) */
export async function getCurrentEscalationLevel(
  _userId: string
): Promise<number> {
  // TODO: implement — count unresolved events in last 30 days,
  // return next level (1, 2, or 3)
  throw new Error("Not implemented");
}
