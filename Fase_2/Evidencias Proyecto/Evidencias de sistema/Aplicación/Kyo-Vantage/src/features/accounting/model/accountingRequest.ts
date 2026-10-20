/** Keep the same id only while retrying an unchanged, unconfirmed submission. */
export function createAccountingAction() {
  let pending: { fingerprint: string; id: string } | null = null;
  return async function run<T>(payload: object, action: (requestId: string) => Promise<T>): Promise<T> {
    const fingerprint = JSON.stringify(payload);
    if (!pending || pending.fingerprint !== fingerprint) pending = { fingerprint, id: crypto.randomUUID() };
    const attempt = pending;
    const result = await action(attempt.id);
    if (pending === attempt) pending = null;
    return result;
  };
}
