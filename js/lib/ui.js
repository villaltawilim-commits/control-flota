import { icon } from "./icons.js";

export function pageHeaderHtml({ title, subtitle, backHref, actionHtml = "" }) {
  return `
    <div class="page-header">
      ${backHref ? `<a href="#${backHref}" class="back-btn">${icon("back", 18)}</a>` : ""}
      <div class="titles">
        <h1>${title}</h1>
        ${subtitle ? `<p>${subtitle}</p>` : ""}
      </div>
      ${actionHtml}
    </div>
  `;
}

export function emptyStateHtml({ icon: emoji = "", title, desc = "", actionHref = "", actionLabel = "" }) {
  return `
    <div class="empty-state">
      ${emoji ? `<div class="icon">${emoji}</div>` : ""}
      <p class="title">${title}</p>
      ${desc ? `<p class="desc">${desc}</p>` : ""}
      ${actionHref && actionLabel ? `<a href="#${actionHref}" class="btn btn-primary">${actionLabel}</a>` : ""}
    </div>
  `;
}

export function toast(message, type = "error") {
  let root = document.getElementById("toast-root");
  if (!root) {
    root = document.createElement("div");
    root.id = "toast-root";
    document.body.appendChild(root);
  }
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.textContent = message;
  root.appendChild(el);
  setTimeout(() => el.remove(), 4000);
}

export function confirmAction(message) {
  return window.confirm(message);
}

export function setButtonLoading(btn, loading, loadingText) {
  if (!btn) return;
  if (loading) {
    btn.dataset.originalText = btn.dataset.originalText || btn.textContent;
    btn.disabled = true;
    if (loadingText) btn.textContent = loadingText;
  } else {
    btn.disabled = false;
    if (btn.dataset.originalText) btn.textContent = btn.dataset.originalText;
  }
}

export function qs(root, selector) {
  return root.querySelector(selector);
}

export function qsa(root, selector) {
  return Array.from(root.querySelectorAll(selector));
}

export function on(root, selector, event, handler) {
  root.addEventListener(event, (e) => {
    const target = e.target.closest(selector);
    if (target && root.contains(target)) handler(e, target);
  });
}
