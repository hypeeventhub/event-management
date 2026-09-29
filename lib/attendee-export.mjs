const identitySystemKeys = new Set(["first_name", "last_name", "email"]);

function formatAnswer(answer) {
  if (answer === null || answer === undefined) return "";
  if (Array.isArray(answer)) return answer.join(", ");
  if (typeof answer === "object") return JSON.stringify(answer);

  return String(answer);
}

function formatCsvValue(value) {
  const stringValue = value === null || value === undefined ? "" : String(value);
  const safeValue = /^[=+\-@]/.test(stringValue) ? `'${stringValue}` : stringValue;

  return /[",\r\n]/.test(safeValue)
    ? `"${safeValue.replaceAll('"', '""')}"`
    : safeValue;
}

export function buildAllRegistrantsCsv(exportData) {
  const allRegistrants = exportData.sheets.find((sheet) => sheet.name === "All Registrants");
  const rows = allRegistrants?.rows || [];
  const header = exportData.columns.map((column) => formatCsvValue(column.header)).join(",");
  const values = rows.map((row) => exportData.columns.map((column) => formatCsvValue(row[column.key])).join(","));

  return [header, ...values].join("\r\n");
}

export function buildAttendeeExportData(registrations, currentFormFields = []) {
  const questionColumns = new Map();

  function setQuestionColumn(field) {
    if (identitySystemKeys.has(field.system_key)) return;

    const fieldKey = field.key || String(field.id);
    questionColumns.set(fieldKey, {
      header: field.label,
      key: `answer_${fieldKey}`,
      position: field.position,
      fieldKey,
    });
  }

  registrations.forEach((registration) => {
    registration.answers.forEach(({ field }) => {
      if (identitySystemKeys.has(field.system_key)) return;

      const fieldKey = field.key || String(field.id);
      const existing = questionColumns.get(fieldKey);

      if (!existing || field.position < existing.position) {
        setQuestionColumn(field);
      }
    });
  });

  currentFormFields.forEach(setQuestionColumn);

  const answerColumns = [...questionColumns.values()].sort((left, right) => left.position - right.position);
  const columns = [
    { header: "Name", key: "name" },
    { header: "Email", key: "email" },
    ...answerColumns,
    { header: "Status", key: "status" },
    { header: "Check-in", key: "check_in" },
    { header: "Date registered", key: "registered_at" },
  ];

  const rows = registrations.map((registration) => {
    const attended = registration.check_ins.some((checkIn) => checkIn.result === "accepted");
    const row = {
      name: `${registration.attendee.first_name} ${registration.attendee.last_name}`.trim(),
      email: registration.attendee.email,
      status: registration.status,
      check_in: attended ? "Attended" : "Not attended",
      registered_at: registration.registered_at,
      attended,
    };

    registration.answers.forEach(({ answer, field }) => {
      if (identitySystemKeys.has(field.system_key)) return;
      row[`answer_${field.key || field.id}`] = formatAnswer(answer);
    });

    return row;
  });

  return {
    columns,
    sheets: [
      { name: "Attended", rows: rows.filter((row) => row.attended) },
      { name: "Not Attended", rows: rows.filter((row) => !row.attended) },
      { name: "All Registrants", rows },
    ],
  };
}
