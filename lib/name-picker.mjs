export function createNamePickerModel(entries = [], selectedEntry = null) {
  return {
    count: entries.length,
    initialName: selectedEntry?.name || entries[0]?.name || "Add names in Settings",
  };
}
