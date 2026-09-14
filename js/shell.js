import { auth, signOut } from "./lib/firebase.js";
import { NAV_ITEMS } from "./lib/nav-items.js";
import { can, ROLE_LABELS } from "./lib/permissions.js";
import { icon } from "./lib/icons.js";
import { startRouter } from "./lib/router.js";
import { registerAllRoutes } from "./routes.js";

export function renderShell(root, profile) {
  const visible = NAV_ITEMS.filter((item) => item.module === "dashboard" || can(profile, item.module, "view"));
  const primary = visible.filter((i) => i.primary);
  const more = visible.filter((i) => !i.primary);

  root.innerHTML = `
    <div id="app-shell">
      <aside class="sidebar">
        <div class="brand"><div class="mark">🚚</div><span>Control de Flota</span></div>
        <nav><ul>
          ${visible.map((i) => `<li><a href="#${i.path}" data-path="${i.path}">${i.icon} ${i.label}</a></li>`).join("")}
        </ul></nav>
        <div class="user-box">
          <p class="name">${escapeHtml(profile.name)}</p>
          <p class="role">${ROLE_LABELS[profile.role] || profile.role}</p>
          <button id="logout-btn-desktop">${icon("logout", 16)} Cerrar sesión</button>
        </div>
      </aside>
      <div class="main-col">
        <header class="topbar safe-top">
          <div class="brand"><div class="mark">🚚</div><span>Control de Flota</span></div>
          <button id="logout-btn-mobile" aria-label="Cerrar sesión">${icon("logout", 18)}</button>
        </header>
        <main id="view"></main>
        <nav class="bottom-nav safe-bottom" style="grid-template-columns: repeat(${primary.length + (more.length ? 1 : 0)}, 1fr);">
          ${primary.map((i) => `<a href="#${i.path}" data-path="${i.path}">${i.icon}<span>${i.label}</span></a>`).join("")}
          ${more.length ? `<a href="#/more" data-path="/more">${icon("more", 22)}<span>Más</span></a>` : ""}
        </nav>
      </div>
    </div>
  `;

  document.getElementById("logout-btn-desktop").addEventListener("click", () => signOut(auth));
  document.getElementById("logout-btn-mobile").addEventListener("click", () => signOut(auth));

  function updateActive() {
    const current = "/" + (location.hash.slice(2).split("?")[0].split("/")[0] || "dashboard");
    document.querySelectorAll(".sidebar nav a, .bottom-nav a").forEach((a) => {
      a.classList.toggle("active", a.dataset.path === current);
    });
  }
  window.addEventListener("hashchange", updateActive);
  updateActive();

  registerAllRoutes();
  startRouter(document.getElementById("view"));
}

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[c]));
}
