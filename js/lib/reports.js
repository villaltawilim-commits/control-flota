import { db, collection, getDocs, query, where, orderBy, fsLimit, Timestamp } from "./firebase.js";
import { getVehicles, getUsers } from "./data.js";

function dateRange(filters) {
  const range = {};
  if (filters.dateFrom) range.gte = Timestamp.fromDate(new Date(`${filters.dateFrom}T00:00:00`));
  if (filters.dateTo) range.lte = Timestamp.fromDate(new Date(`${filters.dateTo}T23:59:59`));
  return range;
}

function inRange(ts, range) {
  const ms = ts?.toMillis?.();
  if (ms == null) return false;
  if (range.gte && ms < range.gte.toMillis()) return false;
  if (range.lte && ms > range.lte.toMillis()) return false;
  return true;
}

export async function getReportFilterOptions() {
  const [vehicles, users] = await Promise.all([getVehicles(), getUsers()]);
  return { vehicles, users: users.filter((u) => u.active) };
}

export async function getRouteReport(filters) {
  const range = dateRange(filters);

  let routesQuery;
  if (filters.vehicleId) {
    routesQuery = query(collection(db, "routes"), where("vehicleId", "==", filters.vehicleId), where("status", "==", "CLOSED"));
  } else {
    routesQuery = query(collection(db, "routes"), where("status", "==", "CLOSED"), fsLimit(500));
  }
  const [routesSnap, vehiclesSnap, usersSnap, fuelSnap] = await Promise.all([
    getDocs(routesQuery),
    getDocs(collection(db, "vehicles")),
    getDocs(collection(db, "users")),
    getDocs(collection(db, "fuelLogs")),
  ]);

  const vehiclesById = Object.fromEntries(vehiclesSnap.docs.map((d) => [d.id, d.data()]));
  const usersById = Object.fromEntries(usersSnap.docs.map((d) => [d.id, d.data()]));
  const fuelByRoute = {};
  for (const d of fuelSnap.docs) {
    const f = d.data();
    if (!f.routeId) continue;
    (fuelByRoute[f.routeId] ||= []).push(f);
  }

  let routes = routesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  routes = routes.filter((r) => inRange(r.date, range));
  if (filters.userId) routes = routes.filter((r) => r.driverId === filters.userId);
  if (filters.destination) {
    const needle = filters.destination.toLowerCase();
    routes = routes.filter((r) => r.destination?.toLowerCase().includes(needle));
  }
  if (filters.plate) {
    const needle = filters.plate.toLowerCase();
    routes = routes.filter((r) => vehiclesById[r.vehicleId]?.plate?.toLowerCase().includes(needle));
  }

  routes.sort((a, b) => (b.date?.toMillis?.() ?? 0) - (a.date?.toMillis?.() ?? 0));

  return routes.map((r) => {
    const vehicle = vehiclesById[r.vehicleId] || {};
    const driver = usersById[r.driverId] || {};
    const logs = fuelByRoute[r.id] || [];
    const fuelUsed = logs.reduce((s, f) => s + f.quantity, 0);
    const fuelCost = logs.reduce((s, f) => s + f.total, 0);
    const distanceKm = r.distanceKm ?? 0;
    const costPerKm = distanceKm > 0 ? fuelCost / distanceKm : null;

    return {
      id: r.id,
      date: r.date,
      vehicle: `${vehicle.brand || ""} ${vehicle.model || ""}`.trim(),
      plate: vehicle.plate || "",
      destination: r.destination,
      driver: driver.name || "—",
      departureMileage: r.departureMileage,
      arrivalMileage: r.arrivalMileage,
      distanceKm,
      fuelUsed,
      fuelCost,
      costPerKm,
    };
  });
}

const SORTERS = {
  gasto_desc: (a, b) => b.costTotal - a.costTotal,
  gasto_asc: (a, b) => a.costTotal - b.costTotal,
  costo_km_desc: (a, b) => (b.costPerKm ?? 0) - (a.costPerKm ?? 0),
  costo_km_asc: (a, b) => (a.costPerKm ?? Infinity) - (b.costPerKm ?? Infinity),
  km_desc: (a, b) => b.distanceKm - a.distanceKm,
};

export async function getPerformanceReport(filters, sort = "gasto_desc") {
  const range = dateRange(filters);
  const [vehiclesSnap, routesSnap, fuelSnap] = await Promise.all([
    getDocs(collection(db, "vehicles")),
    getDocs(query(collection(db, "routes"), where("status", "==", "CLOSED"), fsLimit(1000))),
    getDocs(query(collection(db, "fuelLogs"), fsLimit(1000))),
  ]);

  let vehicles = vehiclesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  if (filters.vehicleId) vehicles = vehicles.filter((v) => v.id === filters.vehicleId);
  if (filters.plate) {
    const needle = filters.plate.toLowerCase();
    vehicles = vehicles.filter((v) => v.plate?.toLowerCase().includes(needle));
  }

  const routes = routesSnap.docs.map((d) => d.data()).filter((r) => inRange(r.date, range));
  let fuelLogs = fuelSnap.docs.map((d) => d.data()).filter((f) => inRange(f.date, range));
  if (filters.userId) fuelLogs = fuelLogs.filter((f) => f.userId === filters.userId);
  if (filters.fuelType) fuelLogs = fuelLogs.filter((f) => f.fuelType === filters.fuelType);

  const results = vehicles.map((vehicle) => {
    const vRoutes = routes.filter((r) => r.vehicleId === vehicle.id);
    const vFuel = fuelLogs.filter((f) => f.vehicleId === vehicle.id);

    const distanceKm = vRoutes.reduce((s, r) => s + (r.distanceKm || 0), 0);
    const fuelConsumed = vFuel.reduce((s, f) => s + f.quantity, 0);
    const costTotal = vFuel.reduce((s, f) => s + f.total, 0);
    const costPerKm = distanceKm > 0 ? costTotal / distanceKm : null;
    const avgConsumption = fuelConsumed > 0 ? distanceKm / fuelConsumed : null;

    return {
      vehicleId: vehicle.id,
      vehicle: `${vehicle.brand} ${vehicle.model}`,
      plate: vehicle.plate,
      distanceKm,
      fuelConsumed,
      costTotal,
      costPerKm,
      avgConsumption,
      chargeCount: vFuel.length,
    };
  });

  return results.filter((r) => r.chargeCount > 0 || r.distanceKm > 0).sort(SORTERS[sort] || SORTERS.gasto_desc);
}
