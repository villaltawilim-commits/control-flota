import { state } from "../lib/store.js";
import { can } from "../lib/permissions.js";
import * as data from "../lib/data.js";
import { formatCurrency, formatDate, formatDateTime, formatDistance, todayInput, nowTimeInput } from "../lib/format.js";
import { pageHeaderHtml, emptyStateHtml, toast, confirmAction } from "../lib/ui.js";
import { icon } from "../lib/icons.js";
import { navigate, currentQuery } from "../lib/router.js";
import { destinationSelectHtml, wireDestinationSelect, resolveDestinationValue } from "../lib/destinations.js";

const STATUS_BADGE = {
  OPEN: { cls: "warning", label: "En curso" },
  EXPIRED: { cls: "urgent", label: "Vencida" },
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
        <div class="form-grid-2">
          <div class="field"><label>Hora de salida</label><input name="departureTime" type="time" value="${nowTimeInput()}"></div>
          <div class="field"><label>Millaje de salida (mi)</label><input name="departureMileage" id="departure-mileage" type="number" value="${vehicles[0].currentMileage}" required></div>
        </div>
        <p id="mileage-hint" class="field" style="margin-top:-8px;font-size:12px;color:var(--muted);">Último registrado: ${vehicles[0].currentMileage.toLocaleString("es-GT")} mi</p>
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
    document.getElementById("mileage-hint").textContent = `Último registrado: ${Number(opt.dataset.mileage).toLocaleString("es-GT")} mi`;
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
      departureTime: fd.get("departureTime"),
      departureMileage: Number(fd.get("departureMileage")),
      observations: fd.get("observations").trim(),
    };
    const btn = form.querySelector("button[type=submit]");
    btn.disabled = true;
    btn.textContent = "Iniciando ruta...";
    try {
      const id = await data.createRoute(payload, state.user);
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

  // Closing an OPEN route the same day only needs "create" (it's finishing
  // what you started). Completing an EXPIRED one is editing historical data,
  // so it requires the stronger "update" permission.
  const showCloseForm = route.status === "OPEN" && canRegisterFuel;
  const showFixExpiredForm = route.status === "EXPIRED" && canUpdate;

  container.innerHTML = `
    <div class="page">
      ${pageHeaderHtml({
        title: route.destination,
        subtitle: vehicle ? `${vehicle.brand} ${vehicle.model} · ${vehicle.plate}` : "",
        backHref: "/routes",
        actionHtml: canUpdate ? `<a href="#/routes/${route.id}/edit" class="back-btn">${icon("edit", 16)}</a>` : "",
      })}
      <div class="content">
        ${
          route.status === "EXPIRED"
            ? `<div class="card" style="background:var(--danger-bg);border-color:rgba(217,45,32,0.2);color:var(--danger);">
                <p style="font-weight:700;">🚨 Ruta vencida</p>
                <p style="margin-top:4px;font-size:14px;">Esta ruta quedó abierta y se cerró automáticamente sin kilometraje de entrada.${showFixExpiredForm ? " Complétala abajo." : " Necesitas permiso de modificar rutas para completarla."}</p>
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

        ${showCloseForm || showFixExpiredForm ? closeRouteFormHtml(route, route.status === "EXPIRED") : ""}

        ${canDelete ? `<button id="delete-route" class="btn btn-danger-outline btn-full">${icon("trash", 16)} Eliminar ruta</button>` : ""}
      </div>
    </div>
  `;

  if (showCloseForm || showFixExpiredForm) {
    const closeForm = document.getElementById("close-route-form");
    closeForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const errorBox = document.getElementById("close-form-error");
      errorBox.innerHTML = "";
      const fd = new FormData(closeForm);
      const payload = {
        arrivalTime: fd.get("arrivalTime"),
        arrivalMileage: Number(fd.get("arrivalMileage")),
        observations: fd.get("observations").trim(),
      };
      const btn = closeForm.querySelector("button[type=submit]");
      btn.disabled = true;
      btn.textContent = "Guardando...";
      try {
        await data.closeRoute(route.id, payload, state.user);
        renderRouteDetail(container, params);
      } catch (err) {
        errorBox.innerHTML = `<p class="banner-error">${err.message}</p>`;
        btn.disabled = false;
        btn.textContent = route.status === "EXPIRED" ? "Completar ruta" : "Cerrar ruta";
      }
    });
  }

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

function closeRouteFormHtml(route, isExpired) {
  return `
    <form id="close-route-form" class="card" style="display:flex;flex-direction:column;gap:16px;">
      <p style="font-weight:600;">${isExpired ? "Completar ruta vencida" : "Cerrar ruta"}</p>
      <div id="close-form-error"></div>
      <div class="form-grid-2">
        <div class="field"><label>Hora de entrada</label><input name="arrivalTime" type="time" value="${isExpired ? "" : nowTimeInput()}"></div>
        <div class="field"><label>Millaje de entrada (mi)</label><input name="arrivalMileage" type="number" value="${route.departureMileage}" required></div>
      </div>
      <p style="margin-top:-8px;font-size:12px;color:var(--muted);">Salida: ${route.departureMileage.toLocaleString("es-GT")} mi</p>
      <div class="field"><label>Observaciones</label><textarea name="observations" placeholder="Opcional"></textarea></div>
      <button type="submit" class="btn btn-primary btn-full">${isExpired ? "Completar ruta" : "Cerrar ruta"}</button>
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
          <div class="field"><label>Hora de salida</label><input name="departureTime" type="time" value="${timeOf(route.departureTime)}"></div>
          <div class="field"><label>Mi de salida</label><input name="departureMileage" type="number" value="${route.departureMileage}" required></div>
        </div>
        <div class="form-grid-2">
          <div class="field"><label>Hora de entrada</label><input name="arrivalTime" type="time" value="${timeOf(route.arrivalTime)}"></div>
          <div class="field"><label>Mi de entrada</label><input name="arrivalMileage" type="number" value="${route.arrivalMileage ?? ""}"></div>
        </div>
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
    const payload = {
      date: fd.get("date"),
      vehicleId: fd.get("vehicleId"),
      destination,
      departureTime: fd.get("departureTime"),
      departureMileage: Number(fd.get("departureMileage")),
      arrivalTime: fd.get("arrivalTime"),
      arrivalMileage: fd.get("arrivalMileage") ? Number(fd.get("arrivalMileage")) : null,
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
