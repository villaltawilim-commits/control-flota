import {
  db,
  storage,
  collection,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  fsLimit,
  serverTimestamp,
  Timestamp,
  writeBatch,
  storageRef,
  uploadBytes,
  getDownloadURL,
  deleteObject,
  adminCreateAuthUser,
} from "./firebase.js";
import { computeFlatPermissions } from "./permissions.js";

function toTimestamp(dateStr) {
  return Timestamp.fromDate(new Date(dateStr));
}

function toTimestampWithTime(dateStr, timeStr) {
  if (!timeStr) return null;
  return Timestamp.fromDate(new Date(`${dateStr}T${timeStr}`));
}

export async function logAudit(tableName, recordId, action, userId, changes) {
  await addDoc(collection(db, "auditLogs"), {
    tableName,
    recordId,
    action,
    userId,
    changes: changes ? JSON.stringify(changes) : null,
    createdAt: serverTimestamp(),
  });
}

/* ---------------- Vehicles ---------------- */

export async function getVehicles() {
  const snap = await getDocs(query(collection(db, "vehicles"), orderBy("brand")));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getVehicle(id) {
  const snap = await getDoc(doc(db, "vehicles", id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function createVehicle(data, user) {
  const existing = await getDocs(query(collection(db, "vehicles"), where("plate", "==", data.plate)));
  if (!existing.empty) throw new Error("Ya existe un vehículo con esta placa.");

  const ref = await addDoc(collection(db, "vehicles"), {
    ...data,
    lastServiceDate: data.lastServiceDate ? toTimestamp(data.lastServiceDate) : null,
    createdById: user.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await logAudit("Vehicle", ref.id, "CREATE", user.uid, data);
  return ref.id;
}

export async function updateVehicle(id, data, user) {
  const existing = await getDocs(query(collection(db, "vehicles"), where("plate", "==", data.plate)));
  if (existing.docs.some((d) => d.id !== id)) throw new Error("Ya existe otro vehículo con esta placa.");

  await updateDoc(doc(db, "vehicles", id), {
    ...data,
    lastServiceDate: data.lastServiceDate ? toTimestamp(data.lastServiceDate) : null,
    updatedAt: serverTimestamp(),
  });
  await logAudit("Vehicle", id, "UPDATE", user.uid, data);
}

export async function toggleVehicleActive(id, active, user) {
  await updateDoc(doc(db, "vehicles", id), { active, updatedAt: serverTimestamp() });
  await logAudit("Vehicle", id, "UPDATE", user.uid, { active });
}

export async function deleteVehicle(id, user) {
  const [routes, fuel, maint] = await Promise.all([
    getDocs(query(collection(db, "routes"), where("vehicleId", "==", id), fsLimit(1))),
    getDocs(query(collection(db, "fuelLogs"), where("vehicleId", "==", id), fsLimit(1))),
    getDocs(query(collection(db, "maintenances"), where("vehicleId", "==", id), fsLimit(1))),
  ]);
  if (!routes.empty || !fuel.empty || !maint.empty) {
    throw new Error("No se puede eliminar: el vehículo tiene registros asociados. Desactívalo en su lugar.");
  }
  await deleteDoc(doc(db, "vehicles", id));
  await logAudit("Vehicle", id, "DELETE", user.uid, null);
}

/* ---------------- Routes ---------------- */

export async function getRoutesByVehicle(vehicleId, take = 15) {
  const snap = await getDocs(
    query(collection(db, "routes"), where("vehicleId", "==", vehicleId), orderBy("date", "desc"), fsLimit(take))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getRoutes({ vehicleId } = {}) {
  let list;
  if (vehicleId) {
    const snap = await getDocs(
      query(collection(db, "routes"), where("vehicleId", "==", vehicleId), orderBy("date", "desc"), fsLimit(200))
    );
    list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } else {
    const snap = await getDocs(query(collection(db, "routes"), orderBy("date", "desc"), fsLimit(60)));
    list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }
  return list;
}

export async function getRoute(id) {
  const snap = await getDoc(doc(db, "routes", id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function createRoute(data, user) {
  const vehicleRef = doc(db, "vehicles", data.vehicleId);
  const vehicleSnap = await getDoc(vehicleRef);
  if (!vehicleSnap.exists()) throw new Error("Vehículo no encontrado.");
  const vehicle = vehicleSnap.data();
  if (!vehicle.active) throw new Error("Este vehículo está inactivo.");
  if (data.departureMileage < vehicle.currentMileage) {
    throw new Error(`El kilometraje de salida no puede ser menor al último registrado (${vehicle.currentMileage} km).`);
  }

  const batch = writeBatch(db);
  const routeRef = doc(collection(db, "routes"));
  batch.set(routeRef, {
    date: toTimestamp(data.date),
    vehicleId: data.vehicleId,
    driverId: user.uid,
    destination: data.destination,
    departureTime: toTimestampWithTime(data.date, data.departureTime),
    departureMileage: data.departureMileage,
    arrivalTime: null,
    arrivalMileage: null,
    distanceKm: null,
    status: "OPEN",
    observations: data.observations || null,
    createdById: user.uid,
    updatedById: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  if (data.departureMileage > vehicle.currentMileage) {
    batch.update(vehicleRef, { currentMileage: data.departureMileage, updatedAt: serverTimestamp() });
  }
  await batch.commit();
  await logAudit("Route", routeRef.id, "CREATE", user.uid, data);
  return routeRef.id;
}

export async function closeRoute(id, data, user) {
  const routeRef = doc(db, "routes", id);
  const routeSnap = await getDoc(routeRef);
  if (!routeSnap.exists()) throw new Error("Ruta no encontrada.");
  const route = routeSnap.data();
  if (route.status === "CLOSED") throw new Error("Esta ruta ya fue cerrada.");
  if (data.arrivalMileage < route.departureMileage) {
    throw new Error(`El kilometraje de entrada no puede ser menor al de salida (${route.departureMileage} km).`);
  }

  const distanceKm = data.arrivalMileage - route.departureMileage;
  const dateStr = route.date.toDate().toISOString().slice(0, 10);
  const vehicleRef = doc(db, "vehicles", route.vehicleId);
  const vehicleSnap = await getDoc(vehicleRef);
  const vehicle = vehicleSnap.data();

  const batch = writeBatch(db);
  batch.update(routeRef, {
    arrivalTime: toTimestampWithTime(dateStr, data.arrivalTime),
    arrivalMileage: data.arrivalMileage,
    distanceKm,
    status: "CLOSED",
    observations: data.observations || route.observations || null,
    updatedById: user.uid,
    updatedAt: serverTimestamp(),
  });
  if (vehicle && data.arrivalMileage > vehicle.currentMileage) {
    batch.update(vehicleRef, { currentMileage: data.arrivalMileage, updatedAt: serverTimestamp() });
  }
  await batch.commit();
  await logAudit("Route", id, "UPDATE", user.uid, { ...data, distanceKm, status: "CLOSED" });
}

export async function updateRoute(id, data, user) {
  const dateStr = data.date;
  const arrivalMileage = data.arrivalMileage != null && data.arrivalMileage !== "" ? Number(data.arrivalMileage) : null;
  if (arrivalMileage != null && arrivalMileage < data.departureMileage) {
    throw new Error("El kilometraje de entrada no puede ser menor al de salida.");
  }
  const distanceKm = arrivalMileage != null ? arrivalMileage - data.departureMileage : null;

  await updateDoc(doc(db, "routes", id), {
    date: toTimestamp(dateStr),
    vehicleId: data.vehicleId,
    destination: data.destination,
    departureTime: toTimestampWithTime(dateStr, data.departureTime),
    departureMileage: data.departureMileage,
    arrivalTime: toTimestampWithTime(dateStr, data.arrivalTime),
    arrivalMileage,
    distanceKm,
    status: arrivalMileage != null ? "CLOSED" : "OPEN",
    observations: data.observations || null,
    updatedById: user.uid,
    updatedAt: serverTimestamp(),
  });
  await logAudit("Route", id, "UPDATE", user.uid, data);
}

export async function deleteRoute(id, user) {
  const fuelSnap = await getDocs(query(collection(db, "fuelLogs"), where("routeId", "==", id), fsLimit(1)));
  if (!fuelSnap.empty) throw new Error("No se puede eliminar: la ruta tiene cargas de combustible asociadas.");
  await deleteDoc(doc(db, "routes", id));
  await logAudit("Route", id, "DELETE", user.uid, null);
}

/* ---------------- Fuel logs ---------------- */

export async function getFuelLogsByVehicle(vehicleId, take = 15) {
  const snap = await getDocs(
    query(collection(db, "fuelLogs"), where("vehicleId", "==", vehicleId), orderBy("date", "desc"), fsLimit(take))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getFuelLogsByRoute(routeId) {
  const snap = await getDocs(query(collection(db, "fuelLogs"), where("routeId", "==", routeId)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getFuelLogs({ vehicleId } = {}) {
  const snap = vehicleId
    ? await getDocs(query(collection(db, "fuelLogs"), where("vehicleId", "==", vehicleId), orderBy("date", "desc"), fsLimit(200)))
    : await getDocs(query(collection(db, "fuelLogs"), orderBy("date", "desc"), fsLimit(60)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getFuelLog(id) {
  const snap = await getDoc(doc(db, "fuelLogs", id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

async function uploadPhoto(fuelLogId, kind, file) {
  const ext = (file.type.split("/")[1] || "jpg").replace("jpeg", "jpg");
  const ref = storageRef(storage, `photos/${fuelLogId}/${kind}.${ext}`);
  await uploadBytes(ref, file, { contentType: file.type });
  return { path: ref.fullPath, url: await getDownloadURL(ref) };
}

export async function createFuelLog(data, files, user, isAdmin) {
  const vehicleRef = doc(db, "vehicles", data.vehicleId);
  const vehicleSnap = await getDoc(vehicleRef);
  if (!vehicleSnap.exists()) throw new Error("Vehículo no encontrado.");
  const vehicle = vehicleSnap.data();

  const expectedTotal = Math.round(data.quantity * data.pricePerUnit * 100) / 100;
  const totalDiff = Math.abs(expectedTotal - data.total);
  if (totalDiff > 0.05 && !(isAdmin && data.allowTotalMismatch)) {
    throw new Error(`El total debe ser cantidad × precio = ${expectedTotal.toFixed(2)}. Un administrador puede autorizar un ajuste.`);
  }

  const hasInvoice = files.invoicePhoto instanceof File && files.invoicePhoto.size > 0;
  const hasPump = files.pumpPhoto instanceof File && files.pumpPhoto.size > 0;
  const skipPhotos = isAdmin && data.skipPhotoRequirement;
  if (!skipPhotos && (!hasInvoice || !hasPump)) {
    throw new Error("Debes adjuntar la foto de la factura y la foto de la bomba. Un administrador puede autorizar una excepción.");
  }

  const fuelLogRef = doc(collection(db, "fuelLogs"));
  let invoicePhoto = null;
  let pumpPhoto = null;
  if (hasInvoice) invoicePhoto = await uploadPhoto(fuelLogRef.id, "invoice", files.invoicePhoto);
  if (hasPump) pumpPhoto = await uploadPhoto(fuelLogRef.id, "pump", files.pumpPhoto);

  await setDoc(fuelLogRef, {
    date: toTimestamp(data.date),
    vehicleId: data.vehicleId,
    routeId: data.routeId || null,
    mileage: data.mileage,
    fuelType: data.fuelType,
    quantity: data.quantity,
    pricePerUnit: data.pricePerUnit,
    total: data.total,
    invoiceNumber: data.invoiceNumber || null,
    station: data.station || null,
    observations: data.observations || null,
    userId: user.uid,
    invoicePhotoPath: invoicePhoto?.path || null,
    invoicePhotoUrl: invoicePhoto?.url || null,
    pumpPhotoPath: pumpPhoto?.path || null,
    pumpPhotoUrl: pumpPhoto?.url || null,
    photoExceptionReason: skipPhotos ? data.photoExceptionReason || "Autorizado por administrador" : null,
    photoExceptionById: skipPhotos ? user.uid : null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  if (data.mileage > vehicle.currentMileage) {
    await updateDoc(vehicleRef, { currentMileage: data.mileage, updatedAt: serverTimestamp() });
  }

  await logAudit("FuelLog", fuelLogRef.id, "CREATE", user.uid, { ...data, invoicePhoto: !!invoicePhoto, pumpPhoto: !!pumpPhoto });
  return fuelLogRef.id;
}

export async function deleteFuelLog(id, user) {
  const snap = await getDoc(doc(db, "fuelLogs", id));
  const data = snap.data();
  await deleteDoc(doc(db, "fuelLogs", id));
  if (data?.invoicePhotoPath) {
    try {
      await deleteObject(storageRef(storage, data.invoicePhotoPath));
    } catch {
      /* ignore */
    }
  }
  if (data?.pumpPhotoPath) {
    try {
      await deleteObject(storageRef(storage, data.pumpPhotoPath));
    } catch {
      /* ignore */
    }
  }
  await logAudit("FuelLog", id, "DELETE", user.uid, null);
}

/* ---------------- Maintenance ---------------- */

export async function getMaintenances({ vehicleId } = {}, take = 60) {
  const snap = vehicleId
    ? await getDocs(query(collection(db, "maintenances"), where("vehicleId", "==", vehicleId), orderBy("date", "desc"), fsLimit(take)))
    : await getDocs(query(collection(db, "maintenances"), orderBy("date", "desc"), fsLimit(take)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function createMaintenance(data, user) {
  const vehicleRef = doc(db, "vehicles", data.vehicleId);
  const vehicleSnap = await getDoc(vehicleRef);
  if (!vehicleSnap.exists()) throw new Error("Vehículo no encontrado.");
  const vehicle = vehicleSnap.data();

  const batch = writeBatch(db);
  const maintRef = doc(collection(db, "maintenances"));
  batch.set(maintRef, {
    vehicleId: data.vehicleId,
    date: toTimestamp(data.date),
    mileage: data.mileage,
    description: data.description,
    cost: data.cost ?? null,
    performedBy: data.performedBy || null,
    createdById: user.uid,
    createdAt: serverTimestamp(),
  });
  batch.update(vehicleRef, {
    lastServiceDate: toTimestamp(data.date),
    lastServiceMileage: data.mileage,
    currentMileage: Math.max(vehicle.currentMileage, data.mileage),
    updatedAt: serverTimestamp(),
  });
  await batch.commit();
  await logAudit("Maintenance", maintRef.id, "CREATE", user.uid, data);
  return maintRef.id;
}

export async function deleteMaintenance(id, user) {
  await deleteDoc(doc(db, "maintenances", id));
  await logAudit("Maintenance", id, "DELETE", user.uid, null);
}

/* ---------------- Users ---------------- */

export async function getUsers() {
  const snap = await getDocs(query(collection(db, "users"), orderBy("name")));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getUser(id) {
  const snap = await getDoc(doc(db, "users", id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function createUser(data, admin) {
  const existing = await getDocs(query(collection(db, "users"), where("email", "==", data.email)));
  if (!existing.empty) throw new Error("Ya existe un usuario con este correo.");
  if (!data.password || data.password.length < 6) throw new Error("La contraseña es obligatoria (mínimo 6 caracteres).");

  const uid = await adminCreateAuthUser(data.email, data.password);
  const permissions = computeFlatPermissions(data.role, {});
  await setDoc(doc(db, "users", uid), {
    name: data.name,
    email: data.email,
    role: data.role,
    active: data.active ?? true,
    permissions,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await logAudit("User", uid, "CREATE", admin.uid, { name: data.name, email: data.email, role: data.role });
  return uid;
}

export async function updateUser(id, data, admin) {
  const existing = await getDocs(query(collection(db, "users"), where("email", "==", data.email)));
  if (existing.docs.some((d) => d.id !== id)) throw new Error("Ya existe otro usuario con este correo.");
  if (id === admin.uid && data.active === false) throw new Error("No puedes desactivar tu propio usuario.");
  if (id === admin.uid && data.role !== "ADMIN") throw new Error("No puedes quitarte a ti mismo el rol de administrador.");

  const current = await getDoc(doc(db, "users", id));
  const currentData = current.data() || {};
  const roleChanged = currentData.role !== data.role;
  // Changing the role resets to that role's defaults (prior per-user overrides
  // no longer make sense against a different base). Otherwise keep the
  // existing flat permissions map as-is (edited separately via the matrix form).
  const permissions = roleChanged ? computeFlatPermissions(data.role, {}) : currentData.permissions || computeFlatPermissions(data.role, {});

  await updateDoc(doc(db, "users", id), {
    name: data.name,
    email: data.email,
    role: data.role,
    active: data.active ?? true,
    permissions,
    updatedAt: serverTimestamp(),
  });
  await logAudit("User", id, "UPDATE", admin.uid, { name: data.name, email: data.email, role: data.role });
}

export async function updateUserPermissions(id, flatPermissions, admin) {
  await updateDoc(doc(db, "users", id), { permissions: flatPermissions, updatedAt: serverTimestamp() });
  await logAudit("User", id, "UPDATE", admin.uid, { permissionsUpdated: true });
}


/* ---------------- Audit ---------------- */

export async function getAuditLogs(take = 150) {
  const snap = await getDocs(query(collection(db, "auditLogs"), orderBy("createdAt", "desc"), fsLimit(take)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
