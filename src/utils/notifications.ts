import type { ReadyPushNotification } from '../shared/catalog';

let swRegistration: ServiceWorkerRegistration | null = null;

export async function registerNotificationServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }
  try {
    swRegistration = await navigator.serviceWorker.register('/sw.js');
    return swRegistration;
  } catch {
    return null;
  }
}

export function getNotificationPermissionState(): NotificationPermission | 'unsupported' {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission;
}

export async function enableDeviceNotifications(
  authToken: string | null,
  pickupCode?: string
): Promise<{ ok: boolean; permission: NotificationPermission | 'unsupported'; message: string }> {
  await registerNotificationServiceWorker();

  let permission: NotificationPermission | 'unsupported' = getNotificationPermissionState();
  if (permission === 'default' && 'Notification' in window) {
    try {
      permission = await Notification.requestPermission();
    } catch {
      permission = 'denied';
    }
  }

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (authToken) {
      headers.Authorization = `Bearer ${authToken}`;
    }
    await fetch('/api/notifications/subscribe', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        pickupCode: pickupCode || undefined,
        deviceLabel: navigator.userAgent.slice(0, 100),
      }),
    });
  } catch {
    return {
      ok: false,
      permission,
      message: 'Could not register device subscription with the server.',
    };
  }

  if (permission === 'granted') {
    return {
      ok: true,
      permission,
      message: 'Device push notifications enabled for Ready-for-Pickup alerts.',
    };
  }

  if (permission === 'denied') {
    return {
      ok: true,
      permission,
      message:
        'Browser alerts are blocked in this context; live in-app pickup alerts remain active.',
    };
  }

  return {
    ok: true,
    permission,
    message: 'Subscribed to live Ready-for-Pickup alerts for this session.',
  };
}

export async function triggerBrowserReadyNotification(
  notif: ReadyPushNotification
): Promise<void> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return;
  }
  if (Notification.permission !== 'granted') {
    return;
  }

  const title = `Order ${notif.pickupCode} Ready for Pickup`;
  const body = `Collect at ${notif.counterName} (${notif.counterLocation})`;

  try {
    const reg = swRegistration || (await navigator.serviceWorker?.getRegistration?.());
    if (reg && typeof reg.showNotification === 'function') {
      await reg.showNotification(title, {
        body,
        tag: `printease-${notif.pickupCode}`,
        requireInteraction: true,
      });
      return;
    }
  } catch {
    // Fallback to standard Notification API
  }

  try {
    new Notification(title, {
      body,
      tag: `printease-${notif.pickupCode}`,
    });
  } catch {
    // Ignore restricted iframe Notification errors
  }
}
