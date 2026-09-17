// Plain type="number" inputs reject a comma decimal separator outright, and
// on many Spanish-locale phone keyboards "," is the only decimal key shown —
// so typing "10,5" silently produces nothing. These fields use type="text"
// inputmode="decimal" instead (still opens a numeric keypad) and normalize
// "," to "." live as the user types, so Number(field.value) always works.
export const decimalInputAttrs = 'type="text" inputmode="decimal" autocomplete="off"';

export function wireDecimalInputs(root) {
  root.querySelectorAll("[data-decimal]").forEach((input) => {
    input.addEventListener("input", () => {
      const normalized = input.value.replace(",", ".").replace(/[^0-9.]/g, "");
      const firstDot = normalized.indexOf(".");
      input.value =
        firstDot === -1 ? normalized : normalized.slice(0, firstDot + 1) + normalized.slice(firstDot + 1).replace(/\./g, "");
    });
  });
}

export function parseDecimal(value) {
  if (value == null || value === "") return NaN;
  return Number(String(value).replace(",", "."));
}
