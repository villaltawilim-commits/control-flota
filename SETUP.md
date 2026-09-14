# Control de Flota — estado del despliegue

✅ **Ya está publicado y funcionando:**

- App en vivo: **https://villaltawilim-commits.github.io/control-flota/**
- Repositorio: **https://github.com/villaltawilim-commits/control-flota**
- Proyecto Firebase: `vehiculos-kms` ([console](https://console.firebase.google.com/project/vehiculos-kms))
- Firestore, reglas de seguridad y Authentication (correo/contraseña): activos.
- Usuario administrador inicial: `villaltawilim@gmail.com` (contraseña entregada por chat — cámbiala desde
  Firebase Console → Authentication → usuario → "Restablecer contraseña" si quieres una nueva).

⚠️ **Pendiente — Storage (fotos de factura/bomba):**

Firebase Storage requiere el plan de pago "Blaze" (mantiene una capa gratuita amplia, pero pide una
tarjeta registrada). Mientras no se active, todo el resto de la app funciona con normalidad; solo
la carga de fotos en Combustible quedará pendiente. Para activarlo:

1. [console.firebase.google.com/project/vehiculos-kms/storage](https://console.firebase.google.com/project/vehiculos-kms/storage)
2. **Comenzar** → seguir el flujo para actualizar a plan Blaze.
3. Avisar para desplegar las reglas de Storage (`storage.rules`, ya listas en este repo) con:
   ```bash
   firebase deploy --only storage --project vehiculos-kms
   ```

## Cómo se hizo (referencia técnica)

Sitio 100% estático (HTML/CSS/JS, sin build, sin servidor propio). Backend: Firebase
(Authentication + Firestore + Storage). Publicado gratis en GitHub Pages — por eso funciona sin
que ninguna computadora esté encendida.

- `js/lib/firebase-config.js` — credenciales del proyecto `vehiculos-kms` (públicas por diseño;
  la seguridad real la aplican `firestore.rules` / `storage.rules`, no el código JS).
- `firestore.rules` — reglas de seguridad ya publicadas. Cualquier cambio: editar el archivo y
  correr `firebase deploy --only firestore:rules --project vehiculos-kms`.
- `bootstrap.html` / `firestore.rules.bootstrap` — quedan como referencia por si alguna vez hay
  que recrear el primer administrador manualmente desde el navegador (esta vez se creó por
  terminal, no se necesitaron).

## Uso diario

- El administrador crea el resto de usuarios desde dentro de la app: **Usuarios → Nuevo usuario**
  (no requiere volver a Firebase Console).
- Los permisos por módulo/acción se ajustan por usuario en **Usuarios → (seleccionar usuario)**.
- Para actualizar el sitio tras cambios de código: `git push` a `main` (GitHub Pages lo republica
  automáticamente en 1-2 minutos).
