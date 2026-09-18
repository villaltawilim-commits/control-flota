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

export async function getDashboardData() {
  const now = new Date();
  const monthStart = Timestamp.fromDate(startOfMonth(now));
  const monthEnd = Timestamp.fromDate(endOfMonth(now));
  const todayStart = Timestamp.fromDate(startOfDay(now));
  const todayEnd = Timestamp.fromDate(endOfDay(now));

  const [vehiclesSnap, fuelMonthSnap, routesMonthSnap] = await Promise.all([
    getDocs(collection(db, "vehicles")),
    getDocs(query(collection(db, "fuelLogs"), where("date", ">=", monthStart), where("date", "<=", monthEnd), fsLimit(1000))),
    getDocs(query(collection(db, "routes"), where("date", ">=", monthStart), where("date", "<=", monthEnd), fsLimit(1000))),
  ]);

  const vehicles = vehiclesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const fuelMonth = fuelMonthSnap.docs.map((d) => d.data());
  const routesMonth = routesMonthSnap.docs.map((d) => d.data());

  const todayMs = { start: todayStart.toMillis(), end: todayEnd.toMillis() };
  const fuelToday = fuelMonth.filter((f) => {
    const t = f.date?.toMillis?.() ?? 0;
    return t >= todayMs.start && t <= todayMs.end;
  });
  const routesToday = routesMonth.filter((r) => {
    const t = r.date?.toMillis?.() ?? 0;
    return t >= todayMs.start && t <= todayMs.end && r.distanceKm != null;
  });

  const statuses = vehicles.map((v) => ({
    vehicle: v,
    status: computeServiceStatus(v.currentMileage, v.lastServiceMileage, v.serviceIntervalKm),
  }));

  // Every active vehicle's service status, not just the ones already due —
  // most-overdue first so it still reads as an alert list at a glance.
  const alerts = statuses
    .filter((s) => s.vehicle.active)
    .sort((a, b) => a.status.remainingKm - b.status.remainingKm);

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
  };
}
