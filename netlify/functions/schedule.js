import webpush from 'web-push';

// Simple in-memory scheduler (for demo; production should use a job queue/database)
const scheduledJobs = new Map();

export default async (req, context) => {
  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method Not Allowed' }), { status: 405 });
    }

    const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY } = process.env;
    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
      return new Response(JSON.stringify({ error: 'Missing VAPID keys' }), { status: 500 });
    }

    const { subscription, tasks } = await req.json();
    if (!subscription || !Array.isArray(tasks)) {
      return new Response(JSON.stringify({ error: 'Invalid payload' }), { status: 400 });
    }

    webpush.setVapidDetails('mailto:admin@example.com', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

    // Clear old jobs for this subscription
    const subKey = subscription.endpoint;
    if (scheduledJobs.has(subKey)) {
      scheduledJobs.get(subKey).forEach((timer) => clearTimeout(timer));
    }
    scheduledJobs.set(subKey, []);

    // Schedule notifications for each task
    tasks.forEach((task) => {
      if (!task.dueDate) return;

      const dueDateMatch = task.dueDate.match(/(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})/);
      if (!dueDateMatch) return;
      const [_, dd, mm, yyyy, HH, II] = dueDateMatch;
      const dueDate = new Date(`${yyyy}-${mm}-${dd}T${HH}:${II}:00`);
      const now = Date.now();
      const dueDiff = dueDate.getTime() - now;

      // Schedule main notification
      if (dueDiff > 0 && dueDiff < 7 * 24 * 60 * 60 * 1000) {
        // Only schedule if within 7 days
        const timer = setTimeout(async () => {
          try {
            const payload = {
              title: 'Nhắc nhở công việc!',
              body: `Đã đến hạn: "${task.text}"`,
              icon: '/images/android-chrome-192x192.png',
              badge: '/images/android-chrome-192x192.png',
              url: '/dashboard',
            };
            await webpush.sendNotification(subscription, JSON.stringify(payload));
          } catch (err) {
            console.error('Push send error:', err);
          }
        }, dueDiff);
        scheduledJobs.get(subKey).push(timer);
      }

      // Schedule reminder if configured
      const reminderMinutes = Number(task.reminderMinutes || 0);
      if (reminderMinutes > 0) {
        const preTime = dueDate.getTime() - reminderMinutes * 60 * 1000;
        const preDiff = preTime - now;
        if (preDiff > 0 && preDiff < 7 * 24 * 60 * 60 * 1000) {
          const timer = setTimeout(async () => {
            try {
              const payload = {
                title: 'Sắp đến hạn',
                body: `Còn ${reminderMinutes} phút: "${task.text}"`,
                icon: '/images/android-chrome-192x192.png',
                badge: '/images/android-chrome-192x192.png',
                url: '/dashboard',
              };
              await webpush.sendNotification(subscription, JSON.stringify(payload));
            } catch (err) {
              console.error('Push reminder error:', err);
            }
          }, preDiff);
          scheduledJobs.get(subKey).push(timer);
        }
      }
    });

    return new Response(JSON.stringify({ ok: true, scheduled: scheduledJobs.get(subKey).length }), {
      status: 200,
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message || 'Server error' }), { status: 500 });
  }
};
