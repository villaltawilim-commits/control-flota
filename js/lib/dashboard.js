import { db, collection, getDocs, query, where, orderBy, fsLimit, Timestamp } from "./firebase.js";
import { computeServiceStatus } from "./vehicle-status.js";

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function endOfDay(d) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}
function startOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function endOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}

const USAGE_WINDOW_DAYS = 30;

export async function getDashboardData() {
  const now = new Date();
  const monthStart = Timestamp.fromDate(startOfMonth(now));
  const monthEnd = Timestamp.fromDate(endOfMonth(now));
  const todayStart = Timestamp.fromDate(startOfDay(now));
  const todayEnd = Timestamp.fromDate(endOfDay(now));
  const usageWindowStart = Timestamp.fromDate(new Date(now.getTime() - USAGE_WINDOW_DAYS * 86400000));

  const [vehiclesSnap, fuelMonthSnap, routesMonthSnap, openRoutesSnap, recentRoutesSnap] = await Promise.all([
    getDocs(collection(db, "vehicles")),
    getDocs(query(collection(db, "fuelLogs"), where("date", ">=", monthStart), where("date", "<=", monthEnd), fsLimit(1000))),
    getDocs(query(collection(db, "routes"), where("date", ">=", monthStart), where("date", "<=", monthEnd), fsLimit(1000))),
    getDocs(query(collection(db, "routes"), where("status", "==", "OPEN"))),
    getDocs(query(collection(db, "routes"), where("date", ">=", usageWindowStart), fsLimit(1000))),
  ]);

  const vehicles = vehiclesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const fuelMonth = fuelMonthSnap.docs.map((d) => d.data());
  const routesMonth = routesMonthSnap.docs.map((d) => d.data());
  const busyVehicleIds = new Set(openRoutesSnap.docs.map((d) => d.data().vehicleId));

  // Rolling last-30-days km per vehicle, used to estimate how many calendar
  // days each vehicle has left before its next service at its own pace of
  // use -- two vehicles can have the same mileage buffer, but the one driven
  // twice as often will actually hit its service threshold much sooner.
  const recentKmByVehicle = {};
  for (const doc of recentRoutesSnap.docs) {
    const r = doc.data();
    if (r.distanceKm == null) continue;
    recentKmByVehicle[r.vehicleId] = (recentKmByVehicle[r.vehicleId] || 0) + r.distanceKm;
  }

  const todayMs = { start: todayStart.toMillis(), end: todayEnd.toMillis() };
  const fuelToday = fuelMonth.filter((f) => {
    const t = f.date?.toMillis?.() ?? 0;
    return t >= todayMs.start && t <= todayMs.end;
  });
  const routesToday = routesMonth.filter((r) => {
    const t = r.date?.toMillis?.() ?? 0;
    return t >= todayMs.start && t <= todayMs.end && r.distanceKm != null;
  });

  const statuses = vehicles.map((v) => {
    const status = computeServiceStatus(v.currentMileage, v.lastServiceMileage, v.serviceIntervalKm);
    const avgDailyKm = (recentKmByVehicle[v.id] || 0) / USAGE_WINDOW_DAYS;
    // No recent usage to estimate a pace from: treat as "not on track to need
    // service soon" (or "already overdue with no pace data") using a large
    // finite sentinel instead of +/-Infinity, which breaks subtraction-based
    // sort comparators (Infinity - Infinity is NaN).
    const daysUntilDue = avgDailyKm > 0 ? status.remainingKm / avgDailyKm : status.remainingKm >= 0 ? 1e9 : -1e9;
    return { vehicle: v, status, avgDailyKm, daysUntilDue };
  });

  // Every active vehicle's service status, not just the ones already due —
  // most-overdue first so it still reads as an alert list at a glance.
  const alerts = statuses
    .filter((s) => s.vehicle.active)
    .sort((a, b) => a.status.remainingKm - b.status.remainingKm);

  // Which vehicle should go out today? Among active vehicles that aren't
  // already on the road, prefer the one with the most estimated calendar
  // days left before its next service at its own recent pace of use (not
  // just raw remaining mileage) — that way a vehicle driven heavily doesn't
  // get sent out again just because its odometer buffer looks large, and a
  // rarely-used vehicle with a smaller buffer can still rank ahead of one
  // that's about to hit its limit within days at its current usage rate.
  // Remaining mileage is the tie-breaker when both are without recent usage.
  // Even if every eligible vehicle is already overdue for service, still
  // suggest the least-bad one (the fleet may simply not have a clean option
  // today) — only skip the suggestion when literally nothing is available.
  const eligibleForRoute = statuses.filter((s) => s.vehicle.active && !busyVehicleIds.has(s.vehicle.id));
  const routeSuggestion = eligibleForRoute.length
    ? eligibleForRoute.slice().sort((a, b) => b.daysUntilDue - a.daysUntilDue || b.status.remainingKm - a.status.remainingKm)[0]
    : null;

  const sum = (arr, key) => arr.reduce((s, x) => s + (Number(x[key]) || 0), 0);

  return {
    vehicles: {
      total: vehicles.length,
      active: vehicles.filter((v) => v.active).length,
      inactive: vehicles.filter((v) => !v.active).length,
    },
    fuel: {
      todayTotal: sum(fuelToday, "total"),
      monthTotal: sum(fuelMonth, "total"),
      monthQuantity: sum(fuelMonth, "quantity"),
    },
    mileage: {
      today: sum(routesToday, "distanceKm"),
      month: sum(
        routesMonth.filter((r) => r.distanceKm != null),
        "distanceKm"
      ),
    },
    maintenance: {
      warning: statuses.filter((s) => s.vehicle.active && s.status.alertLevel === "warning").length,
      urgent: statuses.filter((s) => s.vehicle.active && s.status.alertLevel === "urgent").length,
    },
    alerts,
    routeSuggestion,
  };
}
