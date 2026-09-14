export const ROLES = ["ADMIN", "EDITOR", "REGISTRAR"];

export const MODULES = ["users", "vehicles", "routes", "fuel", "maintenance", "reports", "audit"];

export const ACTIONS = ["view", "create", "update", "delete"];

export const ROLE_LABELS = {
  ADMIN: "Administrador",
  EDITOR: "Usuario con permisos de edición",
  REGISTRAR: "Usuario de registro",
};

export const MODULE_LABELS = {
  users: "Usuarios",
  vehicles: "Vehículos",
  routes: "Rutas",
  fuel: "Combustible",
  maintenance: "Mantenimiento",
  reports: "Reportes",
  audit: "Auditoría",
};

export const ACTION_LABELS = {
  view: "Ver",
  create: "Crear",
  update: "Modificar",
  delete: "Eliminar",
};

function matrix(defaults) {
  const m = {};
  for (const mod of MODULES) {
    m[mod] = {
      view: defaults[mod]?.view ?? false,
      create: defaults[mod]?.create ?? false,
      update: defaults[mod]?.update ?? false,
      delete: defaults[mod]?.delete ?? false,
    };
  }
  return m;
}

export const DEFAULT_PERMISSIONS = {
  ADMIN: matrix({
    users: { view: true, create: true, update: true, delete: true },
    vehicles: { view: true, create: true, update: true, delete: true },
    routes: { view: true, create: true, update: true, delete: true },
    fuel: { view: true, create: true, update: true, delete: true },
    maintenance: { view: true, create: true, update: true, delete: true },
    reports: { view: true, create: true, update: true, delete: true },
    audit: { view: true, create: false, update: false, delete: false },
  }),
  EDITOR: matrix({
    users: { view: false, create: false, update: false, delete: false },
    vehicles: { view: true, create: false, update: true, delete: false },
    routes: { view: true, create: true, update: true, delete: false },
    fuel: { view: true, create: true, update: true, delete: false },
    maintenance: { view: true, create: true, update: true, delete: false },
    reports: { view: true, create: false, update: false, delete: false },
    audit: { view: false, create: false, update: false, delete: false },
  }),
  REGISTRAR: matrix({
    users: { view: false, create: false, update: false, delete: false },
    vehicles: { view: true, create: false, update: false, delete: false },
    routes: { view: true, create: true, update: false, delete: false },
    fuel: { view: true, create: true, update: false, delete: false },
    maintenance: { view: true, create: false, update: false, delete: false },
    reports: { view: true, create: false, update: false, delete: false },
    audit: { view: false, create: false, update: false, delete: false },
  }),
};

/**
 * Flattens a role + per-user overrides into a complete "module.action": boolean
 * map. This flat map is what gets stored on users/{uid}.permissions in Firestore,
 * so security rules can do a simple field lookup instead of re-deriving role
 * defaults inside the rules language.
 */
export function computeFlatPermissions(role, overrides = {}) {
  const base = DEFAULT_PERMISSIONS[role] || DEFAULT_PERMISSIONS.REGISTRAR;
  const flat = {};
  for (const mod of MODULES) {
    for (const action of ACTIONS) {
      const key = `${mod}.${action}`;
      flat[key] = key in overrides ? !!overrides[key] : base[mod][action];
    }
  }
  return flat;
}

export function can(profile, mod, action) {
  if (!profile || !profile.active) return false;
  return !!profile.permissions?.[`${mod}.${action}`];
}
