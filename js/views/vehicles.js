import { state } from "../lib/store.js";
import { can } from "../lib/permissions.js";
import * as data from "../lib/data.js";
import { computeServiceStatus, ALERT_LEVEL_LABEL, ALERT_LEVEL_ICON } from "../lib/vehicle-status.js";
import { formatCurrency, formatDate, formatDateInput, formatDistance } from "../lib/format.js";
import { pageHeaderHtml, emptyStateHtml, toast, confirmAction } from "../lib/ui.js";
import { icon } from "../lib/icons.js";
import { navigate } from "../lib/router.js";

export async function renderVehicleList(container) {
  container.innerHTML = `<div class="center-page"><div class="spinner"></div></div>`;
  const vehicles = await data.getVehicles();
  const canCreate = can(state.profile, "vehicles", "create");

  container.innerHTML = `
    <div class="page">
      ${pageHeaderHtml({
        title: "Vehículos",
        subtitle: `${vehicles.length} en catálogo`,
        actionHtml: canCreate ? `<a href="#/vehicles/new" class="fab">${icon("plus", 20)}</a>` : "",
      })}
      <div class="content">
        ${
          vehicles.length === 0
            ? emptyStateHtml({
                icon: "🚚",
                title: "Sin vehículos registrados",
                desc: "Agrega el primer vehículo de la flota",
                actionHref: canCreate ? "/vehicles/new" : "",
                actionLabel: canCreate ? "Agregar vehículo" : "",
              })
            : vehicles
                .map((v) => {
                  const status = computeServiceStatus(v.currentMileage, v.lastServiceMileage, v.serviceIntervalKm);
                  return `
                  <a href="#/vehicles/${v.id}" class="item-card ${v.active ? "" : "inactive"}">
                    <div class="item-row">
                      <div style="min-width:0;">
                        <p class="title">${v.brand} ${v.model} ${v.nickname ? `· ${v.nickname}` : ""}</p>
                        <p class="sub">${v.plate} · ${v.year} · ${v.color}</p>
                      </div>
                      ${!v.active ? `<span class="badge neutral" style="flex-shrink:0;">Inactivo</span>` : ""}
                    </div>
                    <div style="display:flex;align-items:center;justify-content:space-between;margin-top:12px;">
                      <span style="font-size:14px;color:var(--muted);">${formatDistance(v.currentMileage)}</span>
                      <span class="badge ${status.alertLevel}">${ALERT_LEVEL_ICON[status.alertLevel]} ${ALERT_LEVEL_LABEL[status.alertLevel]}</span>
                    </div>
                    ${
                      status.alertLevel !== "normal"
                        ? `<p style="margin:6px 0 0;font-size:12px;font-weight:600;color:${status.alertLevel === "urgent" ? "var(--danger)" : "var(--warning)"};">
                            ${status.remainingKm <= 0 ? `Excedido ${formatDistance(Math.abs(status.remainingKm))}` : `Faltan ${formatDistance(status.remainingKm)}`}
                          </p>`
                        : ""
                    }
                  </a>`;
                })
                .join("")
        }
      </div>
    </div>
  `;
}

function vehicleFormFields(v = {}) {
  return `
    <div class="form-grid-2">
      <div class="field"><label>Marca</label><input name="brand" value="${v.brand || ""}" required></div>
      <div class="field"><label>Modelo</label><input name="model" value="${v.model || ""}" required></div>
    </div>
    <div class="form-grid-2">
      <div class="field"><label>Año</label><input name="year" type="number" value="${v.year || ""}" required></div>
      <div class="field"><label>Color</label><input name="color" value="${v.color || ""}" required></div>
    </div>
    <div class="form-grid-2">
      <div class="field"><label>Placa</label><input name="plate" value="${v.plate || ""}" style="text-transform:uppercase;" required></div>
      <div class="field"><label>Apodo / nombre interno</label><input name="nickname" value="${v.nickname || ""}" placeholder="Opcional"></div>
    </div>
    <div class="field">
      <label>Millaje actual (mi)</label>
      <input name="currentMileage" type="number" value="${v.currentMileage ?? ""}" required>
    </div>
    <div class="card">
      <p style="font-weight:600;margin:0 0 12px;">Mantenimiento</p>
      <div style="display:flex;flex-direction:column;gap:12px;">
        <div class="field"><label>Fecha del último servicio</label><input name="lastServiceDate" type="date" value="${v.lastServiceDate ? formatDateInput(v.lastServiceDate) : ""}"></div>
        <div class="field"><label>Millaje del último servicio (mi)</label><input name="lastServiceMileage" type="number" value="${v.lastServiceMileage ?? ""}" required></div>
        <div class="field"><label>Intervalo de servicio (mi)</label><input name="serviceIntervalKm" type="number" value="${v.serviceIntervalKm ?? 3200}" required></div>
      </div>
    </div>
    <label class="checkbox-row"><input type="checkbox" name="active" ${v.active !== false ? "checked" : ""}> Vehículo activo</label>
  `;
}

