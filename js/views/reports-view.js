import { getRouteReport, getPerformanceReport, getReportFilterOptions, getSummaryReport, periodRange } from "../lib/reports.js";
import { formatCurrency, formatDate, formatDistance, formatNumber } from "../lib/format.js";
import { pageHeaderHtml, emptyStateHtml } from "../lib/ui.js";
import { currentQuery, navigate } from "../lib/router.js";

const PERIODS = [
  { value: "day", label: "Día" },
  { value: "week", label: "Semana" },
  { value: "month", label: "Mes" },
  { value: "year", label: "Año" },
  { value: "custom", label: "Personalizado" },
];

export async function renderReports(container, params, query) {
  container.innerHTML = `<div class="center-page"><div class="spinner"></div></div>`;

  const tab = query.tab === "performance" ? "performance" : query.tab === "routes" ? "routes" : "summary";
  const { vehicles, users } = await getReportFilterOptions();

  if (tab === "summary") {
    await renderSummaryTab(container, query, vehicles);
    return;
  }

  const filters = {
    dateFrom: query.dateFrom || "",
    dateTo: query.dateTo || "",
    vehicleId: query.vehicleId || "",
    plate: query.plate || "",
    destination: query.destination || "",
    userId: query.userId || "",
    fuelType: query.fuelType || "",
  };
  const sort = query.sort || "gasto_desc";

  const rows = tab === "routes" ? await getRouteReport(filters) : await getPerformanceReport(filters, sort);

  container.innerHTML = `
    <div class="page wide">
      ${pageHeaderHtml({ title: "Reportes", subtitle: "Rutas, combustible y rendimiento" })}
      <div class="content">
        ${tabsHtml(tab, filters)}

        <form class="filter-form" id="filter-form">
          <input type="hidden" name="tab" value="${tab}">
          <div class="field"><label>Desde</label><input type="date" name="dateFrom" value="${filters.dateFrom}"></div>
          <div class="field"><label>Hasta</label><input type="date" name="dateTo" value="${filters.dateTo}"></div>
          <div class="field">
            <label>Vehículo</label>
            <select name="vehicleId">
              <option value="">Todos</option>
              ${vehicles.map((v) => `<option value="${v.id}" ${v.id === filters.vehicleId ? "selected" : ""}>${v.brand} ${v.model} · ${v.plate}</option>`).join("")}
            </select>
          </div>
          <div class="field">
            <label>Usuario</label>
            <select name="userId">
              <option value="">Todos</option>
              ${users.map((u) => `<option value="${u.id}" ${u.id === filters.userId ? "selected" : ""}>${u.name}</option>`).join("")}
            </select>
          </div>
          ${
            tab === "routes"
              ? `<div class="field"><label>Destino / Ruta</label><input name="destination" value="${filters.destination}" placeholder="Buscar..."></div>`
              : `<div class="field"><label>Ordenar por</label>
                  <select name="sort">
                    <option value="gasto_desc" ${sort === "gasto_desc" ? "selected" : ""}>Mayor gasto</option>
                    <option value="gasto_asc" ${sort === "gasto_asc" ? "selected" : ""}>Menor gasto</option>
                    <option value="costo_km_desc" ${sort === "costo_km_desc" ? "selected" : ""}>Mayor costo/milla</option>
                    <option value="costo_km_asc" ${sort === "costo_km_asc" ? "selected" : ""}>Menor costo/milla</option>
                    <option value="km_desc" ${sort === "km_desc" ? "selected" : ""}>Mayor millaje</option>
                  </select>
                </div>`
          }
          <div class="field" style="justify-content:flex-end;">
            <button type="submit" class="btn btn-primary">Aplicar filtros</button>
          </div>
        </form>

        ${tab === "routes" ? routeTable(rows) : performanceTable(rows)}
      </div>
    </div>
  `;

  document.getElementById("filter-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const params = new URLSearchParams();
    for (const [k, v] of fd.entries()) if (v) params.set(k, v);
    navigate(`/reports?${params.toString()}`);
  });
}

