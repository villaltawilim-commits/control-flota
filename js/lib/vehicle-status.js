export function computeServiceStatus(currentMileage, lastServiceMileage, serviceIntervalKm) {
  const nextServiceMileage = lastServiceMileage + serviceIntervalKm;
  const remainingKm = nextServiceMileage - currentMileage;
  const traveledSinceService = currentMileage - lastServiceMileage;
  const progressPercent =
    serviceIntervalKm > 0
      ? Math.min(100, Math.max(0, Math.round((traveledSinceService / serviceIntervalKm) * 100)))
      : 0;

  let alertLevel = "normal";
  if (remainingKm <= 0) alertLevel = "urgent";
  else if (remainingKm <= 500) alertLevel = "warning";

  return { nextServiceMileage, remainingKm, progressPercent, alertLevel };
}

export const ALERT_LEVEL_LABEL = { normal: "Normal", warning: "Próximo servicio", urgent: "Servicio urgente" };
export const ALERT_LEVEL_ICON = { normal: "🟢", warning: "⚠️", urgent: "🚨" };
