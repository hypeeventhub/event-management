export function shouldReconcileRaffleError(error) {
  return [404, 409].includes(error?.response?.status);
}