async function renderSummaryTab(container, query, vehicles) {
  const period = PERIODS.some((p) => p.value === query.period) ? query.period : "month";
  const vehicleId = query.vehicleId || "";
  const customFrom = query.dateFrom || "";
  const customTo = query.dateTo || "";

  const { dateFrom, dateTo } = period === "custom" ? { dateFrom: customFrom, dateTo: customTo } : periodRange(period);
  const data = await getSummaryReport({ vehicleId, dateFrom, dateTo });

  const vehicleTail = vehicleId ? `&vehicleId=${vehicleId}` : "";
  const selectedVehicle = vehicles.find((v) => v.id === vehicleId);

  container.innerHTML = `
    <div class="page wide">
      ${pageHeaderHtml({ title: "Reportes", subtitle: "Rutas, combustible y rendimiento" })}
      <div class="content">
        ${tabsHtml("summary", {})}

        <div class="filter-form" style="grid-template-columns:1fr;gap:16px;">
          <div class="field">
            <label>Vehículo</label>
            <select id="summary-vehicle">
              <option value="">Todos los vehículos</option>
              ${vehicles.map((v) => `<option value="${v.id}" ${v.id === vehicleId ? "selected" : ""}>${v.brand} ${v.model} · ${v.plate}</option>`).join("")}
            </select>
          </div>
          <div class="field">
            <label>Período</label>
            <div class="tabs" style="margin-bottom:0;flex-wrap:wrap;">
              ${PERIODS.map((p) => `<a class="tab-link ${period === p.value ? "active" : ""}" href="#/reports?tab=summary&period=${p.value}${vehicleTail}">${p.label}</a>`).join("")}
            </div>
          </div>
          ${
            period === "custom"
              ? `<form id="custom-range-form" style="display:grid;grid-template-columns:1fr 1fr auto;gap:12px;align-items:end;">
                  <div class="field" style="margin:0;"><label>Desde</label><input type="date" name="dateFrom" value="${customFrom}"></div>
                  <div class="field" style="margin:0;"><label>Hasta</label><input type="date" name="dateTo" value="${customTo}"></div>
                  <button type="submit" class="btn btn-primary">Aplicar</button>
                </form>`
              : `<p style="margin:0;font-size:13px;color:var(--muted);">${formatDate(dateFrom)} — ${formatDate(dateTo)}${selectedVehicle ? ` · ${selectedVehicle.brand} ${selectedVehicle.model} · ${selectedVehicle.plate}` : " · Toda la flota"}</p>`
          }
        </div>

        <p class="section-label">Recorrido</p>
        <div class="stat-grid cols-2">
          <div class="stat-card"><p class="label">Km/millas recorridos</p><p class="value">${formatDistance(data.distanceKm)}</p></div>
          <div class="stat-card"><p class="label">Rutas realizadas</p><p class="value">${data.routeCount}</p></div>
        </div>

        <p class="section-label">Combustible</p>
        <div class="stat-grid cols-2">
          <div class="stat-card"><p class="label">Combustible gastado</p><p class="value">${formatCurrency(data.fuelCost)}</p></div>
          <div class="stat-card"><p class="label">Costo por milla</p><p class="value">${data.costPerKm != null ? formatCurrency(data.costPerKm) : "—"}</p></div>
          <div class="stat-card"><p class="label">Combustible consumido</p><p class="value">${formatNumber(data.fuelQty, 1)} gal/L</p></div>
          <div class="stat-card"><p class="label">Consumo promedio</p><p class="value">${data.avgConsumption != null ? `${formatNumber(data.avgConsumption, 1)} mi/gal` : "—"}</p></div>
        </div>

        <p class="section-label">Costos generales</p>
        <div class="stat-grid cols-2">
          <div class="stat-card"><p class="label">Mantenimiento</p><p class="value">${formatCurrency(data.maintCost)}</p></div>
          <div class="stat-card tone-primary"><p class="label">Costo total de operación</p><p class="value">${formatCurrency(data.totalOperatingCost)}</p></div>
          <div class="stat-card"><p class="label">Gasto promedio por ruta</p><p class="value">${data.avgCostPerRoute != null ? formatCurrency(data.avgCostPerRoute) : "—"}</p></div>
          <div class="stat-card"><p class="label">Cargas de combustible</p><p class="value">${data.fuelChargeCount}</p></div>
        </div>
      </div>
    </div>
  `;

  document.getElementById("summary-vehicle").addEventListener("change", (e) => {
    const params = new URLSearchParams();
    params.set("tab", "summary");
    params.set("period", period);
    if (period === "custom") {
      if (customFrom) params.set("dateFrom", customFrom);
      if (customTo) params.set("dateTo", customTo);
    }
    if (e.target.value) params.set("vehicleId", e.target.value);
    navigate(`/reports?${params.toString()}`);
  });

  document.getElementById("custom-range-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const params = new URLSearchParams();
    params.set("tab", "summary");
    params.set("period", "custom");
    if (vehicleId) params.set("vehicleId", vehicleId);
    if (fd.get("dateFrom")) params.set("dateFrom", fd.get("dateFrom"));
    if (fd.get("dateTo")) params.set("dateTo", fd.get("dateTo"));
    navigate(`/reports?${params.toString()}`);
  });
}

