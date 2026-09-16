// Predefined destination list for Petén: los 14 municipios, en orden
// alfabético, con Flores y San Benito fusionados en "Área Central" (son la
// misma zona urbana contigua junto al lago). "Otros" habilita texto libre.
export const OTHER_DESTINATION_VALUE = "__otros__";

export const PETEN_DESTINATIONS = [
  "Área Central",
  "Dolores",
  "El Chal",
  "La Libertad",
  "Las Cruces",
  "Melchor de Mencos",
  "Poptún",
  "San Andrés",
  "San Francisco",
  "San José",
  "San Luis",
  "Santa Ana",
  "Sayaxché",
];

export function destinationSelectHtml({ id, name, selectedValue = "" } = {}) {
  const idAttr = id ? ` id="${id}"` : "";
  const isKnown = PETEN_DESTINATIONS.includes(selectedValue);
  const isOther = selectedValue && !isKnown;
  return `
    <select${idAttr} name="${name}" data-destination-select required>
      <option value="" disabled ${!selectedValue ? "selected" : ""}>Selecciona un destino</option>
      ${PETEN_DESTINATIONS.map(
        (d) => `<option value="${d}" ${d === selectedValue ? "selected" : ""}>${d}</option>`
      ).join("")}
      <option value="${OTHER_DESTINATION_VALUE}" ${isOther ? "selected" : ""}>Otros (especificar)</option>
    </select>
    <input
      type="text"
      name="${name}Other"
      data-destination-other
      placeholder="Escribe el destino"
      class="field"
      style="margin-top:8px;height:48px;width:100%;border-radius:12px;border:1px solid var(--border);padding:0 14px;"
      ${isOther ? `value="${selectedValue}"` : ""}
      ${isOther ? "" : "hidden"}
    >
  `;
}

// Wires the show/hide + resolves the final free-text value on submit.
export function wireDestinationSelect(root, selectName) {
  const select = root.querySelector(`select[name="${selectName}"]`);
  const other = root.querySelector(`input[name="${selectName}Other"]`);
  select.addEventListener("change", () => {
    const isOther = select.value === OTHER_DESTINATION_VALUE;
    other.hidden = !isOther;
    other.required = isOther;
    if (isOther) other.focus();
  });
}

export function resolveDestinationValue(formData, selectName) {
  const selected = formData.get(selectName);
  if (selected === OTHER_DESTINATION_VALUE) {
    return (formData.get(`${selectName}Other`) || "").trim();
  }
  return selected;
}
