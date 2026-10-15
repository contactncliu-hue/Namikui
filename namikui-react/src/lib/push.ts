import { db } from './supabase';
const KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string;
const toBytes = (s: string) => {
  const p = '='.repeat((4 - (s.length % 4)) % 4);
  const r = atob((s + p).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(r, (c) => c.charCodeAt(0));
};
export async function enablePush(username: string): Promise<string> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return 'unsupported';
  if ((await Notification.requestPermission()) !== 'granted') return 'denied';
  const reg = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toBytes(KEY) });
  const j = sub.toJSON();
  const { data: { session } } = await db.auth.getSession();
  const { error } = await db.from('push_subscriptions').upsert(
    { endpoint: j.endpoint, user_id: session?.user.id, username, p256dh: j.keys?.p256dh, auth: j.keys?.auth },
    { onConflict: 'endpoint' }
  );
  return error ? 'error' : 'ok';
}
