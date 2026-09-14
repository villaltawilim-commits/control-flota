const routes = [];
let container = null;
let currentCleanup = null;

export function registerRoute(pattern, render) {
  const paramNames = [];
  const regex = new RegExp(
    "^" +
      pattern
        .split("/")
        .map((seg) => {
          if (seg.startsWith(":")) {
            paramNames.push(seg.slice(1));
            return "([^/]+)";
          }
          return seg.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        })
        .join("/") +
      "$"
  );
  routes.push({ regex, paramNames, render });
}

export function navigate(path) {
  if (location.hash.slice(1) === path) {
    handleRoute();
  } else {
    location.hash = path;
  }
}

function parseHash() {
  const raw = location.hash.slice(1) || "/dashboard";
  const [pathname, queryString] = raw.split("?");
  const query = Object.fromEntries(new URLSearchParams(queryString || ""));
  return { pathname: pathname || "/dashboard", query };
}

export function currentQuery() {
  return parseHash().query;
}

async function handleRoute() {
  if (!container) return;
  const { pathname, query } = parseHash();

  for (const route of routes) {
    const match = pathname.match(route.regex);
    if (match) {
      const params = {};
      route.paramNames.forEach((name, i) => (params[name] = decodeURIComponent(match[i + 1])));

      if (typeof currentCleanup === "function") {
        try {
          currentCleanup();
        } catch {
          /* ignore */
        }
      }
      currentCleanup = null;

      window.scrollTo(0, 0);
      const result = await route.render(container, params, query);
      if (typeof result === "function") currentCleanup = result;
      return;
    }
  }

  container.innerHTML = `<div class="empty-state"><p>Página no encontrada.</p></div>`;
}

export function startRouter(rootEl) {
  container = rootEl;
  window.addEventListener("hashchange", handleRoute);
  handleRoute();
}

export function rerender() {
  handleRoute();
}
