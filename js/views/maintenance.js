import { state } from "../lib/store.js";
import { can } from "../lib/permissions.js";
import * as data from "../lib/data.js";
import { formatCurrency, formatDate, formatDistance, todayInput } from "../lib/format.js";
import { pageHeaderHtml, emptyStateHtml, toast, confirmAction } from "../lib/ui.js";
import { icon } from "../lib/icons.js";
import { navigate } from "../lib/router.js";
import { decimalInputAttrs, wireDecimalInputs, parseDecimal } from "../lib/decimal-input.js";

export async function renderMaintenanceList(container) {
  container.innerHTML = `<div class="center-page"><div class="spinner"></div></div>`;
  const [records, vehicles] = await Promise.all([data.getMaintenances(), data.getVehicles()]);
  const vehiclesById = Object.fromEntries(vehicles.map((v) => [v.id, v]));
  const canCreate = can(state.profile, "maintenance", "create");
  const canDelete = can(state.profile, "maintenance", "delete");

  container.innerHTML = `
    <div class="page">
      ${pageHeaderHtml({
        title: "Mantenimiento",
        subtitle: `${records.length} servicios registrados`,
        actionHtml: canCreate ? `<a href="#/maintenance/new" class="fab">${icon("plus", 20)}</a>` : "",
      })}
      <div class="content">
        ${
          records.length === 0
            ? emptyStateHtml({ icon: "🔧", title: "Sin mantenimientos registrados", actionHref: canCreate ? "/maintenance/new" : "", actionLabel: canCreate ? "Registrar mantenimiento" : "" })
            : records
                .map((m) => {
                  const v = vehiclesById[m.vehicleId] || {};
                  return `
                  <div class="item-card" data-id="${m.id}">
                    <div class="item-row">
                      <div style="min-width:0;">
                        <p class="title">${v.brand || ""} ${v.model || ""} · ${v.plate || ""}</p>
                        <p class="sub">${m.description}</p>
                      </div>
                      ${m.cost != null ? `<span style="font-weight:600;flex-shrink:0;">${formatCurrency(m.cost)}</span>` : ""}
                    </div>
                    <div style="display:flex;align-items:center;justify-content:space-between;margin-top:8px;font-size:13px;color:var(--muted);">
                      <span>${formatDate(m.date)} · ${formatDistance(m.mileage)}${m.performedBy ? ` · ${m.performedBy}` : ""}</span>
                      ${canDelete ? `<button class="btn-link-danger delete-maint" data-id="${m.id}">${icon("trash", 14)}</button>` : ""}
                    </div>
                  </div>`;
                })
                .join("")
        }
      </div>
    </div>
  `;

  container.querySelectorAll(".delete-maint").forEach((btn) =>
    btn.addEventListener("click", async () => {
      if (!confirmAction("¿Eliminar este registro de mantenimiento?")) return;
      try {
        await data.deleteMaintenance(btn.dataset.id, state.user);
        renderMaintenanceList(container);
      } catch (err) {
        toast(err.message);
      }
    })
  );
}

export async function renderMaintenanceNew(container) {
  const vehicles = (await data.getVehicles()).filter((v) => v.active);

  container.innerHTML = `
    <div class="page">
      ${pageHeaderHtml({ title: "Registrar mantenimiento", backHref: "/maintenance" })}
      <form class="form" id="maint-form">
        <div id="form-error"></div>
        <div class="field">
          <label>Vehículo</label>
          <select name="vehicleId" id="vehicle-select" required>
            ${vehicles.map((v) => `<option value="${v.id}" data-mileage="${v.currentMileage}">${v.brand} ${v.model} · ${v.plate}</option>`).join("")}
          </select>
        </div>
        <div class="form-grid-2">
          <div class="field"><label>Fecha del servicio</label><input name="date" type="date" value="${todayInput()}" required></div>
          <div class="field"><label>Millaje del servicio (mi)</label><input name="mileage" id="mileage-input" type="number" value="${vehicles[0]?.currentMileage ?? ""}" required></div>
        </div>
        <div class="field"><label>Descripción del servicio</label><textarea name="description" placeholder="Ej. Cambio de aceite y filtros" required></textarea></div>
        <div class="form-grid-2">
          <div class="field"><label>Costo</label><input name="cost" ${decimalInputAttrs} data-decimal placeholder="Opcional"></div>
          <div class="field"><label>Realizado por</label><input name="performedBy" placeholder="Taller / mecánico"></div>
        </div>
        <p class="banner-info">Al guardar, este servicio se convierte en el último mantenimiento del vehículo y se recalcula automáticamente el próximo millaje de servicio.</p>
        <button type="submit" class="btn btn-primary btn-full">Guardar mantenimiento</button>
      </form>
    </div>
  `;

  document.getElementById("vehicle-select").addEventListener("change", (e) => {
    document.getElementById("mileage-input").value = e.target.selectedOptions[0].dataset.mileage;
  });
  wireDecimalInputs(container);

  const form = document.getElementById("maint-form");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const errorBox = document.getElementById("form-error");
    errorBox.innerHTML = "";
    const fd = new FormData(form);
    const payload = {
      vehicleId: fd.get("vehicleId"),
      date: fd.get("date"),
      mileage: Number(fd.get("mileage")),
      description: fd.get("description").trim(),
      cost: fd.get("cost") ? parseDecimal(fd.get("cost")) : null,
      performedBy: fd.get("performedBy").trim(),
    };
    const btn = form.querySelector("button[type=submit]");
    btn.disabled = true;
    btn.textContent = "Guardando...";
    try {
      await data.createMaintenance(payload, state.user);
      navigate("/maintenance");
    } catch (err) {
      errorBox.innerHTML = `<p class="banner-error">${err.message}</p>`;
      btn.disabled = false;
      btn.textContent = "Guardar mantenimiento";
    }
  });
}
