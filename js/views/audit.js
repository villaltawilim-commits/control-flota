import * as data from "../lib/data.js";
import { formatDateTime } from "../lib/format.js";
import { pageHeaderHtml, emptyStateHtml } from "../lib/ui.js";

const ACTION_LABEL = { CREATE: "Creó", UPDATE: "Modificó", DELETE: "Eliminó" };
const ACTION_CLASS = { CREATE: "normal", UPDATE: "warning", DELETE: "urgent" };
const TABLE_LABEL = { Vehicle: "Vehículo", Route: "Ruta", FuelLog: "Combustible", Maintenance: "Mantenimiento", User: "Usuario" };

export async function renderAudit(container) {
  container.innerHTML = `<div class="center-page"><div class="spinner"></div></div>`;
  const [logs, users] = await Promise.all([data.getAuditLogs(), data.getUsers()]);
  const usersById = Object.fromEntries(users.map((u) => [u.id, u]));

  container.innerHTML = `
    <div class="page">
      ${pageHeaderHtml({ title: "Auditoría", subtitle: "Bitácora de cambios en el sistema" })}
      <div class="content">
        ${
          logs.length === 0
            ? emptyStateHtml({ title: "Sin actividad registrada" })
            : logs
                .map(
                  (log) => `
              <div class="audit-row">
                <span class="badge ${ACTION_CLASS[log.action] || "neutral"}">${ACTION_LABEL[log.action] || log.action}</span>
                <div class="text">
                  <p style="margin:0;"><strong>${usersById[log.userId]?.name || "—"}</strong> — ${TABLE_LABEL[log.tableName] || log.tableName}</p>
                  <p class="time">${formatDateTime(log.createdAt)}</p>
                </div>
              </div>`
                )
                .join("")
        }
      </div>
    </div>
  `;
}
