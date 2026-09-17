import { getDashboardData } from "../lib/dashboard.js";
import { formatCurrency, formatDistance, formatNumber } from "../lib/format.js";
import { ALERT_LEVEL_ICON } from "../lib/vehicle-status.js";
import { state } from "../lib/store.js";

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
            ? `<div class="card" style="border-color:rgba(217,45,32,0.2);background:var(--danger-bg);">
                <p style="font-weight:700;color:var(--danger);margin:0 0 10px;">🚨 Alertas de mantenimiento</p>
                <div style="display:flex;flex-direction:column;gap:8px;">
                  ${data.alerts
                    .slice(0, 6)
                    .map(
                      ({ vehicle, status }) => `
                    <a href="#/vehicles/${vehicle.id}" style="display:flex;align-items:center;justify-content:space-between;gap:8px;border-radius:12px;background:var(--surface);padding:10px 12px;font-size:14px;">
                      <span style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
                        ${ALERT_LEVEL_ICON[status.alertLevel]} <strong>${vehicle.brand} ${vehicle.model}</strong>
                        <span style="color:var(--muted);"> — ${vehicle.plate}</span>
                      </span>
                      <span style="flex-shrink:0;font-weight:600;color:${status.alertLevel === "urgent" ? "var(--danger)" : "var(--warning)"};">
                        ${status.remainingKm <= 0 ? `Excedido ${formatDistance(Math.abs(status.remainingKm))}` : `Faltan ${formatDistance(status.remainingKm)}`}
                      </span>
                    </a>`
                    )
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
}
