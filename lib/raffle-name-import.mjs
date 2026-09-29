import readXlsxFile from "read-excel-file/browser";

function namesFromRows(rows) {
  const headers = rows[0] || [];
  const nameIndex = headers.findIndex((value) => String(value ?? "").trim() === "Name");
  if (nameIndex < 0) throw new Error('The file must contain a "Name" column.');
  const names = rows.slice(1).map((row) => String(row[nameIndex] ?? "").trim()).filter(Boolean);
  if (names.some((name) => /[\r\n]/.test(name))) throw new Error("Imported names cannot contain line breaks.");
  if (names.length === 0) throw new Error("No usable names were found in the file.");
  return names;
}

function parseCsvRows(text) {
  const rows = []; let row = []; let cell = ""; let quoted = false; let closedQuote = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted && character === '"' && text[index + 1] === '"') { cell += '"'; index += 1; }
    else if (character === '"' && quoted) { quoted = false; closedQuote = true; }
    else if (character === '"' && cell === "" && !closedQuote) quoted = true;
    else if (character === '"' || (closedQuote && character !== "," && character !== "\n" && character !== "\r")) throw new Error("The CSV contains an invalid quoted field.");
    else if (character === "," && !quoted) { row.push(cell); cell = ""; closedQuote = false; }
    else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      row.push(cell); rows.push(row); row = []; cell = ""; closedQuote = false;
    } else cell += character;
  }
  if (quoted) throw new Error("The CSV contains an unterminated quoted field.");
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

export function parseRaffleNamesFromCsv(text) {
  return namesFromRows(parseCsvRows(text.replace(/^\uFEFF/, "")));
}

export async function parseRaffleNamesFromWorkbook(arrayBuffer) {
  const sheets = await readXlsxFile(arrayBuffer);
  const sheet = sheets.find((item) => item.sheet === "All Registrants");
  if (!sheet) throw new Error('The workbook must contain an "All Registrants" worksheet.');
  return namesFromRows(sheet.data);
}
