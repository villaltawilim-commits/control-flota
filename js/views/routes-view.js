import { state } from "../lib/store.js";
import { can } from "../lib/permissions.js";
import * as data from "../lib/data.js";
import { formatCurrency, formatDate, formatDateTime, formatDistance, todayInput, nowTimeInput } from "../lib/format.js";
import { pageHeaderHtml, emptyStateHtml, toast, confirmAction, openModal, closeModal } from "../lib/ui.js";
import { icon } from "../lib/icons.js";
import { navigate, currentQuery } from "../lib/router.js";
import { destinationSelectHtml, wireDestinationSelect, resolveDestinationValue } from "../lib/destinations.js";

const STATUS_BADGE = {
  OPEN: { cls: "warning", label: "En curso" },
  CLOSED: { cls: "normal", label: "Cerrada" },
};

export async function renderRouteList(container) {
  container.innerHTML = `<div class="center-page"><div class="spinner"></div></div>`;
  const { vehicleId } = currentQuery();
  const routes = await data.getRoutes({ vehicleId });
  const canCreate = can(state.profile, "routes", "create");

  const vehiclesById = {};
  if (routes.length) {
    const vehicles = await data.getVehicles();
    vehicles.forEach((v) => (vehiclesById[v.id] = v));
  }
  const users = await data.getUsers();
  const usersById = Object.fromEntries(users.map((u) => [u.id, u]));

  container.innerHTML = `
    <div class="page">
      ${pageHeaderHtml({
        title: "Rutas",
        subtitle: `${routes.length} registradas`,
        actionHtml: canCreate ? `<a href="#/routes/new" class="fab">${icon("plus", 20)}</a>` : "",
      })}
      <div class="content">
        ${
          routes.length === 0
            ? emptyStateHtml({ icon: "🗺️", title: "Sin rutas registradas", actionHref: canCreate ? "/routes/new" : "", actionLabel: canCreate ? "Registrar ruta" : "" })
            : routes
                .map((r) => {
                  const v = vehiclesById[r.vehicleId] || {};
                  const driver = usersById[r.driverId] || {};
                  const badge = STATUS_BADGE[r.status] || STATUS_BADGE.CLOSED;
                  return `
                  <a href="#/routes/${r.id}" class="item-card">
                    <div class="item-row">
                      <div style="min-width:0;">
                        <p class="title">${r.destination}</p>
                        <p class="sub">${v.brand || ""} ${v.model || ""} · ${v.plate || ""}</p>
                      </div>
                      <span class="badge ${badge.cls}">${badge.label}</span>
                    </div>
                    <div style="display:flex;align-items:center;justify-content:space-between;margin-top:8px;font-size:14px;">
                      <span style="color:var(--muted);">${formatDate(r.date)} · ${driver.name || ""}</span>
                      <span style="font-weight:500;">${r.distanceKm != null ? formatDistance(r.distanceKm) : "—"}</span>
                    </div>
                  </a>`;
                })
                .join("")
        }
      </div>
    </div>
  `;
}

