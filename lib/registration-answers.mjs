export function formatRegistrationAnswer(answer) {
  if (
    answer === null
    || answer === undefined
    || answer === ""
    || (Array.isArray(answer) && answer.length === 0)
  ) {
    return "No answer provided";
  }

  if (Array.isArray(answer)) {
    return answer.map(String).join(", ");
  }

  if (typeof answer === "object") {
    return JSON.stringify(answer);
  }

  return String(answer);
}

export function buildAnsweredFormRows(registration) {
  return [...(registration?.answers || [])]
    .sort((first, second) => (first.field?.position ?? 0) - (second.field?.position ?? 0))
    .map(({ answer, field }) => ({
      id: field.id,
      label: field.label,
      answer: formatRegistrationAnswer(answer),
    }));
}

export function buildEditableAnswerValues(registration) {
  return [...(registration?.answers || [])]
    .filter(({ field }) => field && field.system_key == null)
    .sort((first, second) => (first.field.position ?? 0) - (second.field.position ?? 0))
    .reduce((values, { answer, field }) => {
      values[field.id] = answer ?? null;
      return values;
    }, {});
}

export function buildRegistrationAnswerPayload(values) {
  const answers = Object.entries(values || {})
    .filter(([fieldId]) => Number.isInteger(Number(fieldId)) && Number(fieldId) > 0)
    .sort(([firstId], [secondId]) => Number(firstId) - Number(secondId))
    .map(([fieldId, answer]) => ({
      form_field_id: Number(fieldId),
      answer: answer ?? null,
    }));

  return { answers };
}
