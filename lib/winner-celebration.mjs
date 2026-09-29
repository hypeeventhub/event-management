export function getWinnerCelebrationState(status, selectedEntry, confirmedWinner) {
  if (["pending", "confirming", "cancelling"].includes(status) && selectedEntry) {
    return { open: true, mode: "decision", name: selectedEntry.name, dismissible: false };
  }
  if (status === "confirmed" && confirmedWinner) {
    return { open: true, mode: "confirmed", name: confirmedWinner.name, dismissible: true };
  }
  return { open: false, mode: null, name: "", dismissible: true };
}

const colors = ["#f7dd4c", "#ffffff", "#f9a8d4", "#93c5fd", "#86efac", "#fdba74"];

export function createConfettiPieces(count = 48) {
  return Array.from({ length: Math.min(80, Math.max(0, count)) }, (_, index) => ({
    id: index,
    left: (index * 37) % 100,
    delay: (index * 47) % 900,
    duration: 2200 + ((index * 83) % 1300),
    color: colors[index % colors.length],
    rotation: (index * 67) % 360,
  }));
}
