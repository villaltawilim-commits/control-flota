import { registerRoute, navigate } from "./lib/router.js";
import { state } from "./lib/store.js";
import { can } from "./lib/permissions.js";
import { NAV_ITEMS } from "./lib/nav-items.js";
import { icon } from "./lib/icons.js";

import { renderDashboard } from "./views/dashboard.js";
import { renderVehicleList, renderVehicleForm, renderVehicleDetail } from "./views/vehicles.js";
import { renderRouteList, renderRouteNew, renderRouteDetail, renderRouteEdit } from "./views/routes-view.js";
import { renderFuelList, renderFuelNew, renderFuelDetail } from "./views/fuel.js";
import { renderMaintenanceList, renderMaintenanceNew } from "./views/maintenance.js";
import { renderReports } from "./views/reports-view.js";
import { renderUserList, renderUserNew, renderUserDetail } from "./views/users.js";
import { renderAudit } from "./views/audit.js";

export function guard(mod, action, renderFn) {
  return (container, params, query) => {
    if (!can(state.profile, mod, action)) {
      renderForbidden(container);
      return;
    }
    return renderFn(container, params, query);
  };
}

export function renderForbidden(container) {
  container.innerHTML = `
    <div class="center-page">
      <div style="text-align:center;max-width:360px;padding:24px;">
        <div style="width:56px;height:56px;border-radius:999px;background:var(--danger-bg);color:var(--danger);display:flex;align-items:center;justify-content:center;font-size:24px;margin:0 auto 16px;">🚫</div>
        <h1 style="font-size:18px;font-weight:700;margin:0 0 4px;">No tienes permiso para esto</h1>
        <p style="color:var(--muted);font-size:14px;margin:0 0 20px;">Tu rol no tiene acceso a esta sección. Si crees que es un error, contacta a un administrador.</p>
        <a href="#/dashboard" class="btn btn-primary">Volver al inicio</a>
      </div>
    </div>
  `;
}

function renderMore(container) {
  const items = NAV_ITEMS.filter(
    (i) => !i.primary && i.module !== "dashboard" && can(state.profile, i.module, "view")
  );
  container.innerHTML = `
    <div class="page" style="padding:16px;">
      <div class="card" style="margin-bottom:16px;">
        <p style="font-weight:600;">${state.profile.name}</p>
        <p style="color:var(--muted);font-size:14px;">${state.profile.role}</p>
      </div>
      <div style="border-radius:16px;border:1px solid var(--border);background:var(--surface);overflow:hidden;">
        ${items
          .map(
            (i) => `<a href="#${i.path}" style="display:flex;align-items:center;gap:12px;padding:14px 16px;border-bottom:1px solid var(--border);">
              <span style="font-size:18px;">${i.icon}</span><span style="font-weight:500;flex:1;">${i.label}</span>${icon("chevronRight", 18)}
            </a>`
          )
          .join("")}
      </div>
      <button id="more-logout" class="btn btn-danger-outline btn-full" style="margin-top:16px;">Cerrar sesión</button>
    </div>
  `;
  container.querySelector("#more-logout").addEventListener("click", async () => {
    const { auth, signOut } = await import("./lib/firebase.js");
    await signOut(auth);
  });
}

export function registerAllRoutes() {
  registerRoute("/dashboard", renderDashboard);

  registerRoute("/vehicles", guard("vehicles", "view", renderVehicleList));
  registerRoute("/vehicles/new", guard("vehicles", "create", renderVehicleForm));
  registerRoute("/vehicles/:id/edit", guard("vehicles", "update", renderVehicleForm));
  registerRoute("/vehicles/:id", guard("vehicles", "view", renderVehicleDetail));

  registerRoute("/routes", guard("routes", "view", renderRouteList));
  registerRoute("/routes/new", guard("routes", "create", renderRouteNew));
  registerRoute("/routes/:id/edit", guard("routes", "update", renderRouteEdit));
  registerRoute("/routes/:id", guard("routes", "view", renderRouteDetail));

  registerRoute("/fuel", guard("fuel", "view", renderFuelList));
  registerRoute("/fuel/new", guard("fuel", "create", renderFuelNew));
  registerRoute("/fuel/:id", guard("fuel", "view", renderFuelDetail));

  registerRoute("/maintenance", guard("maintenance", "view", renderMaintenanceList));
  registerRoute("/maintenance/new", guard("maintenance", "create", renderMaintenanceNew));

  registerRoute("/reports", guard("reports", "view", renderReports));

  registerRoute("/users", guard("users", "view", renderUserList));
  registerRoute("/users/new", guard("users", "create", renderUserNew));
  registerRoute("/users/:id", guard("users", "update", renderUserDetail));

  registerRoute("/audit", guard("audit", "view", renderAudit));

  registerRoute("/more", renderMore);
}
