/**
 * Date and Time utilities for India Standard Time (IST / Asia/Kolkata)
 */

export const formatToIndiaDateTime = (dateInput) => {
  if (!dateInput) return "";
  let d;
  if (dateInput instanceof Date) {
    d = dateInput;
  } else if (typeof dateInput === "string") {
    let s = dateInput.trim();
    // If it's a date-only string like "2026-11-12", don't treat as UTC midnight which shifts with timezones
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      const [y, m, day] = s.split("-");
      return `${day}/${m}/${y}`;
    }
    // If ISO format without timezone indicator (like "2026-11-12T11:51:32"), append 'Z' because backend stores UTC
    if (s.includes("T") && !s.endsWith("Z") && !s.includes("+") && !s.match(/-\d{2}:\d{2}$/)) {
      s += "Z";
    }
    d = new Date(s);
  } else {
    d = new Date(dateInput);
  }

  if (isNaN(d.getTime())) return "";

  try {
    const formatter = new Intl.DateTimeFormat("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });

    const parts = formatter.formatToParts(d);
    const map = {};
    parts.forEach((p) => {
      map[p.type] = p.value;
    });
    const dayPeriod = (map.dayPeriod || "").toLowerCase();
    return `${map.day}/${map.month}/${map.year} ${map.hour}:${map.minute} ${dayPeriod}`;
  } catch (e) {
    return d.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
  }
};

export const formatToIndiaDate = (dateInput) => {
  if (!dateInput) return "";
  if (typeof dateInput === "string") {
    const s = dateInput.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      const [y, m, d] = s.split("-");
      return `${d}/${m}/${y}`;
    }
  }
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (isNaN(d.getTime())) return String(dateInput);

  try {
    const formatter = new Intl.DateTimeFormat("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
    return formatter.format(d);
  } catch (e) {
    return d.toLocaleDateString("en-IN");
  }
};

export const formatToIndia12hTime = (timeInput) => {
  if (!timeInput) return "";
  const raw = String(timeInput).trim();
  if (raw.toLowerCase().includes("am") || raw.toLowerCase().includes("pm")) {
    return raw;
  }
  const parts = raw.split(":");
  if (parts.length >= 2) {
    let h = parseInt(parts[0], 10);
    const m = parts[1];
    const ampm = h >= 12 ? "PM" : "AM";
    h = h % 12;
    const h12 = h ? String(h).padStart(2, "0") : "12";
    return `${h12}:${m} ${ampm}`;
  }
  return raw;
};