export async function renderVehicleForm(container, params) {
  const isEdit = !!params?.id;
  let vehicle = {};
  if (isEdit) {
    vehicle = await data.getVehicle(params.id);
    if (!vehicle) {
      container.innerHTML = emptyStateHtml({ title: "Vehículo no encontrado" });
      return;
    }
  }

  container.innerHTML = `
    <div class="page">
      ${pageHeaderHtml({ title: isEdit ? "Editar vehículo" : "Nuevo vehículo", backHref: isEdit ? `/vehicles/${params.id}` : "/vehicles" })}
      <form class="form" id="vehicle-form">
        <div id="form-error"></div>
        ${vehicleFormFields(vehicle)}
        <button type="submit" class="btn btn-primary btn-full">Guardar vehículo</button>
      </form>
    </div>
  `;

  const form = document.getElementById("vehicle-form");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const errorBox = document.getElementById("form-error");
    errorBox.innerHTML = "";
    const fd = new FormData(form);
    const payload = {
      brand: fd.get("brand").trim(),
      model: fd.get("model").trim(),
      year: Number(fd.get("year")),
      color: fd.get("color").trim(),
      plate: fd.get("plate").trim().toUpperCase(),
      nickname: fd.get("nickname").trim() || null,
      currentMileage: Number(fd.get("currentMileage")),
      lastServiceDate: fd.get("lastServiceDate") || "",
      lastServiceMileage: Number(fd.get("lastServiceMileage")),
      serviceIntervalKm: Number(fd.get("serviceIntervalKm")),
      active: fd.get("active") === "on",
    };
    if (payload.currentMileage < payload.lastServiceMileage) {
      errorBox.innerHTML = `<p class="banner-error">El millaje actual no puede ser menor al del último servicio.</p>`;
      return;
    }
    const btn = form.querySelector("button[type=submit]");
    btn.disabled = true;
    btn.textContent = "Guardando...";
    try {
      let id = params?.id;
      if (isEdit) {
        await data.updateVehicle(id, payload, state.user);
      } else {
        id = await data.createVehicle(payload, state.user);
      }
      navigate(`/vehicles/${id}`);
    } catch (err) {
      errorBox.innerHTML = `<p class="banner-error">${err.message}</p>`;
      btn.disabled = false;
      btn.textContent = "Guardar vehículo";
    }
  });
}

