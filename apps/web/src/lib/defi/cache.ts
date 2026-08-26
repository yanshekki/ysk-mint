type Entry<T> = { at: number; value: T };

const store = new Map<string, Entry<unknown>>();
const inflight = new Map<string, Promise<unknown>>();

export function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const hit = store.get(key) as Entry<T> | undefined;
  if (hit && Date.now() - hit.at < ttlMs) return Promise.resolve(hit.value);
  const pending = inflight.get(key) as Promise<T> | undefined;
  if (pending) return pending;
  const job = fn()
    .then((value) => {
      store.set(key, { at: Date.now(), value });
      inflight.delete(key);
      return value;
    })
    .catch((err) => {
      inflight.delete(key);
      throw err;
    });
  inflight.set(key, job);
  return job;
}

export async function mapChunk<T, R>(items: T[], size: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += size) {
    const part = await Promise.all(items.slice(i, i + size).map(fn));
    out.push(...part);
  }
  return out;
}
