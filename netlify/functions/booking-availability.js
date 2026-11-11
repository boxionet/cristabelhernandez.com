// Availability engine: real slots from the database.
// GET/POST JSON:
//   { date: 'YYYY-MM-DD', durationMinutes }            -> { date, open, slots[] }
//   { from: 'YYYY-MM-DD', to: 'YYYY-MM-DD', durationMinutes }
//                                                      -> { days: [{date, open, available}] }
// Rules: weekly_schedule, overridden by date_exceptions, minus active
// appointments (pendiente/confirmada + unexpired por_confirmar holds).
const { serviceClient, json } = require("./_booking/supabase");
const {
  computeSlots,
  clinicNow,
  weekdayOf,
  timeToMinutes,
} = require("./_booking/time");

const ACTIVE_STATUSES = ["pendiente", "confirmada", "por_confirmar"];
const MAX_RANGE_DAYS = 62;

function parseInput(event) {
  let raw = {};
  if (event.httpMethod === "POST" && event.body) {
    raw = JSON.parse(event.body);
  } else {
    raw = event.queryStringParameters || {};
  }
  const durationMinutes = parseInt(raw.durationMinutes, 10);
  return { ...raw, durationMinutes };
}

function validateDate(dateISO, todayISO) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateISO || "")) return "bad_date";
  if (dateISO < todayISO) return "date_in_past";
  return null;
}

exports.handler = async (event) => {
  try {
    const input = parseInput(event);
    const duration = input.durationMinutes;
    if (!duration || duration < 15 || duration > 480) {
      return json(400, { error: "bad_duration" });
    }
    const nowInfo = clinicNow();
    const todayISO = nowInfo.dateISO;

    const supabase = serviceClient();

    const from = input.from || input.date;
    const to = input.to || input.date;
    if (!from || !to) return json(400, { error: "bad_date" });
    const errFrom = validateDate(from, todayISO);
    const errTo = validateDate(to, todayISO);
    if (errFrom || errTo) return json(400, { error: errFrom || errTo });

    const [{ data: schedule, error: sErr }, { data: exceptions }, { data: appts }] =
      await Promise.all([
        supabase.from("weekly_schedule").select("weekday,is_open,open_time,close_time"),
        supabase
          .from("date_exceptions")
          .select("date,is_closed,open_time,close_time")
          .gte("date", from)
          .lte("date", to),
        supabase
          .from("appointments")
          .select("date,start_time,duration_minutes,status,confirmation_expires_at")
          .gte("date", from)
          .lte("date", to)
          .in("status", ACTIVE_STATUSES),
      ]);
    if (sErr) throw sErr;

    const nowUtc = Date.now();
    const busyByDate = new Map();
    for (const a of appts || []) {
      if (
        a.status === "por_confirmar" &&
        a.confirmation_expires_at &&
        new Date(a.confirmation_expires_at).getTime() < nowUtc
      ) {
        continue; // expired hold: the sweep will purge it; treat as free
      }
      const start = timeToMinutes(String(a.start_time).slice(0, 5));
      const list = busyByDate.get(a.date) || [];
      list.push({ start, end: start + a.duration_minutes });
      busyByDate.set(a.date, list);
    }

    const exceptionByDate = new Map((exceptions || []).map((e) => [e.date, e]));
    const scheduleByWeekday = new Map((schedule || []).map((s) => [s.weekday, s]));

    function dayInfo(dateISO) {
      const ex = exceptionByDate.get(dateISO);
      let open = false;
      let openTime = null;
      let closeTime = null;
      if (ex) {
        open = !ex.is_closed;
        openTime = ex.open_time;
        closeTime = ex.close_time;
        if (open && (!openTime || !closeTime)) {
          const base = scheduleByWeekday.get(weekdayOf(dateISO));
          if (base) {
            openTime = openTime || base.open_time;
            closeTime = closeTime || base.close_time;
          }
        }
      } else {
        const base = scheduleByWeekday.get(weekdayOf(dateISO));
        if (base && base.is_open) {
          open = true;
          openTime = base.open_time;
          closeTime = base.close_time;
        }
      }
      if (!open) return { date: dateISO, open: false, slots: [] };
      const slots = computeSlots({
        openTime: String(openTime).slice(0, 5),
        closeTime: String(closeTime).slice(0, 5),
        durationMinutes: duration,
        busy: busyByDate.get(dateISO) || [],
        isToday: dateISO === todayISO,
        nowMinutes: nowInfo.minutes,
      });
      return { date: dateISO, open: true, slots };
    }

    if (input.date && !input.from) {
      const info = dayInfo(input.date);
      return json(200, info);
    }

    // Days mode — cap the range.
    const days = [];
    let cursor = from;
    let guard = 0;
    while (cursor <= to && guard <= MAX_RANGE_DAYS) {
      const info = dayInfo(cursor);
      days.push({ date: info.date, open: info.open, available: info.slots.length > 0 });
      const next = new Date(`${cursor}T12:00:00Z`);
      next.setUTCDate(next.getUTCDate() + 1);
      cursor = next.toISOString().slice(0, 10);
      guard += 1;
    }
    return json(200, { days });
  } catch (e) {
    console.error("availability error", e);
    return json(500, { error: "availability_failed" });
  }
};
