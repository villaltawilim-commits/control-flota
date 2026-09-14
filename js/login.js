import { auth, signInWithEmailAndPassword } from "./lib/firebase.js";

const AUTH_ERROR_MAP = {
  "auth/invalid-email": "Correo inválido.",
  "auth/invalid-credential": "Credenciales incorrectas.",
  "auth/wrong-password": "Credenciales incorrectas.",
  "auth/user-not-found": "Credenciales incorrectas.",
  "auth/user-disabled": "Este usuario está deshabilitado.",
  "auth/too-many-requests": "Demasiados intentos. Intenta más tarde.",
};

export function renderLogin(root) {
  root.innerHTML = `
    <main class="login-screen safe-top safe-bottom">
      <div class="login-card">
        <div class="login-logo">
          <div class="mark">🚚</div>
          <h1>Control de Flota</h1>
          <p>Combustible, millaje, rutas y mantenimiento</p>
        </div>
        <div class="login-box">
          <form id="login-form" style="display:flex;flex-direction:column;gap:16px;">
            <div class="field">
              <label for="login-email">Correo electrónico</label>
              <input id="login-email" name="email" type="email" autocomplete="username" placeholder="tucorreo@empresa.com" required>
            </div>
            <div class="field">
              <label for="login-password">Contraseña</label>
              <input id="login-password" name="password" type="password" autocomplete="current-password" placeholder="••••••••" required>
            </div>
            <div id="login-error"></div>
            <button type="submit" class="btn btn-primary btn-full">Ingresar</button>
          </form>
        </div>
      </div>
    </main>
  `;

  const form = document.getElementById("login-form");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const errorBox = document.getElementById("login-error");
    errorBox.innerHTML = "";
    const fd = new FormData(form);
    const btn = form.querySelector("button[type=submit]");
    btn.disabled = true;
    btn.textContent = "Ingresando...";
    try {
      await signInWithEmailAndPassword(auth, fd.get("email"), fd.get("password"));
      // onAuthStateChanged in store.js takes over from here.
    } catch (err) {
      errorBox.innerHTML = `<p class="banner-error">${AUTH_ERROR_MAP[err.code] || "No se pudo iniciar sesión."}</p>`;
      btn.disabled = false;
      btn.textContent = "Ingresar";
    }
  });
}
