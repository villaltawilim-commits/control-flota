import { state } from "../lib/store.js";
import * as data from "../lib/data.js";
import { MODULES, ACTIONS, MODULE_LABELS, ACTION_LABELS, ROLES, ROLE_LABELS } from "../lib/permissions.js";
import { pageHeaderHtml, emptyStateHtml, toast } from "../lib/ui.js";
import { icon } from "../lib/icons.js";
import { navigate } from "../lib/router.js";

export async function renderUserList(container) {
  container.innerHTML = `<div class="center-page"><div class="spinner"></div></div>`;
  const users = await data.getUsers();

  container.innerHTML = `
    <div class="page">
      ${pageHeaderHtml({
        title: "Usuarios",
        subtitle: `${users.length} en el sistema`,
        actionHtml: `<a href="#/users/new" class="fab">${icon("plus", 20)}</a>`,
      })}
      <div class="content">
        ${users
          .map(
            (u) => `
          <a href="#/users/${u.id}" class="item-card ${u.active ? "" : "inactive"}">
            <div class="item-row">
              <div style="min-width:0;">
                <p class="title">${u.name}</p>
                <p class="sub">${u.email}</p>
              </div>
              <div style="display:flex;align-items:center;gap:8px;flex-shrink:0;">
                ${!u.active ? `<span class="badge neutral">Inactivo</span>` : ""}
                <span class="badge role">${ROLE_LABELS[u.role] || u.role}</span>
              </div>
            </div>
          </a>`
          )
          .join("")}
      </div>
    </div>
  `;
}

function userFormFields(u = {}, isCreate) {
  return `
    <div class="field"><label>Nombre completo</label><input name="name" value="${u.name || ""}" required></div>
    <div class="field"><label>Correo electrónico</label><input name="email" type="email" value="${u.email || ""}" required></div>
    <div class="field">
      <label>${isCreate ? "Contraseña" : "Nueva contraseña"}</label>
      <input name="password" type="password" placeholder="${isCreate ? "Mínimo 6 caracteres" : "Dejar en blanco para no cambiar"}" ${isCreate ? "required" : ""}>
    </div>
    <div class="field">
      <label>Rol</label>
      <select name="role" required>
        ${ROLES.map((r) => `<option value="${r}" ${u.role === r ? "selected" : ""}>${ROLE_LABELS[r]}</option>`).join("")}
      </select>
    </div>
    <label class="checkbox-row"><input type="checkbox" name="active" ${u.active !== false ? "checked" : ""}> Usuario activo</label>
  `;
}

export async function renderUserNew(container) {
  container.innerHTML = `
    <div class="page">
      ${pageHeaderHtml({ title: "Nuevo usuario", backHref: "/users" })}
      <form class="form" id="user-form">
        <div id="form-error"></div>
        ${userFormFields({}, true)}
        <button type="submit" class="btn btn-primary btn-full">Guardar usuario</button>
      </form>
    </div>
  `;

  document.getElementById("user-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const errorBox = document.getElementById("form-error");
    errorBox.innerHTML = "";
    const fd = new FormData(e.target);
    const payload = {
      name: fd.get("name").trim(),
      email: fd.get("email").trim(),
      password: fd.get("password"),
      role: fd.get("role"),
      active: fd.get("active") === "on",
    };
    const btn = e.target.querySelector("button[type=submit]");
    btn.disabled = true;
    btn.textContent = "Guardando...";
    try {
      const uid = await data.createUser(payload, state.user);
      navigate(`/users/${uid}`);
    } catch (err) {
      errorBox.innerHTML = `<p class="banner-error">${err.message}</p>`;
      btn.disabled = false;
      btn.textContent = "Guardar usuario";
    }
  });
}

export async function renderUserDetail(container, params) {
  container.innerHTML = `<div class="center-page"><div class="spinner"></div></div>`;
  const user = await data.getUser(params.id);
  if (!user) {
    container.innerHTML = emptyStateHtml({ title: "Usuario no encontrado" });
    return;
  }

  container.innerHTML = `
    <div class="page">
      ${pageHeaderHtml({ title: user.name, subtitle: user.email, backHref: "/users" })}
      <form class="form" id="user-form">
        <div id="form-error"></div>
        ${userFormFields(user, false)}
        <button type="submit" class="btn btn-primary btn-full">Guardar usuario</button>
      </form>
      <div class="content" style="padding-top:0;">
        <form class="card" id="perm-form">
          <p style="font-weight:600;margin:0 0 4px;">Permisos por módulo</p>
          <p style="font-size:12px;color:var(--muted);margin:0 0 12px;">Estos permisos parten del rol (${user.role}) y pueden ajustarse individualmente.</p>
          <div class="table-wrap" style="border:none;">
            <table class="perm-table">
              <thead><tr><th>Módulo</th>${ACTIONS.map((a) => `<th>${ACTION_LABELS[a]}</th>`).join("")}</tr></thead>
              <tbody>
                ${MODULES.map(
                  (mod) => `<tr>
                    <td>${MODULE_LABELS[mod]}</td>
                    ${ACTIONS.map((a) => {
                      const disabled = mod === "audit" && a !== "view";
                      const checked = user.permissions?.[`${mod}.${a}`];
                      return `<td>${disabled ? "—" : `<input type="checkbox" name="perm_${mod}_${a}" ${checked ? "checked" : ""}>`}</td>`;
                    }).join("")}
                  </tr>`
                ).join("")}
              </tbody>
            </table>
          </div>
          <button type="submit" class="btn btn-primary btn-full" style="margin-top:16px;">Guardar permisos</button>
        </form>
      </div>
    </div>
  `;

  document.getElementById("user-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const errorBox = document.getElementById("form-error");
    errorBox.innerHTML = "";
    const fd = new FormData(e.target);
    const payload = {
      name: fd.get("name").trim(),
      email: fd.get("email").trim(),
      role: fd.get("role"),
      active: fd.get("active") === "on",
    };
    if (fd.get("password")) payload.password = fd.get("password");
    const btn = e.target.querySelector("button[type=submit]");
    btn.disabled = true;
    btn.textContent = "Guardando...";
    try {
      await data.updateUser(user.id, payload, state.user);
      navigate(`/users/${user.id}`);
    } catch (err) {
      errorBox.innerHTML = `<p class="banner-error">${err.message}</p>`;
      btn.disabled = false;
      btn.textContent = "Guardar usuario";
    }
  });

  document.getElementById("perm-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const flat = {};
    for (const mod of MODULES) {
      for (const a of ACTIONS) {
        flat[`${mod}.${a}`] = mod === "audit" && a !== "view" ? false : fd.get(`perm_${mod}_${a}`) === "on";
      }
    }
    try {
      await data.updateUserPermissions(user.id, flat, state.user);
      toast("Permisos actualizados.", "success");
    } catch (err) {
      toast(err.message);
    }
  });
}