export async function renderRouteNew(container) {
  const vehicles = (await data.getVehicles()).filter((v) => v.active);

  if (vehicles.length === 0) {
    container.innerHTML = `<div class="page">${pageHeaderHtml({ title: "Nueva ruta", backHref: "/routes" })}<div class="content">${emptyStateHtml({ title: "No hay vehículos activos", desc: "Registra un vehículo antes de iniciar una ruta." })}</div></div>`;
    return;
  }

  container.innerHTML = `
    <div class="page">
      ${pageHeaderHtml({ title: "Nueva ruta", backHref: "/routes" })}
      <form class="form" id="route-form">
        <div id="form-error"></div>
        <div class="field"><label>Fecha</label><input name="date" type="date" value="${todayInput()}" required></div>
        <div class="field">
          <label>Vehículo</label>
          <select name="vehicleId" id="vehicle-select" required>
            ${vehicles.map((v) => `<option value="${v.id}" data-mileage="${v.currentMileage}">${v.brand} ${v.model} · ${v.plate}</option>`).join("")}
          </select>
        </div>
        <div class="field">
          <label>Ruta / Destino</label>
          ${destinationSelectHtml({ name: "destination" })}
        </div>
        <div class="field"><label>Millaje de salida (mi)</label><input name="departureMileage" id="departure-mileage" type="number" value="${vehicles[0].currentMileage}" required></div>
        <p id="mileage-hint" class="field" style="margin-top:-8px;font-size:12px;color:var(--muted);">Último registrado: ${vehicles[0].currentMileage.toLocaleString("es-GT")} mi · La hora de salida se registra automáticamente.</p>
        <div class="field"><label>Observaciones</label><textarea name="observations" placeholder="Opcional"></textarea></div>
        <button type="submit" class="btn btn-primary btn-full">Iniciar ruta</button>
      </form>
    </div>
  `;

  wireDestinationSelect(container, "destination");

  const vehicleSelect = document.getElementById("vehicle-select");
  vehicleSelect.addEventListener("change", () => {
    const opt = vehicleSelect.selectedOptions[0];
    document.getElementById("departure-mileage").value = opt.dataset.mileage;
    document.getElementById("mileage-hint").textContent = `Último registrado: ${Number(opt.dataset.mileage).toLocaleString("es-GT")} mi · La hora de salida se registra automáticamente.`;
  });

  const form = document.getElementById("route-form");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const errorBox = document.getElementById("form-error");
    errorBox.innerHTML = "";
    const fd = new FormData(form);
    const destination = resolveDestinationValue(fd, "destination");
    if (!destination) {
      errorBox.innerHTML = `<p class="banner-error">Selecciona o escribe un destino.</p>`;
      return;
    }
    const payload = {
      date: fd.get("date"),
      vehicleId: fd.get("vehicleId"),
      destination,
      departureTime: nowTimeInput(),
      departureMileage: Number(fd.get("departureMileage")),
      observations: fd.get("observations").trim(),
    };
    const btn = form.querySelector("button[type=submit]");
    btn.disabled = true;
    btn.textContent = "Iniciando ruta...";
    try {
      const id = await data.createRoute(payload, state.user);
      toast("Has iniciado tu ruta, en el nombre de Dios. Que todo te salga bien.", "success");
      navigate(`/routes/${id}`);
    } catch (err) {
      errorBox.innerHTML = `<p class="banner-error">${err.message}</p>`;
      btn.disabled = false;
      btn.textContent = "Iniciar ruta";
    }
  });
}

