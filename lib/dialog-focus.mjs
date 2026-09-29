export function restoreDialogFocus(event, opener, fallback) {
  const target = [opener, fallback].find((element) => element?.isConnected && !element.disabled);
  if (!target) return;

  event.preventDefault();
  target.focus();
}
