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

    webpush.setVapidDetails('mailto:pokekeeze2@gmail.com', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

    // Clear old jobs for this subscription
    const subKey = subscription.endpoint;
    if (scheduledJobs.has(subKey)) {
      scheduledJobs.get(subKey).forEach((timer) => clearTimeout(timer));
    }
    scheduledJobs.set(subKey, []);

    // Schedule a SINGLE notification per task at notifyAtISO (preferred) or derive from dueDate/reminder
    let scheduledCount = 0;
    let sentImmediate = 0;

    const now = Date.now();

    tasks.forEach((task) => {
      // Prefer client-computed notifyAtISO (already applied quiet hours)
      let when = null;
      if (task.notifyAtISO) {
        const t = new Date(task.notifyAtISO);
        if (!isNaN(t.getTime())) when = t;
      }

      // Fallback: parse dueDate (dd/mm/yyyy HH:mm) and apply reminderMinutes
      if (!when && task.dueDate) {
        const m = task.dueDate.match(/(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})/);
        if (m) {
          const [_, dd, mm, yyyy, HH, II] = m;
          const due = new Date(`${yyyy}-${mm}-${dd}T${HH}:${II}:00`);
          if (!isNaN(due.getTime())) {
            const remind = Number(task.reminderMinutes || 0);
            when = new Date(due.getTime() - Math.max(0, remind) * 60 * 1000);
          }
        }
      }

      if (!when) return; // nothing to schedule

      const diff = when.getTime() - now;

      // If time already passed (e.g., app opened after due) -> send immediately once
      if (diff <= 1000) {
        (async () => {
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
            console.error('Push send (immediate) error:', err);
          }
        })();
        sentImmediate++;
        return;
      }

      // Dev-only: schedule with setTimeout if within 7 days
      if (diff < 7 * 24 * 60 * 60 * 1000) {
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
            console.error('Push send (timer) error:', err);
          }
        }, diff);
        scheduledJobs.get(subKey).push(timer);
        scheduledCount++;
      }
    });

    return new Response(JSON.stringify({ ok: true, scheduled: scheduledCount, sentImmediate }), {
      status: 200,
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message || 'Server error' }), { status: 500 });
  }
};
