// Hours of operation in minutes after midnight, America/Los_Angeles. 0 = Sunday.
// Source: the hours table on the existing lennyscasita.com homepage.
const WEEKDAY = [[12 * 60, 15 * 60], [17 * 60, 22 * 60]];
export const SCHEDULE = {
  0: [[13 * 60, 22 * 60]],
  1: WEEKDAY,
  2: WEEKDAY,
  3: WEEKDAY,
  4: WEEKDAY,
  5: [[9 * 60, 15 * 60]],
  6: [],
};

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const formatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Los_Angeles",
  weekday: "short",
  hour: "numeric",
  minute: "numeric",
  hourCycle: "h23",
});

export function laNow(date = new Date()) {
  const parts = formatter.formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type)?.value;
  return {
    day: SHORT.indexOf(get("weekday")),
    minutes: (Number(get("hour")) % 24) * 60 + Number(get("minute")),
  };
}

export function formatTime(minutes) {
  const h24 = Math.floor(minutes / 60);
  const m = minutes % 60;
  const h = ((h24 + 11) % 12) + 1;
  const suffix = h24 < 12 ? "AM" : "PM";
  return m ? `${h}:${String(m).padStart(2, "0")} ${suffix}` : `${h} ${suffix}`;
}

export function getStatus(date = new Date()) {
  const { day, minutes } = laNow(date);

  for (const [open, close] of SCHEDULE[day]) {
    if (minutes >= open && minutes < close) {
      const soon = close - minutes <= 30;
      return { open: true, day, short: soon ? `Closing soon · ${formatTime(close)}` : `Open · until ${formatTime(close)}`, long: `Open now until ${formatTime(close)}` };
    }
  }

  for (let offset = 0; offset < 8; offset += 1) {
    const d = (day + offset) % 7;
    const next = SCHEDULE[d].find(([open]) => offset > 0 || open > minutes);
    if (!next) continue;
    const when = offset === 0 ? formatTime(next[0]) : offset === 1 ? `tomorrow ${formatTime(next[0])}` : `${DAYS[d]} ${formatTime(next[0])}`;
    return { open: false, day, short: `Closed · opens ${when}`, long: `Closed now. Opens ${when}.` };
  }

  return { open: false, day, short: "Closed", long: "Closed" };
}
