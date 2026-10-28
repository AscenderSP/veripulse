// Simple pub/sub so AppShell's pull-to-refresh can tell whichever hub is
// currently mounted to re-fetch its data. Hubs subscribe on mount and
// return the unsubscribe from the effect.
export type RefreshScope = 'feed' | 'news' | 'earn' | 'compare' | 'all';
type Listener = () => void | Promise<void>;

const listeners: Map<RefreshScope, Set<Listener>> = new Map();

export function onRefresh(scope: RefreshScope, fn: Listener): () => void {
  let set = listeners.get(scope);
  if (!set) {
    set = new Set();
    listeners.set(scope, set);
  }
  set.add(fn);
  return () => {
    set?.delete(fn);
  };
}

export async function emitRefresh(scope: RefreshScope): Promise<void> {
  const scoped = Array.from(listeners.get(scope) ?? []);
  const all = scope === 'all' ? [] : Array.from(listeners.get('all') ?? []);
  await Promise.all([...scoped, ...all].map((fn) => Promise.resolve().then(fn)));
}
