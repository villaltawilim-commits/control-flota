# Configuración inicial — Control de Flota

Sitio 100% estático (HTML/CSS/JS, sin build, sin servidor propio) que usa **Firebase**
(Authentication + Firestore + Storage) como backend y se publica gratis en **GitHub Pages**.
Por eso funciona sin que ninguna computadora esté encendida.

## 1. Crear el proyecto de Firebase

1. Ve a [console.firebase.google.com](https://console.firebase.google.com) → **Agregar proyecto**.
2. **Compilación → Authentication → Comenzar → Correo electrónico/contraseña** → habilítalo.
3. **Compilación → Firestore Database → Crear base de datos** → modo producción, la región que prefieras.
4. **Compilación → Storage → Comenzar** (plan gratuito Spark alcanza para empezar; si sube mucho volumen de fotos, hay que pasar al plan Blaze de pago por uso).
5. ⚙️ **Configuración del proyecto → Tus apps →** ícono `</>` (Web) → nómbrala → copia el objeto `firebaseConfig`.
6. Pega ese objeto en [`js/lib/firebase-config.js`](js/lib/firebase-config.js), reemplazando los valores `REEMPLAZAR_...`.

## 2. Reglas de seguridad (paso temporal + paso final)

**Firestore Database → Reglas**: pega primero el contenido de
[`firestore.rules.bootstrap`](firestore.rules.bootstrap) y publica. Son reglas temporales
que solo permiten crear tu propio perfil.

**Storage → Reglas**: pega el contenido de [`storage.rules`](storage.rules) y publica (estas
ya son las definitivas).

## 3. Crear el primer administrador

1. Sirve la carpeta localmente (`npx serve .` o la extensión "Live Server" de VS Code) o publícala
   ya en GitHub Pages (ver paso 5) y abre `bootstrap.html`.
2. Llena tu nombre, correo y contraseña → **Crear administrador**.
3. Cuando veas "✅ Administrador creado correctamente", vuelve a **Firestore Database → Reglas**
   y reemplaza las reglas temporales por el contenido definitivo de [`firestore.rules`](firestore.rules).
   Publica.
4. Borra (o simplemente no enlaces) `bootstrap.html` — ya no se necesita. Cualquier usuario nuevo
   a partir de ahora se crea desde dentro de la app, en **Usuarios → Nuevo usuario** (solo admins).

## 4. Publicar en GitHub Pages

Desde esta carpeta:

```bash
gh repo create control-flota --public --source=. --push
gh repo edit --enable-pages -b main -p /   # o actívalo manualmente en Settings → Pages
```

Si prefieres hacerlo a mano: crea el repositorio en GitHub, sube estos archivos, y en
**Settings → Pages** selecciona la rama `main` y carpeta `/ (root)`.

Tu app quedará en `https://<tu-usuario>.github.io/control-flota/`.

## 5. Uso diario

- Administrador inicial: el correo/contraseña que usaste en `bootstrap.html`.
- El administrador crea el resto de usuarios desde **Usuarios → Nuevo usuario** (no requiere
  volver a Firebase Console).
- Los permisos por módulo/acción se ajustan por usuario en **Usuarios → (seleccionar usuario)**.

## Notas técnicas

- No hay servidor: toda la lógica corre en el navegador y la seguridad real la aplican las
  **reglas de Firestore/Storage** (`firestore.rules` / `storage.rules`), no el código JavaScript
  (que solo mejora la experiencia — un usuario sin permiso que intente escribir directo contra
  la API de Firebase será rechazado por las reglas).
- Las fotos de facturas/bombas se guardan en Firebase Storage bajo `photos/{idDeCombustible}/`.
- Plan gratuito de Firebase (Spark): suficiente para uso moderado; si la empresa crece mucho en
  volumen de datos/fotos, hay que activar el plan Blaze (pago por uso, con capa gratuita generosa).
