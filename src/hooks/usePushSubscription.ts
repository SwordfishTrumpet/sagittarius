import { useCallback, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { jmapClient } from '../api/jmap';

const WEBPUSH_CAP = 'urn:ietf:params:jmap:webpush';

export function useHasWebPushCapability(): boolean {
  const accountId = jmapClient.getPrimaryAccount();
  return !!(jmapClient.hasCapability(WEBPUSH_CAP) && accountId);
}

export function useNotificationPermission() {
  const [permission, setPermission] = useState<NotificationPermission | null>(
    typeof window !== 'undefined' && 'Notification' in window
      ? Notification.permission
      : null
  );

  const requestPermission = useCallback(async () => {
    if (!('Notification' in window)) return null;
    const result = await Notification.requestPermission();
    setPermission(result);
    return result;
  }, []);

  return { permission, requestPermission };
}

export function usePushSubscription() {
  const accountId = jmapClient.getPrimaryAccount();
  const { permission, requestPermission } = useNotificationPermission();

  const { data: existingSubs } = useQuery({
    queryKey: ['pushSubscriptions', accountId],
    queryFn: () => jmapClient.getPushSubscriptions(null, accountId ?? undefined),
    enabled: jmapClient.hasCapability(WEBPUSH_CAP) && !!accountId && permission === 'granted',
    staleTime: Infinity,
  });

  const subscribe = useMutation({
    mutationFn: async () => {
      if (!accountId) throw new Error('No account');
      if (!('serviceWorker' in navigator)) throw new Error('Service workers not supported');

      const registration = await navigator.serviceWorker.ready;
      let browserSub = await registration.pushManager.getSubscription();

      if (!browserSub) {
        const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
        if (!vapidPublicKey) throw new Error('VAPID public key not configured');

        const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);
        browserSub = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey,
        });
      }

      const jmapSub = {
        deviceClientId: crypto.randomUUID(),
        url: browserSub.endpoint,
        keys: {
          p256dh: arrayBufferToBase64(browserSub.getKey('p256dh')),
          auth: arrayBufferToBase64(browserSub.getKey('auth')),
        },
      };

      return jmapClient.createPushSubscription(jmapSub, accountId);
    },
  });

  const unsubscribe = useMutation({
    mutationFn: async (subscriptionId: string) => {
      if (!accountId) throw new Error('No account');

      const registration = await navigator.serviceWorker.ready;
      const browserSub = await registration.pushManager.getSubscription();
      if (browserSub) {
        await browserSub.unsubscribe();
      }

      return jmapClient.destroyPushSubscriptions([subscriptionId], accountId);
    },
  });

  return { existingSubs, subscribe, unsubscribe, permission, requestPermission };
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function arrayBufferToBase64(buffer: ArrayBuffer | null): string {
  if (!buffer) return '';
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}
