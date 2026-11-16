import test from "node:test";
import assert from "node:assert/strict";
import JSZip from "jszip";
import { extractBuffer } from "../src/fileProcessor.js";

test("CSV extraction preserves quoted commas and line breaks", async () => {
  const result = await extractBuffer("budget.csv", Buffer.from('Name,Amount,Note\r\nCoffee,3.50,"office, kitchen"\r\nMemo,4,"line one\nline two"'));
  assert.match(result.text, /Name \| Amount \| Note/);
  assert.match(result.text, /Coffee \| 3\.50 \| office, kitchen/);
  assert.match(result.text, /line one\nline two/);
});

test("XLSX extraction reads shared strings and cell references", async () => {
  const zip = new JSZip();
  zip.file("xl/sharedStrings.xml", '<sst><si><t>Item</t></si><si><t>Coffee &amp; tea</t></si></sst>');
  zip.file("xl/worksheets/sheet1.xml", '<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="C1" t="inlineStr"><is><t>Cost</t></is></c></row><row r="2"><c r="A2" t="s"><v>1</v></c><c r="C2"><v>3.5</v></c></row></sheetData></worksheet>');
  const buffer = await zip.generateAsync({ type: "nodebuffer" });
  const result = await extractBuffer("budget.xlsx", buffer);
  assert.match(result.text, /Sheet 1/);
  assert.match(result.text, /Item \|  \| Cost/);
  assert.match(result.text, /Coffee & tea \|  \| 3\.5/);
});
