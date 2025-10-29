import webpush from 'web-push';

export default async (req, context) => {
  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method Not Allowed' }), { status: 405 });
    }

    const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY } = process.env;
    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
      return new Response(JSON.stringify({ error: 'Missing VAPID keys' }), { status: 500 });
    }

    const { subscription, payload } = await req.json();
    if (!subscription || !subscription.endpoint) {
      return new Response(JSON.stringify({ error: 'Invalid subscription' }), { status: 400 });
    }

    webpush.setVapidDetails('mailto:pokekeeze2@gmail.com', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

    const data = payload || {
      title: 'Todo App',
      body: 'Gửi thử push thành công!',
      icon: '/images/android-chrome-192x192.png',
      badge: '/images/android-chrome-192x192.png',
      url: '/dashboard',
    };

    await webpush.sendNotification(subscription, JSON.stringify(data));

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message || 'Server error' }), { status: 500 });
  }
};
