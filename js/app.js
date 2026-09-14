import { subscribe } from "./lib/store.js";
import { auth, signOut } from "./lib/firebase.js";
import { renderLogin } from "./login.js";
import { renderShell } from "./shell.js";

const root = document.getElementById("root");
let shellMounted = false;

function renderBlocked(message) {
  root.innerHTML = `
    <div class="login-screen safe-top safe-bottom">
      <div class="login-card" style="text-align:center;">
        <div class="login-logo"><div class="mark">🚚</div><h1>Control de Flota</h1></div>
        <div class="login-box">
          <p style="margin:0 0 16px;color:var(--muted);">${message}</p>
          <button id="blocked-logout" class="btn btn-secondary btn-full">Cerrar sesión</button>
        </div>
      </div>
    </div>
  `;
  document.getElementById("blocked-logout").addEventListener("click", () => signOut(auth));
}

subscribe((s) => {
  if (!s.ready) return;

  if (!s.user) {
    shellMounted = false;
    renderLogin(root);
    return;
  }

  if (!s.profile) {
    shellMounted = false;
    renderBlocked("Tu cuenta no tiene un perfil configurado en el sistema. Contacta a un administrador para que te asigne un rol.");
    return;
  }

  if (!s.profile.active) {
    shellMounted = false;
    renderBlocked("Tu usuario está desactivado. Contacta a un administrador.");
    return;
  }

  if (!shellMounted) {
    shellMounted = true;
    renderShell(root, s.profile);
  }
});