function tabsHtml(activeTab, filters) {
  const summaryTail = filters.vehicleId ? `&vehicleId=${filters.vehicleId}` : "";
  return `
    <div class="tabs">
      <a class="tab-link ${activeTab === "summary" ? "active" : ""}" href="#/reports?tab=summary${summaryTail}">Resumen</a>
      <a class="tab-link ${activeTab === "routes" ? "active" : ""}" href="#/reports?tab=routes${queryTail(filters)}">Por ruta</a>
      <a class="tab-link ${activeTab === "performance" ? "active" : ""}" href="#/reports?tab=performance${queryTail(filters)}">Rendimiento</a>
    </div>
  `;
}

function queryTail(filters) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => v && params.set(k, v));
  const s = params.toString();
  return s ? `&${s}` : "";
}

function routeTable(rows) {
  if (rows.length === 0) return emptyStateHtml({ title: "Sin resultados", desc: "Ajusta los filtros para ver rutas cerradas." });
  return `
    <div class="table-wrap">
      <table class="report">
        <thead><tr><th>Fecha</th><th>Vehículo</th><th>Ruta</th><th class="num">Salida</th><th class="num">Entrada</th><th class="num">Mi</th><th class="num">Combustible</th><th class="num">Costo</th><th class="num">Q/mi</th></tr></thead>
        <tbody>
          ${rows
            .map(
              (r) => `<tr>
              <td>${formatDate(r.date)}</td>
              <td>${r.vehicle} <span style="color:var(--muted);">· ${r.plate}</span></td>
              <td>${r.destination}</td>
              <td class="num">${formatNumber(r.departureMileage)}</td>
              <td class="num">${r.arrivalMileage != null ? formatNumber(r.arrivalMileage) : "—"}</td>
              <td class="num" style="font-weight:600;">${formatDistance(r.distanceKm)}</td>
              <td class="num">${formatNumber(r.fuelUsed, 1)}</td>
              <td class="num">${formatCurrency(r.fuelCost)}</td>
              <td class="num" style="font-weight:600;">${r.costPerKm != null ? formatCurrency(r.costPerKm) : "—"}</td>
            </tr>`
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

function performanceTable(rows) {
  if (rows.length === 0) return emptyStateHtml({ title: "Sin resultados", desc: "Ajusta los filtros para ver el rendimiento." });
  return `
    <div class="table-wrap">
      <table class="report">
        <thead><tr><th>Vehículo</th><th class="num">Millas recorridas</th><th class="num">Combustible</th><th class="num">Costo total</th><th class="num">Costo/milla</th><th class="num">Consumo prom.</th><th class="num">Cargas</th></tr></thead>
        <tbody>
          ${rows
            .map(
              (r) => `<tr>
              <td>${r.vehicle} <span style="color:var(--muted);">· ${r.plate}</span></td>
              <td class="num" style="font-weight:600;">${formatDistance(r.distanceKm)}</td>
              <td class="num">${formatNumber(r.fuelConsumed, 1)} gal</td>
              <td class="num">${formatCurrency(r.costTotal)}</td>
              <td class="num" style="font-weight:600;">${r.costPerKm != null ? formatCurrency(r.costPerKm) : "—"}</td>
              <td class="num">${r.avgConsumption != null ? `${formatNumber(r.avgConsumption, 1)} mi/gal` : "—"}</td>
              <td class="num">${r.chargeCount}</td>
            </tr>`
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}
