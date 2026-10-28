// ════════════════════════════════════════════════════════════════════════
//  VeriPulse — Capacitor push-notification registration (client).
//  Dynamic import of @capacitor/push-notifications so the web build keeps
//  working without the plugin installed. The web build gets a graceful
//  no-op; the Capacitor shell lights up when the plugin ships.
// ════════════════════════════════════════════════════════════════════════

type Platform = 'ios' | 'android' | 'web';

function platform(): Platform {
  if (typeof navigator === 'undefined') return 'web';
  if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) return 'ios';
  if (/Android/i.test(navigator.userAgent)) return 'android';
  return 'web';
}

interface PushPlugin {
  requestPermissions: () => Promise<{ receive: 'granted' | 'denied' | 'prompt' }>;
  register: () => Promise<void>;
  addListener: (
    event: string,
    cb: (payload: { value?: string; title?: string; body?: string; data?: Record<string, unknown> }) => void,
  ) => void;
}

async function getPlugin(): Promise<PushPlugin | null> {
  try {
    const mod = (await import(
      /* webpackIgnore: true */ '@capacitor/push-notifications' as string
    )) as unknown as { PushNotifications?: PushPlugin };
    return mod.PushNotifications ?? null;
  } catch {
    return null;
  }
}

/** Register the device for push and POST the token to /api/push/register. */
export async function registerForPushNotifications(apiOrigin = ''): Promise<void> {
  const Push = await getPlugin();
  if (!Push) return;

  const perm = await Push.requestPermissions();
  if (perm.receive !== 'granted') return;

  Push.addListener('registration', (evt) => {
    if (!evt.value) return;
    const base = apiOrigin.replace(/\/+$/, '');
    void fetch(`${base}/api/push/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: evt.value, platform: platform() }),
      credentials: 'include',
      keepalive: true,
    });
  });

  Push.addListener('registrationError', () => {
    /* swallow — notification features degrade gracefully without a token */
  });

  await Push.register();
}
