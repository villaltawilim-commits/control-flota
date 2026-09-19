import { getDashboardData } from "../lib/dashboard.js";
import { formatCurrency, formatDistance, formatNumber } from "../lib/format.js";
import { ALERT_LEVEL_ICON } from "../lib/vehicle-status.js";
import { state } from "../lib/store.js";
import { can } from "../lib/permissions.js";
import { openModal, closeModal } from "../lib/ui.js";
import { icon } from "../lib/icons.js";
import { navigate } from "../lib/router.js";

export async function renderDashboard(container) {
  container.innerHTML = `<div class="center-page"><div class="spinner"></div></div>`;

  let data;
  try {
    data = await getDashboardData();
  } catch (e) {
    container.innerHTML = `<div class="content"><p class="banner-error">Error cargando el panel: ${e.message}</p></div>`;
    return;
  }

  const firstName = (state.profile?.name || "").split(" ")[0];

  container.innerHTML = `
    <div class="page">
      <div class="content">
        <div>
          <h1 style="font-size:20px;font-weight:700;margin:0;">Hola, ${firstName}</h1>
          <p style="color:var(--muted);font-size:14px;margin:2px 0 0;">Resumen general de la flota</p>
        </div>

        ${
          data.alerts.length
            ? `<div class="card">
                <p style="font-weight:700;margin:0 0 10px;">🚨 Alertas de mantenimiento</p>
                <div style="display:flex;flex-direction:column;gap:8px;">
                  ${data.alerts
                    .map(({ vehicle, status }) => {
                      const overdue = status.alertLevel === "urgent";
                      return `
                    <a href="#/vehicles/${vehicle.id}" style="display:flex;align-items:center;justify-content:space-between;gap:8px;border-radius:12px;background:${overdue ? "var(--danger-bg)" : "var(--background)"};padding:10px 12px;font-size:14px;">
                      <span style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
                        ${ALERT_LEVEL_ICON[status.alertLevel]} <strong>${vehicle.brand} ${vehicle.model}</strong>
                        <span style="color:var(--muted);"> — ${vehicle.plate}</span>
                      </span>
                      <span style="flex-shrink:0;font-weight:600;color:${overdue ? "var(--danger)" : "var(--primary-600)"};">
                        ${overdue ? `Excedido ${formatDistance(Math.abs(status.remainingKm))}` : `Faltan ${formatDistance(status.remainingKm)}`}
                      </span>
                    </a>`;
                    })
                    .join("")}
                </div>
              </div>`
            : ""
        }

        <p class="section-label">Vehículos</p>
        <div class="stat-grid">
          <div class="stat-card"><p class="label">Total</p><p class="value">${data.vehicles.total}</p></div>
          <div class="stat-card tone-success"><p class="label">Activos</p><p class="value">${data.vehicles.active}</p></div>
          <div class="stat-card"><p class="label">Inactivos</p><p class="value">${data.vehicles.inactive}</p></div>
        </div>

        ${
          state.profile?.role !== "REGISTRAR"
            ? `<p class="section-label">Combustible</p>
              <div class="stat-grid">
                <div class="stat-card"><p class="label">Gasto de hoy</p><p class="value">${formatCurrency(data.fuel.todayTotal)}</p></div>
                <div class="stat-card"><p class="label">Gasto del mes</p><p class="value">${formatCurrency(data.fuel.monthTotal)}</p></div>
                <div class="stat-card"><p class="label">Gal/Litros (mes)</p><p class="value">${formatNumber(data.fuel.monthQuantity, 1)}</p></div>
              </div>`
            : ""
        }

        <p class="section-label">Millaje</p>
        <div class="stat-grid cols-2">
          <div class="stat-card"><p class="label">Recorrido hoy</p><p class="value">${formatDistance(data.mileage.today)}</p></div>
          <div class="stat-card"><p class="label">Recorrido del mes</p><p class="value">${formatDistance(data.mileage.month)}</p></div>
        </div>

        <p class="section-label">Mantenimiento</p>
        <div class="stat-grid cols-2">
          <div class="stat-card tone-warning"><p class="label">Próximos a servicio</p><p class="value">${data.maintenance.warning}</p></div>
          <div class="stat-card tone-danger"><p class="label">Servicio urgente</p><p class="value">${data.maintenance.urgent}</p></div>
        </div>

        <div class="quick-grid">
          <a href="#/routes/new" class="quick-btn"><span class="emoji">🗺️</span>Nueva ruta</a>
          <a href="#/fuel/new" class="quick-btn"><span class="emoji">⛽</span>Registrar combustible</a>
          <a href="#/vehicles" class="quick-btn"><span class="emoji">🚚</span>Vehículos</a>
          <a href="#/reports" class="quick-btn"><span class="emoji">📊</span>Reportes</a>
        </div>
      </div>
    </div>
  `;

  maybeShowRouteSuggestion(data.routeSuggestion);
}

function maybeShowRouteSuggestion(suggestion) {
  if (!suggestion || !can(state.profile, "routes", "create")) return;

  const todayStr = new Date().toISOString().slice(0, 10);
  try {
    if (localStorage.getItem("routeSuggestionShownDate") === todayStr) return;
  } catch {
    /* ignore storage access errors */
  }

  const { vehicle, status, daysUntilDue } = suggestion;
  const remainingText =
    status.remainingKm >= 0
      ? `le faltan ${formatDistance(status.remainingKm)} para su próximo servicio`
      : `aunque ya lleva ${formatDistance(Math.abs(status.remainingKm))} de más desde su último servicio, es el que menos atrasado está`;
  const paceText =
    Math.abs(daysUntilDue) >= 1e9
      ? "sin viajes recientes registrados para estimar su ritmo de uso"
      : daysUntilDue >= 0
        ? `a su ritmo de uso de los últimos 30 días, tardaría unos ${Math.round(daysUntilDue)} días en llegar a ese punto`
        : `a su ritmo de uso de los últimos 30 días, ya debería haber llegado a ese punto hace unos ${Math.round(Math.abs(daysUntilDue))} días`;

  const overlay = openModal(`
    <div class="modal-header">
      <p style="font-weight:700;font-size:16px;margin:0;">🚚 Sugerencia de ruta</p>
      <button type="button" id="modal-close-x" class="modal-close-btn" aria-label="Cerrar">${icon("close", 16)}</button>
    </div>
    <p style="margin:0 0 16px;font-size:14px;color:var(--muted);">
      Se sugiere mandar a ruta hoy a <strong>${vehicle.brand} ${vehicle.model} · ${vehicle.plate}</strong>.
      Entre los vehículos disponibles (no están ya en ruta), es el que tiene más margen estimado en días antes de su próximo servicio: ${remainingText}, y ${paceText}.
    </p>
    <div style="display:flex;flex-direction:column;gap:10px;">
      <button type="button" id="suggestion-go" class="btn btn-primary btn-full">Ir a nueva ruta</button>
      <button type="button" id="suggestion-dismiss" class="btn btn-secondary btn-full">Ahora no</button>
    </div>
  `);

  try {
    localStorage.setItem("routeSuggestionShownDate", todayStr);
  } catch {
    /* ignore storage access errors */
  }

  overlay.querySelector("#modal-close-x").addEventListener("click", () => closeModal());
  overlay.querySelector("#suggestion-dismiss").addEventListener("click", () => closeModal());
  overlay.querySelector("#suggestion-go").addEventListener("click", () => {
    closeModal();
    navigate(`/routes/new?vehicleId=${vehicle.id}`);
  });
}
