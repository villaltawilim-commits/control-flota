import { state } from "../lib/store.js";
import { can } from "../lib/permissions.js";
import * as data from "../lib/data.js";
import { formatCurrency, formatDate, formatDistance, todayInput } from "../lib/format.js";
import { pageHeaderHtml, emptyStateHtml, toast, confirmAction } from "../lib/ui.js";
import { icon } from "../lib/icons.js";
import { navigate, currentQuery } from "../lib/router.js";

const FUEL_TYPES = ["Diésel", "Gasolina Regular", "Gasolina Súper", "GLP"];

export async function renderFuelList(container) {
  container.innerHTML = `<div class="center-page"><div class="spinner"></div></div>`;
  const { vehicleId } = currentQuery();
  const logs = await data.getFuelLogs({ vehicleId });
  const canCreate = can(state.profile, "fuel", "create");

  const vehiclesById = {};
  if (logs.length) {
    const vehicles = await data.getVehicles();
    vehicles.forEach((v) => (vehiclesById[v.id] = v));
  }

  container.innerHTML = `
    <div class="page">
      ${pageHeaderHtml({
        title: "Combustible",
        subtitle: `${logs.length} cargas registradas`,
        actionHtml: canCreate ? `<a href="#/fuel/new" class="fab">${icon("plus", 20)}</a>` : "",
      })}
      <div class="content">
        ${
          logs.length === 0
            ? emptyStateHtml({ icon: "⛽", title: "Sin cargas registradas", actionHref: canCreate ? "/fuel/new" : "", actionLabel: canCreate ? "Registrar combustible" : "" })
            : logs
                .map((f) => {
                  const v = vehiclesById[f.vehicleId] || {};
                  return `
                  <a href="#/fuel/${f.id}" class="item-card">
                    <div class="item-row">
                      <div style="min-width:0;">
                        <p class="title">${v.brand || ""} ${v.model || ""} · ${v.plate || ""}</p>
                        <p class="sub">${formatDate(f.date)} · ${f.fuelType} · ${f.quantity} gal</p>
                      </div>
                      <span style="font-weight:600;flex-shrink:0;">${formatCurrency(f.total)}</span>
                    </div>
                    ${!f.invoicePhotoPath || !f.pumpPhotoPath ? `<p style="margin:8px 0 0;font-size:12px;color:var(--warning);font-weight:500;">⚠️ Excepción de fotografías autorizada</p>` : ""}
                  </a>`;
                })
                .join("")
        }
      </div>
    </div>
  `;
}

function photoCaptureHtml(name, label, required) {
  return `
    <div class="field photo-capture" data-photo="${name}">
      <span>${label} ${required ? '<span style="color:var(--danger);">*</span>' : ""}</span>
      <input type="file" name="${name}" accept="image/*" capture="environment" hidden>
      <div class="drop" data-role="trigger">${icon("camera", 26)}<span>📷 Tomar foto</span></div>
      <button type="button" class="remove-btn" hidden>Quitar foto</button>
    </div>
  `;
}

