/** Tabs and copy button. Kept tiny and dependency free so the report works offline. */
export const CLIENT_SCRIPT = `
const tabs = document.querySelectorAll(".tab");
function show(variant) {
  tabs.forEach((tab) => tab.setAttribute("aria-selected", String(tab.dataset.v === variant)));
  document.querySelectorAll("[data-panel]").forEach((panel) => { panel.hidden = panel.dataset.panel !== variant; });
}
tabs.forEach((tab) => tab.addEventListener("click", () => show(tab.dataset.v)));
document.querySelectorAll(".copy").forEach((button) => button.addEventListener("click", async () => {
  const snippet = button.previousElementSibling;
  try {
    await navigator.clipboard.writeText(snippet.textContent);
    button.textContent = "Copied";
  } catch {
    const range = document.createRange();
    range.selectNodeContents(snippet);
    getSelection().removeAllRanges();
    getSelection().addRange(range);
    button.textContent = "Press Ctrl+C";
  }
  setTimeout(() => { button.textContent = "Copy"; }, 1600);
}));
`;
