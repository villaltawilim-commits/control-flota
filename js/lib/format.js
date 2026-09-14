export function formatCurrency(value) {
  const n = Number(value) || 0;
  return `Q${n.toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Odometers are read in miles; kilometers are shown alongside as a reference
// conversion only (the stored number itself is always the miles reading).
const KM_PER_MILE = 1.609344;

export function formatDistance(value) {
  const miles = Math.round(Number(value) || 0);
  const km = Math.round(miles * KM_PER_MILE);
  return `${miles.toLocaleString("es-GT")} mi (${km.toLocaleString("es-GT")} km)`;
}

export function formatMilesOnly(value) {
  return `${Math.round(Number(value) || 0).toLocaleString("es-GT")} mi`;
}

export function formatNumber(value, decimals = 0) {
  const n = Number(value) || 0;
  return n.toLocaleString("es-GT", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export function toDate(value) {
  if (!value) return null;
  if (value.toDate) return value.toDate(); // Firestore Timestamp
  return value instanceof Date ? value : new Date(value);
}

export function formatDate(value) {
  const d = toDate(value);
  if (!d) return "—";
  return d.toLocaleDateString("es-GT", { day: "2-digit", month: "short", year: "numeric" });
}

export function formatDateTime(value) {
  const d = toDate(value);
  if (!d) return "—";
  return d.toLocaleString("es-GT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDateInput(value) {
  const d = toDate(value);
  if (!d) return "";
  return d.toISOString().slice(0, 10);
}

export function todayInput() {
  return new Date().toISOString().slice(0, 10);
}

export function nowTimeInput() {
  return new Date().toTimeString().slice(0, 5);
}

export function escapeHtml(str) {
  if (str == null) return "";
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