export async function renderVehicleDetail(container, params) {
  container.innerHTML = `<div class="center-page"><div class="spinner"></div></div>`;
  const [vehicle, routes, fuelLogs, maintenances] = await Promise.all([
    data.getVehicle(params.id),
    data.getRoutesByVehicle(params.id),
    data.getFuelLogsByVehicle(params.id),
    data.getMaintenances({ vehicleId: params.id }, 15),
  ]);
  if (!vehicle) {
    container.innerHTML = emptyStateHtml({ title: "Vehículo no encontrado" });
    return;
  }

  const canEdit = can(state.profile, "vehicles", "update");
  const canDelete = can(state.profile, "vehicles", "delete");
  const status = computeServiceStatus(vehicle.currentMileage, vehicle.lastServiceMileage, vehicle.serviceIntervalKm);

  container.innerHTML = `
    <div class="page">
      ${pageHeaderHtml({
        title: `${vehicle.brand} ${vehicle.model}`,
        subtitle: vehicle.plate,
        backHref: "/vehicles",
        actionHtml: canEdit ? `<a href="#/vehicles/${vehicle.id}/edit" class="back-btn">${icon("edit", 16)}</a>` : "",
      })}
      <div class="content">
        <div class="card">
          <div class="info-grid">
            <div><p class="info-label">Marca</p><p class="info-value">${vehicle.brand}</p></div>
            <div><p class="info-label">Modelo</p><p class="info-value">${vehicle.model}</p></div>
            <div><p class="info-label">Año</p><p class="info-value">${vehicle.year}</p></div>
            <div><p class="info-label">Color</p><p class="info-value">${vehicle.color}</p></div>
            <div><p class="info-label">Placa</p><p class="info-value">${vehicle.plate}</p></div>
            <div><p class="info-label">Apodo</p><p class="info-value">${vehicle.nickname || "—"}</p></div>
            <div><p class="info-label">Estado</p><p class="info-value">${vehicle.active ? "Activo" : "Inactivo"}</p></div>
            <div><p class="info-label">Millaje actual</p><p class="info-value">${formatDistance(vehicle.currentMileage)}</p></div>
          </div>
        </div>

        <div class="card">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
            <p style="font-weight:600;">Próximo servicio</p>
            <span class="badge ${status.alertLevel}">${ALERT_LEVEL_ICON[status.alertLevel]} ${ALERT_LEVEL_LABEL[status.alertLevel]}</span>
          </div>
          <div class="progress-track"><div class="progress-fill ${status.alertLevel}" style="width:${status.progressPercent}%"></div></div>
          <div class="stat-3">
            <div><p class="big">${formatDistance(vehicle.currentMileage)}</p>Actual</div>
            <div><p class="big">${formatDistance(status.nextServiceMileage)}</p>Próximo servicio</div>
            <div><p class="big" style="${status.remainingKm <= 0 ? "color:var(--danger);" : ""}">${status.remainingKm <= 0 ? `Excedido ${formatDistance(Math.abs(status.remainingKm))}` : formatDistance(status.remainingKm)}</p>Faltan</div>
          </div>
          <p style="margin:12px 0 0;font-size:12px;color:var(--muted);">
            Último servicio: ${formatDistance(vehicle.lastServiceMileage)}${vehicle.lastServiceDate ? ` · ${formatDate(vehicle.lastServiceDate)}` : ""} · Intervalo: ${formatDistance(vehicle.serviceIntervalKm)}
          </p>
        </div>

        ${
          canEdit
            ? `<div style="display:flex;gap:12px;">
                <button id="toggle-active" class="btn btn-secondary" style="flex:1;">${vehicle.active ? "Marcar como inactivo" : "Marcar como activo"}</button>
                ${canDelete ? `<button id="delete-vehicle" class="btn btn-danger-outline" style="flex:1;">${icon("trash", 16)} Eliminar</button>` : ""}
              </div>`
            : ""
        }

        ${historySection("Historial de rutas", `/routes?vehicleId=${vehicle.id}`, routes, (r) => `
          <a href="#/routes/${r.id}" class="hist-row">
            <div style="min-width:0;"><p class="hist-title">${r.destination}</p><p class="hist-sub">${formatDate(r.date)}</p></div>
            <span class="hist-value">${r.distanceKm != null ? formatDistance(r.distanceKm) : "En curso"}</span>
          </a>`, "Sin rutas registradas")}

        ${historySection("Historial de combustible", `/fuel?vehicleId=${vehicle.id}`, fuelLogs, (f) => `
          <a href="#/fuel/${f.id}" class="hist-row">
            <div style="min-width:0;"><p class="hist-title">${f.fuelType}</p><p class="hist-sub">${formatDate(f.date)} · ${f.quantity} gal</p></div>
            <span class="hist-value">${formatCurrency(f.total)}</span>
          </a>`, "Sin cargas registradas")}

        ${historySection("Historial de mantenimiento", null, maintenances, (m) => `
          <div class="hist-row">
            <div style="min-width:0;"><p class="hist-title">${m.description}</p><p class="hist-sub">${formatDate(m.date)} · ${formatDistance(m.mileage)}</p></div>
            ${m.cost != null ? `<span class="hist-value">${formatCurrency(m.cost)}</span>` : ""}
          </div>`, "Sin servicios registrados")}
      </div>
    </div>
  `;

  document.getElementById("toggle-active")?.addEventListener("click", async () => {
    try {
      await data.toggleVehicleActive(vehicle.id, !vehicle.active, state.user);
      renderVehicleDetail(container, params);
    } catch (err) {
      toast(err.message);
    }
  });

  document.getElementById("delete-vehicle")?.addEventListener("click", async () => {
    if (!confirmAction("¿Eliminar este vehículo? Esta acción no se puede deshacer.")) return;
    try {
      await data.deleteVehicle(vehicle.id, state.user);
      navigate("/vehicles");
    } catch (err) {
      toast(err.message);
    }
  });
}

function historySection(title, href, items, renderItem, emptyText) {
  return `
    <div>
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
        <p style="font-size:14px;font-weight:600;">${title}</p>
        ${href ? `<a href="#${href}" style="font-size:12px;font-weight:500;color:var(--primary-600);">Ver todo</a>` : ""}
      </div>
      <div style="border-radius:16px;border:1px solid var(--border);background:var(--surface);overflow:hidden;">
        ${
          items.length === 0
            ? `<p style="padding:24px;text-align:center;font-size:14px;color:var(--muted);">${emptyText}</p>`
            : items.map(renderItem).join("")
        }
      </div>
    </div>
  `;
}