function wirePhotoCapture(root, name) {
  const wrap = root.querySelector(`[data-photo="${name}"]`);
  const input = wrap.querySelector("input[type=file]");
  const drop = wrap.querySelector('[data-role="trigger"]');
  const removeBtn = wrap.querySelector(".remove-btn");

  drop.addEventListener("click", () => input.click());
  input.addEventListener("change", () => {
    const file = input.files[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    drop.classList.add("filled");
    drop.innerHTML = `<img src="${url}" alt="${name}">`;
    removeBtn.hidden = false;
  });
  removeBtn.addEventListener("click", () => {
    input.value = "";
    drop.classList.remove("filled");
    drop.innerHTML = `${icon("camera", 26)}<span>📷 Tomar foto</span>`;
    removeBtn.hidden = true;
  });
}

export async function renderFuelNew(container) {
  const { vehicleId: initialVehicleId, routeId: initialRouteId } = currentQuery();
  const vehicles = (await data.getVehicles()).filter((v) => v.active);
  const isAdmin = state.profile.role === "ADMIN";

  if (vehicles.length === 0) {
    container.innerHTML = `<div class="page">${pageHeaderHtml({ title: "Registrar combustible", backHref: "/fuel" })}<div class="content">${emptyStateHtml({ title: "No hay vehículos activos" })}</div></div>`;
    return;
  }

  const selectedVehicleId = initialVehicleId || vehicles[0].id;
  const allRoutes = await data.getRoutes({ vehicleId: selectedVehicleId });
  const openRoutes = allRoutes.filter((r) => r.status === "OPEN");

  container.innerHTML = `
    <div class="page">
      ${pageHeaderHtml({ title: "Registrar combustible", backHref: "/fuel" })}
      <form class="form" id="fuel-form">
        <div id="form-error"></div>
        <div class="field"><label>Fecha</label><input name="date" type="date" value="${todayInput()}" required></div>
        <div class="field">
          <label>Vehículo</label>
          <select name="vehicleId" id="vehicle-select" required>
            ${vehicles.map((v) => `<option value="${v.id}" data-mileage="${v.currentMileage}" ${v.id === selectedVehicleId ? "selected" : ""}>${v.brand} ${v.model} · ${v.plate}</option>`).join("")}
          </select>
        </div>
        <div class="field" id="route-field" ${openRoutes.length === 0 ? "hidden" : ""}>
          <label>Ruta relacionada</label>
          <select name="routeId" id="route-select">
            <option value="">Sin ruta relacionada</option>
            ${openRoutes.map((r) => `<option value="${r.id}" ${r.id === initialRouteId ? "selected" : ""}>${r.destination}</option>`).join("")}
          </select>
        </div>
        <div class="field"><label>Millaje al cargar combustible (mi)</label><input name="mileage" id="mileage-input" type="number" value="${vehicles.find((v) => v.id === selectedVehicleId).currentMileage}" required></div>
        <div class="field">
          <label>Tipo de combustible</label>
          <select name="fuelType" required>${FUEL_TYPES.map((t) => `<option value="${t}">${t}</option>`).join("")}</select>
        </div>
        <div class="form-grid-2">
          <div class="field"><label>Cantidad (gal/L)</label><input name="quantity" id="quantity-input" type="number" step="0.01" required></div>
          <div class="field"><label>Precio por unidad</label><input name="pricePerUnit" id="price-input" type="number" step="0.01" required></div>
        </div>
        <div class="field"><label>Total pagado</label><input name="total" id="total-input" type="number" step="0.01" required></div>
        <div class="form-grid-2">
          <div class="field"><label>Número de factura</label><input name="invoiceNumber" placeholder="Opcional"></div>
          <div class="field"><label>Estación de servicio</label><input name="station" placeholder="Opcional"></div>
        </div>
        <div class="form-grid-2">
          ${photoCaptureHtml("invoicePhoto", "Foto de factura", true)}
          ${photoCaptureHtml("pumpPhoto", "Foto de bomba", true)}
        </div>
        <div class="field"><label>Observaciones</label><textarea name="observations" placeholder="Opcional"></textarea></div>
        ${
          isAdmin
            ? `<div class="card" style="display:flex;flex-direction:column;gap:12px;">
                <p style="font-weight:600;font-size:14px;">Autorizaciones de administrador</p>
                <label class="checkbox-row"><input type="checkbox" name="skipPhotoRequirement" id="skip-photos"> Autorizar guardar sin fotografías</label>
                <input name="photoExceptionReason" id="exception-reason" placeholder="Motivo de la excepción" hidden>
                <label class="checkbox-row"><input type="checkbox" name="allowTotalMismatch"> Autorizar ajuste manual del total</label>
              </div>`
            : ""
        }
        <button type="submit" class="btn btn-primary btn-full">Guardar registro de combustible</button>
      </form>
    </div>
  `;

  wirePhotoCapture(container, "invoicePhoto");
  wirePhotoCapture(container, "pumpPhoto");

  const vehicleSelect = document.getElementById("vehicle-select");
  const routeField = document.getElementById("route-field");
  const routeSelect = document.getElementById("route-select");
  vehicleSelect.addEventListener("change", async () => {
    const opt = vehicleSelect.selectedOptions[0];
    document.getElementById("mileage-input").value = opt.dataset.mileage;
    const routes = (await data.getRoutes({ vehicleId: opt.value })).filter((r) => r.status === "OPEN");
    if (routes.length) {
      routeField.hidden = false;
      routeSelect.innerHTML = `<option value="">Sin ruta relacionada</option>${routes.map((r) => `<option value="${r.id}">${r.destination}</option>`).join("")}`;
    } else {
      routeField.hidden = true;
      routeSelect.innerHTML = `<option value="">Sin ruta relacionada</option>`;
    }
  });

  const qtyInput = document.getElementById("quantity-input");
  const priceInput = document.getElementById("price-input");
  const totalInput = document.getElementById("total-input");
  function recalcTotal() {
    const q = Number(qtyInput.value);
    const p = Number(priceInput.value);
    if (q > 0 && p > 0) totalInput.value = (q * p).toFixed(2);
  }
  qtyInput.addEventListener("input", recalcTotal);
  priceInput.addEventListener("input", recalcTotal);

  document.getElementById("skip-photos")?.addEventListener("change", (e) => {
    document.getElementById("exception-reason").hidden = !e.target.checked;
  });

  const form = document.getElementById("fuel-form");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const errorBox = document.getElementById("form-error");
    errorBox.innerHTML = "";
    const fd = new FormData(form);
    const payload = {
      date: fd.get("date"),
      vehicleId: fd.get("vehicleId"),
      routeId: fd.get("routeId") || "",
      mileage: Number(fd.get("mileage")),
      fuelType: fd.get("fuelType"),
      quantity: Number(fd.get("quantity")),
      pricePerUnit: Number(fd.get("pricePerUnit")),
      total: Number(fd.get("total")),
      invoiceNumber: fd.get("invoiceNumber").trim(),
      station: fd.get("station").trim(),
      observations: fd.get("observations").trim(),
      skipPhotoRequirement: fd.get("skipPhotoRequirement") === "on",
      photoExceptionReason: (fd.get("photoExceptionReason") || "").trim(),
      allowTotalMismatch: fd.get("allowTotalMismatch") === "on",
    };
    const files = { invoicePhoto: fd.get("invoicePhoto"), pumpPhoto: fd.get("pumpPhoto") };

    const btn = form.querySelector("button[type=submit]");
    btn.disabled = true;
    btn.textContent = "Guardando...";
    try {
      const id = await data.createFuelLog(payload, files, state.user, isAdmin);
      navigate(`/fuel/${id}`);
    } catch (err) {
      errorBox.innerHTML = `<p class="banner-error">${err.message}</p>`;
      btn.disabled = false;
      btn.textContent = "Guardar registro de combustible";
    }
  });
}