export async function renderRouteDetail(container, params) {
  container.innerHTML = `<div class="center-page"><div class="spinner"></div></div>`;
  const route = await data.getRoute(params.id);
  if (!route) {
    container.innerHTML = emptyStateHtml({ title: "Ruta no encontrada" });
    return;
  }
  const [vehicle, driver, fuelLogs] = await Promise.all([
    data.getVehicle(route.vehicleId),
    data.getUser(route.driverId),
    data.getFuelLogsByRoute(route.id),
  ]);

  const canCreateRoutes = can(state.profile, "routes", "create");
  const canUpdate = can(state.profile, "routes", "update");
  const canDelete = can(state.profile, "routes", "delete");
  const canRegisterFuel = can(state.profile, "fuel", "create");
  const badge = STATUS_BADGE[route.status] || STATUS_BADGE.CLOSED;

  const costTotal = fuelLogs.reduce((s, f) => s + f.total, 0);
  const costPerKm = route.distanceKm && route.distanceKm > 0 ? costTotal / route.distanceKm : null;

  // Solo quien abrió la ruta puede cerrarla desde aquí. Un editor/admin con
  // permiso de "update" siempre puede corregirla desde la página de editar.
  const isDriver = route.driverId === state.user.uid;
  const showCloseForm = route.status === "OPEN" && canRegisterFuel && isDriver;
  const showOtherDriverNotice = route.status === "OPEN" && !isDriver;

  container.innerHTML = `
    <div class="page">
      ${pageHeaderHtml({
        title: route.destination,
        subtitle: vehicle ? `${vehicle.brand} ${vehicle.model} · ${vehicle.plate}` : "",
        backHref: "/routes",
        actionHtml: showCloseForm
          ? `<button type="button" id="open-close-modal" class="back-btn" style="width:auto;padding:0 14px;border-radius:999px;white-space:nowrap;font-size:13px;font-weight:600;color:var(--primary-700);border-color:var(--primary-500);">Cierre de ruta</button>`
          : canUpdate
            ? `<a href="#/routes/${route.id}/edit" class="back-btn">${icon("edit", 16)}</a>`
            : "",
      })}
      <div class="content">
        ${
          showOtherDriverNotice
            ? `<div class="card" style="background:var(--warning-bg, #fff7e6);color:var(--muted);">
                <p style="margin:0;font-size:14px;">Esta ruta sigue abierta. Solo <strong>${driver?.name || "el usuario que la inició"}</strong> puede cerrarla.${canUpdate ? " Si es necesario, puedes corregirla desde Editar." : ""}</p>
              </div>`
            : ""
        }

        <div class="card" style="display:flex;align-items:center;justify-content:space-between;">
          <div><p class="info-label">Estado</p><p class="info-value">${badge.label}</p></div>
          <div style="text-align:right;"><p class="info-label">Distancia</p><p class="info-value">${route.distanceKm != null ? formatDistance(route.distanceKm) : "—"}</p></div>
        </div>

        <div class="card">
          <div class="info-grid">
            <div><p class="info-label">Fecha</p><p class="info-value">${formatDate(route.date)}</p></div>
            <div><p class="info-label">Conductor</p><p class="info-value">${driver?.name || "—"}</p></div>
            <div><p class="info-label">Salida</p><p class="info-value">${formatDistance(route.departureMileage)}</p></div>
            <div><p class="info-label">Entrada</p><p class="info-value">${route.arrivalMileage != null ? formatDistance(route.arrivalMileage) : "Pendiente"}</p></div>
          </div>
          ${route.observations ? `<div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--border);"><p class="info-label">Observaciones</p><p style="font-size:14px;">${route.observations}</p></div>` : ""}
        </div>

        ${
          route.status === "CLOSED" && fuelLogs.length > 0
            ? `<div class="card">
                <p style="font-weight:600;margin:0 0 8px;">Costo de combustible en esta ruta</p>
                <div class="info-grid">
                  <div><p class="info-label">Combustible</p><p class="info-value">${formatCurrency(costTotal)}</p></div>
                  <div><p class="info-label">Costo por milla</p><p class="info-value">${costPerKm != null ? formatCurrency(costPerKm) : "—"}</p></div>
                </div>
              </div>`
            : ""
        }

        ${canRegisterFuel ? `<a href="#/fuel/new?routeId=${route.id}&vehicleId=${route.vehicleId}" class="btn" style="background:var(--primary-50);color:var(--primary-700);border:1px solid var(--primary-500);">⛽ Registrar combustible de esta ruta</a>` : ""}

        ${canDelete ? `<button id="delete-route" class="btn btn-danger-outline btn-full">${icon("trash", 16)} Eliminar ruta</button>` : ""}
      </div>
    </div>
  `;

  document.getElementById("open-close-modal")?.addEventListener("click", () => {
    const overlay = openModal(closeRouteModalHtml(route, vehicle));
    const closeForm = overlay.querySelector("#close-route-form");
    overlay.querySelector("#modal-close-x")?.addEventListener("click", () => closeModal());
    closeForm.querySelector('input[name="arrivalMileage"]').focus();
    closeForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const errorBox = overlay.querySelector("#close-form-error");
      errorBox.innerHTML = "";
      const fd = new FormData(closeForm);
      const arrivalMileageRaw = fd.get("arrivalMileage");
      if (arrivalMileageRaw === null || arrivalMileageRaw.trim() === "") {
        errorBox.innerHTML = `<p class="banner-error">Ingresa el millaje/kms actual del vehículo.</p>`;
        return;
      }
      const payload = {
        arrivalTime: nowTimeInput(),
        arrivalMileage: Number(arrivalMileageRaw),
        observations: fd.get("observations").trim(),
      };
      const btn = closeForm.querySelector("button[type=submit]");
      btn.disabled = true;
      btn.textContent = "Guardando...";
      try {
        await data.closeRoute(route.id, payload, state.user);
        closeModal();
        toast("Ruta cerrada correctamente.", "success");
        renderRouteDetail(container, params);
      } catch (err) {
        errorBox.innerHTML = `<p class="banner-error">${err.message}</p>`;
        btn.disabled = false;
        btn.textContent = "Guardar";
      }
    });
  });

  document.getElementById("delete-route")?.addEventListener("click", async () => {
    if (!confirmAction("¿Eliminar esta ruta? Esta acción no se puede deshacer.")) return;
    try {
      await data.deleteRoute(route.id, state.user);
      navigate("/routes");
    } catch (err) {
      toast(err.message);
    }
  });
}

function closeRouteModalHtml(route, vehicle) {
  return `
    <div class="modal-header">
      <p style="font-weight:700;font-size:16px;margin:0;">Cierre de ruta</p>
      <button type="button" id="modal-close-x" class="modal-close-btn" aria-label="Cerrar">${icon("close", 16)}</button>
    </div>
    <p style="margin:0 0 16px;font-size:14px;color:var(--muted);">
      Ingresa el millaje/kms actual del vehículo <strong>${vehicle ? vehicle.plate : ""}</strong>.
    </p>
    <form id="close-route-form" style="display:flex;flex-direction:column;gap:16px;">
      <div id="close-form-error"></div>
      <div class="field"><label>Millaje / Kms actual (mi)</label><input name="arrivalMileage" type="number" placeholder="Ej: ${route.departureMileage}" required></div>
      <p style="margin-top:-8px;font-size:12px;color:var(--muted);">Salida: ${route.departureMileage.toLocaleString("es-GT")} mi · La hora de entrada se registra automáticamente.</p>
      <div class="field"><label>Observaciones</label><textarea name="observations" placeholder="Opcional"></textarea></div>
      <button type="submit" class="btn btn-primary btn-full">Guardar</button>
    </form>
  `;
}

export async function renderRouteEdit(container, params) {
  const route = await data.getRoute(params.id);
  if (!route) {
    container.innerHTML = emptyStateHtml({ title: "Ruta no encontrada" });
    return;
  }
  const vehicles = await data.getVehicles();
  const dateStr = route.date.toDate().toISOString().slice(0, 10);
  const timeOf = (ts) => (ts ? ts.toDate().toISOString().slice(11, 16) : "");

  container.innerHTML = `
    <div class="page">
      ${pageHeaderHtml({ title: "Editar ruta", backHref: `/routes/${route.id}` })}
      <form class="form" id="route-edit-form">
        <div id="form-error"></div>
        <div class="field"><label>Fecha</label><input name="date" type="date" value="${dateStr}" required></div>
        <div class="field">
          <label>Vehículo</label>
          <select name="vehicleId" required>
            ${vehicles.map((v) => `<option value="${v.id}" ${v.id === route.vehicleId ? "selected" : ""}>${v.brand} ${v.model} · ${v.plate}</option>`).join("")}
          </select>
        </div>
        <div class="field">
          <label>Ruta / Destino</label>
          ${destinationSelectHtml({ name: "destination", selectedValue: route.destination })}
        </div>
        <div class="form-grid-2">
          <div class="field"><label>Hora de salida</label><p class="info-value" style="margin:0;padding:12px 0;">${timeOf(route.departureTime) || "—"}</p></div>
          <div class="field"><label>Mi de salida</label><input name="departureMileage" type="number" value="${route.departureMileage}" required></div>
        </div>
        <div class="form-grid-2">
          <div class="field"><label>Hora de entrada</label><p class="info-value" style="margin:0;padding:12px 0;">${timeOf(route.arrivalTime) || "Pendiente"}</p></div>
          <div class="field"><label>Mi de entrada</label><input name="arrivalMileage" type="number" value="${route.arrivalMileage ?? ""}"></div>
        </div>
        <p style="margin-top:-8px;font-size:12px;color:var(--muted);">Las horas se registran automáticamente y no se pueden modificar.</p>
        <div class="field"><label>Observaciones</label><textarea name="observations">${route.observations || ""}</textarea></div>
        <button type="submit" class="btn btn-primary btn-full">Guardar cambios</button>
      </form>
    </div>
  `;

  wireDestinationSelect(container, "destination");

  const form = document.getElementById("route-edit-form");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const errorBox = document.getElementById("form-error");
    errorBox.innerHTML = "";
    const fd = new FormData(form);
    const destination = resolveDestinationValue(fd, "destination");
    if (!destination) {
      errorBox.innerHTML = `<p class="banner-error">Selecciona o escribe un destino.</p>`;
      return;
    }
    const newArrivalMileage = fd.get("arrivalMileage") ? Number(fd.get("arrivalMileage")) : null;
    let arrivalTime = "";
    if (newArrivalMileage != null) {
      // Si ya tenía hora de entrada, se conserva; si se está cerrando recién
      // desde aquí, se registra la hora actual (nunca es editable a mano).
      arrivalTime = route.arrivalMileage != null ? timeOf(route.arrivalTime) : nowTimeInput();
    }
    const payload = {
      date: fd.get("date"),
      vehicleId: fd.get("vehicleId"),
      destination,
      departureTime: timeOf(route.departureTime),
      departureMileage: Number(fd.get("departureMileage")),
      arrivalTime,
      arrivalMileage: newArrivalMileage,
      observations: fd.get("observations").trim(),
    };
    const btn = form.querySelector("button[type=submit]");
    btn.disabled = true;
    btn.textContent = "Guardando...";
    try {
      await data.updateRoute(route.id, payload, state.user);
      navigate(`/routes/${route.id}`);
    } catch (err) {
      errorBox.innerHTML = `<p class="banner-error">${err.message}</p>`;
      btn.disabled = false;
      btn.textContent = "Guardar cambios";
    }
  });
}
