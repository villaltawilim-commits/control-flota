import { icon } from "./icons.js";
import { compressImage } from "./image-compress.js";

export function photoCaptureHtml(name, label, required) {
  return `
    <div class="field photo-capture" data-photo="${name}">
      <span>${label} ${required ? '<span style="color:var(--danger);">*</span>' : ""}</span>
      <input type="file" name="${name}" accept="image/*" capture="environment" hidden>
      <div class="drop" data-role="trigger">${icon("camera", 26)}<span>📷 Tomar foto</span></div>
      <button type="button" class="remove-btn" hidden>Quitar foto</button>
    </div>
  `;
}

export function wirePhotoCapture(root, name) {
  const wrap = root.querySelector(`[data-photo="${name}"]`);
  const input = wrap.querySelector("input[type=file]");
  const drop = wrap.querySelector('[data-role="trigger"]');
  const removeBtn = wrap.querySelector(".remove-btn");

  drop.addEventListener("click", () => input.click());
  input.addEventListener("change", async () => {
    const file = input.files[0];
    if (!file) return;

    drop.classList.remove("filled");
    drop.innerHTML = `${icon("camera", 26)}<span>Comprimiendo…</span>`;

    const compressed = await compressImage(file);
    if (compressed !== file) {
      const dt = new DataTransfer();
      dt.items.add(compressed);
      input.files = dt.files;
    }

    const url = URL.createObjectURL(compressed);
    drop.classList.add("filled");
    drop.innerHTML = `<img src="${url}" alt="${name}">`;
    removeBtn.hidden = false;
  });
  removeBtn.addEventListener("click", () => {
    input.value = "";
    drop.classList.remove("filled");
    drop.innerHTML = `${icon("camera", 26)}<span>📷 Tomar foto</span>`;
    removeBtn.hidden = true;
  });
}