export async function renderFuelDetail(container, params) {
  container.innerHTML = `<div class="center-page"><div class="spinner"></div></div>`;
  const fuelLog = await data.getFuelLog(params.id);
  if (!fuelLog) {
    container.innerHTML = emptyStateHtml({ title: "Registro no encontrado" });
    return;
  }
  const [vehicle, user, route] = await Promise.all([
    data.getVehicle(fuelLog.vehicleId),
    data.getUser(fuelLog.userId),
    fuelLog.routeId ? data.getRoute(fuelLog.routeId) : null,
  ]);
  const canDelete = can(state.profile, "fuel", "delete");

  container.innerHTML = `
    <div class="page">
      ${pageHeaderHtml({ title: vehicle ? `${vehicle.brand} ${vehicle.model}` : "Combustible", subtitle: formatDate(fuelLog.date), backHref: "/fuel" })}
      <div class="content">
        <div class="card">
          <div class="info-grid">
            <div><p class="info-label">Vehículo</p><p class="info-value">${vehicle ? `${vehicle.brand} ${vehicle.model} · ${vehicle.plate}` : "—"}</p></div>
            <div><p class="info-label">Millaje</p><p class="info-value">${formatDistance(fuelLog.mileage)}</p></div>
            <div><p class="info-label">Tipo</p><p class="info-value">${fuelLog.fuelType}</p></div>
            <div><p class="info-label">Cantidad</p><p class="info-value">${fuelLog.quantity} gal/L</p></div>
            <div><p class="info-label">Precio unitario</p><p class="info-value">${formatCurrency(fuelLog.pricePerUnit)}</p></div>
            <div><p class="info-label">Total</p><p class="info-value">${formatCurrency(fuelLog.total)}</p></div>
            <div><p class="info-label">Factura</p><p class="info-value">${fuelLog.invoiceNumber || "—"}</p></div>
            <div><p class="info-label">Estación</p><p class="info-value">${fuelLog.station || "—"}</p></div>
            <div><p class="info-label">Registrado por</p><p class="info-value">${user?.name || "—"}</p></div>
            ${route ? `<div><p class="info-label">Ruta</p><p class="info-value">${route.destination}</p></div>` : ""}
          </div>
          ${fuelLog.observations ? `<div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--border);"><p class="info-label">Observaciones</p><p style="font-size:14px;">${fuelLog.observations}</p></div>` : ""}
        </div>

        ${
          fuelLog.photoExceptionReason
            ? `<div class="card" style="background:var(--warning-bg);border-color:rgba(180,83,9,0.2);color:var(--warning);">
                <p style="font-weight:600;">⚠️ Excepción de fotografías</p>
                <p style="margin-top:4px;">${fuelLog.photoExceptionReason}</p>
              </div>`
            : ""
        }

        <div class="form-grid-2">
          ${photoTile("Factura", fuelLog.invoicePhotoUrl)}
          ${photoTile("Bomba", fuelLog.pumpPhotoUrl)}
        </div>

        ${canDelete ? `<button id="delete-fuel" class="btn btn-danger-outline btn-full">${icon("trash", 16)} Eliminar registro</button>` : ""}
      </div>
    </div>
  `;

  document.getElementById("delete-fuel")?.addEventListener("click", async () => {
    if (!confirmAction("¿Eliminar este registro de combustible? Esta acción no se puede deshacer.")) return;
    try {
      await data.deleteFuelLog(fuelLog.id, state.user);
      navigate("/fuel");
    } catch (err) {
      toast(err.message);
    }
  });
}

function photoTile(label, url) {
  return `
    <div>
      <p style="margin:0 0 6px;font-size:12px;font-weight:500;color:var(--muted);">${label}</p>
      ${
        url
          ? `<a href="${url}" target="_blank" rel="noopener" style="display:block;overflow:hidden;border-radius:12px;border:1px solid var(--border);">
              <img src="${url}" alt="${label}" style="height:160px;width:100%;object-fit:cover;">
            </a>`
          : `<div style="height:160px;display:flex;align-items:center;justify-content:center;border-radius:12px;border:1px dashed var(--border);font-size:14px;color:var(--muted);">Sin foto</div>`
      }
    </div>
  `;
}
