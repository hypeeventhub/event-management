import assert from "node:assert/strict";
import test from "node:test";
import writeXlsxFile from "write-excel-file/node";
import { parseRaffleNamesFromCsv, parseRaffleNamesFromWorkbook } from "../lib/raffle-name-import.mjs";

async function workbookBuffer(sheet, rows) {
  return writeXlsxFile([{ data: rows.map((row) => row.map((value) => ({ value }))), sheet }]).toBuffer();
}

test("imports only non-empty Name values from All Registrants CSV", () => {
  assert.deepEqual(parseRaffleNamesFromCsv('Name,Email\r\n"Pedro, Jr.",p@example.com\r\n,blank@example.com\r\nJuan,j@example.com'), ["Pedro, Jr.", "Juan"]);
});

test("imports only Name values from the All Registrants workbook", async () => {
  const bytes = await workbookBuffer("All Registrants", [["Name", "Email"], ["Pedro", "p@example.com"], ["Pedro", "other@example.com"]]);
  assert.deepEqual(await parseRaffleNamesFromWorkbook(bytes), ["Pedro", "Pedro"]);
});

test("rejects missing Name columns and All Registrants worksheets", async () => {
  assert.throws(() => parseRaffleNamesFromCsv("Email\na@example.com"), /Name.*column/);
  const bytes = await workbookBuffer("Attended", [["Name"], ["Ana"]]);
  await assert.rejects(() => parseRaffleNamesFromWorkbook(bytes), /All Registrants/);
});

test("rejects malformed quoted CSV and multiline names", () => {
  assert.throws(() => parseRaffleNamesFromCsv('Name,Email\n"Ana,ana@example.com'), /quoted field/);
  assert.throws(() => parseRaffleNamesFromCsv('Name,Email\n"Ana\nSantos",ana@example.com'), /line breaks/);
});
