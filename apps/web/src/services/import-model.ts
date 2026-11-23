import type { SchoolId } from "@/types/demo";
import {
  requireRule,
  saveAcademicRecord,
  type AcademicState,
  type Actor,
} from "./academic-model";

/* ---------- Templates ---------- */

export type ImportKind = "students" | "teachers" | "parents";

export const importTemplates: Record<
  ImportKind,
  { label: string; columns: string[]; required: string[]; sample: string[][] }
> = {
  students: {
    label: "Students",
    columns: [
      "Student name",
      "Student number",
      "Class",
      "Section",
      "Guardian name",
      "Guardian email",
      "Relationship",
    ],
    required: ["Student name", "Student number", "Class", "Section"],
    sample: [
      [
        "Meera Iyer",
        "ST-101",
        "Grade 8",
        "A",
        "Lakshmi Iyer",
        "lakshmi.iyer@example.test",
        "Parent",
      ],
    ],
  },
  teachers: {
    label: "Teachers",
    columns: ["Name", "Email", "Availability"],
    required: ["Name", "Email"],
    sample: [
      ["Arjun Nair", "arjun.nair@example.test", "Monday–Friday, 08:00–14:00"],
    ],
  },
  parents: {
    label: "Parents & guardians",
    columns: [
      "Guardian name",
      "Guardian email",
      "Student number",
      "Relationship",
      "Primary contact",
    ],
    required: ["Guardian name", "Guardian email", "Student number"],
    sample: [
      ["Ravi Chen", "ravi.chen@example.test", "ST-1", "Grandparent", "No"],
    ],
  },
};

export const maxImportRows = 1000;
const relationships = ["Parent", "Guardian", "Grandparent", "Other"];

/* ---------- CSV ---------- */

/** RFC 4180 CSV: quoted fields, escaped quotes, CRLF or LF, optional BOM. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const input = text.replace(/^﻿/, "");
  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (quoted) {
      if (char === '"' && input[i + 1] === '"') {
        field += '"';
        i++;
      } else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"' && field === "") quoted = true;
    else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && input[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += char;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

export function toCsv(rows: string[][]) {
  return rows
    .map((row) =>
      row
        .map((value) =>
          /[",\r\n]/.test(value)
            ? '"' + value.replace(/"/g, '""') + '"'
            : value,
        )
        .join(","),
    )
    .join("\r\n");
}

/* ---------- XLSX (zip of XML) ---------- */

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

const escapeXml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

function unescapeXml(value: string) {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) =>
      String.fromCodePoint(parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function columnName(index: number) {
  let name = "";
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26))
    name = String.fromCharCode(65 + ((n - 1) % 26)) + name;
  return name;
}

function columnIndex(reference: string) {
  const letters = reference.replace(/\d+$/, "");
  let index = 0;
  for (const char of letters) index = index * 26 + (char.charCodeAt(0) - 64);
  return index - 1;
}

/** Builds a minimal one-sheet .xlsx (stored, uncompressed) with text cells. */
export function buildXlsx(rows: string[][], sheetName = "Import"): Uint8Array {
  const sheet =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>' +
    rows
      .map(
        (row, r) =>
          '<row r="' +
          (r + 1) +
          '">' +
          row
            .map(
              (value, c) =>
                '<c r="' +
                columnName(c) +
                (r + 1) +
                '" t="inlineStr"><is><t xml:space="preserve">' +
                escapeXml(value) +
                "</t></is></c>",
            )
            .join("") +
          "</row>",
      )
      .join("") +
    "</sheetData></worksheet>";
  const files: [string, string][] = [
    [
      "[Content_Types].xml",
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
    ],
    [
      "_rels/.rels",
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    ],
    [
      "xl/workbook.xml",
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="' +
        escapeXml(sheetName) +
        '" sheetId="1" r:id="rId1"/></sheets></workbook>',
    ],
    [
      "xl/_rels/workbook.xml.rels",
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
    ],
    ["xl/worksheets/sheet1.xml", sheet],
  ];
  const encoder = new TextEncoder();
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const [name, text] of files) {
    const nameBytes = encoder.encode(name);
    const data = encoder.encode(text);
    const crc = crc32(data);
    const local = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, 0x0800, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, data.length, true);
    lv.setUint32(22, data.length, true);
    lv.setUint16(26, nameBytes.length, true);
    local.set(nameBytes, 30);
    const entry = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(entry.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x0800, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, data.length, true);
    cv.setUint32(24, data.length, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint32(42, offset, true);
    entry.set(nameBytes, 46);
    parts.push(local, data);
    central.push(entry);
    offset += local.length + data.length;
  }
  const centralSize = central.reduce((sum, item) => sum + item.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);
  const all = [...parts, ...central, end];
  const output = new Uint8Array(
    all.reduce((sum, item) => sum + item.length, 0),
  );
  let position = 0;
  for (const item of all) {
    output.set(item, position);
    position += item.length;
  }
  return output;
}

async function inflateRaw(data: Uint8Array) {
  const stream = new Blob([data as BlobPart])
    .stream()
    .pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function unzip(bytes: Uint8Array, wanted: (name: string) => boolean) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65_557); i--)
    if (view.getUint32(i, true) === 0x06054b50) {
      end = i;
      break;
    }
  requireRule(end >= 0, "This file isn't a valid Excel workbook.");
  const count = view.getUint16(end + 10, true);
  let pointer = view.getUint32(end + 16, true);
  const decoder = new TextDecoder();
  const files = new Map<string, Uint8Array>();
  for (let n = 0; n < count; n++) {
    requireRule(
      view.getUint32(pointer, true) === 0x02014b50,
      "This file isn't a valid Excel workbook.",
    );
    const method = view.getUint16(pointer + 10, true);
    const size = view.getUint32(pointer + 20, true);
    const nameLength = view.getUint16(pointer + 28, true);
    const extra = view.getUint16(pointer + 30, true);
    const comment = view.getUint16(pointer + 32, true);
    const local = view.getUint32(pointer + 42, true);
    const name = decoder.decode(
      bytes.subarray(pointer + 46, pointer + 46 + nameLength),
    );
    if (wanted(name)) {
      const start =
        local +
        30 +
        view.getUint16(local + 26, true) +
        view.getUint16(local + 28, true);
      const data = bytes.subarray(start, start + size);
      requireRule(
        method === 0 || method === 8,
        "This workbook uses an unsupported compression.",
      );
      files.set(name, method === 0 ? data : await inflateRaw(data));
    }
    pointer += 46 + nameLength + extra + comment;
  }
  return files;
}

/** Reads the first worksheet of an .xlsx file as rows of text. */
export async function parseXlsx(bytes: Uint8Array): Promise<string[][]> {
  const files = await unzip(
    bytes,
    (name) =>
      name === "xl/sharedStrings.xml" ||
      /^xl\/worksheets\/sheet\d+\.xml$/.test(name),
  );
  const decoder = new TextDecoder();
  const sheetName = [...files.keys()]
    .filter((name) => name.startsWith("xl/worksheets/"))
    .sort((a, b) => Number(a.match(/\d+/)![0]) - Number(b.match(/\d+/)![0]))[0];
  requireRule(sheetName, "The workbook has no worksheet.");
  const text = (xml: string) =>
    [...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)]
      .map((match) => unescapeXml(match[1]))
      .join("");
  const shared = files.has("xl/sharedStrings.xml")
    ? [
        ...decoder
          .decode(files.get("xl/sharedStrings.xml")!)
          .matchAll(/<si>([\s\S]*?)<\/si>/g),
      ].map((match) => text(match[1]))
    : [];
  const sheet = decoder.decode(files.get(sheetName)!);
  const rows: string[][] = [];
  for (const rowMatch of sheet.matchAll(
    /<row\b[^>]*?(?:\/>|>([\s\S]*?)<\/row>)/g,
  )) {
    const row: string[] = [];
    const body = rowMatch[1] ?? "";
    for (const cell of body.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attributes = cell[1];
      const inner = cell[2] ?? "";
      const reference = /\br="([A-Z]+\d+)"/.exec(attributes)?.[1];
      const type = /\bt="([^"]+)"/.exec(attributes)?.[1];
      const raw = /<v>([\s\S]*?)<\/v>/.exec(inner)?.[1];
      const value =
        type === "s"
          ? (shared[Number(raw)] ?? "")
          : type === "inlineStr"
            ? text(inner)
            : type === "b"
              ? raw === "1"
                ? "TRUE"
                : "FALSE"
              : unescapeXml(raw ?? "");
      const index = reference ? columnIndex(reference) : row.length;
      while (row.length < index) row.push("");
      row[index] = value;
    }
    rows.push(row);
  }
  return rows;
}

/* ---------- Planning ---------- */

export type ImportRow = {
  line: number;
  values: Record<string, string>;
  ok: boolean;
  message: string;
};

const normal = (value: string) => value.trim().toLowerCase();

/**
 * Validates and applies every row to a copy of the records. Each row is
 * all-or-nothing: a failing row leaves no partial records behind.
 */
export function planImport(
  state: AcademicState,
  school: SchoolId,
  kind: ImportKind,
  table: string[][],
  makeId: () => string,
) {
  const template = importTemplates[kind];
  const header = (table[0] ?? []).map((cell) => cell.trim());
  requireRule(
    header.some(Boolean),
    "The file is empty. Start from the template.",
  );
  const positions = new Map(
    template.columns.map((column) => [
      column,
      header.findIndex((cell) => normal(cell) === normal(column)),
    ]),
  );
  const missing = template.required.filter(
    (column) => positions.get(column)! < 0,
  );
  requireRule(
    !missing.length,
    "Missing column" +
      (missing.length > 1 ? "s: " : ": ") +
      missing.join(", ") +
      ".",
  );
  const body = table
    .slice(1)
    .map((cells, index) => ({ cells, line: index + 2 }))
    .filter(({ cells }) => cells.some((cell) => cell.trim()));
  requireRule(body.length, "The file has no rows to import.");
  requireRule(
    body.length <= maxImportRows,
    "Import up to " + maxImportRows + " rows at a time.",
  );
  const actor: Actor = { role: "school-admin", school };
  let next = state;
  const rows: ImportRow[] = body.map(({ cells, line }) => {
    const values = Object.fromEntries(
      template.columns.map((column) => {
        const position = positions.get(column)!;
        return [column, position >= 0 ? (cells[position] ?? "").trim() : ""];
      }),
    );
    try {
      const { state: applied, message } = applyRow(
        next,
        actor,
        kind,
        values,
        makeId,
      );
      next = applied;
      return { line, values, ok: true, message };
    } catch (failure) {
      return { line, values, ok: false, message: (failure as Error).message };
    }
  });
  return { rows, next, imported: rows.filter((row) => row.ok).length };
}

function applyRow(
  state: AcademicState,
  actor: Actor,
  kind: ImportKind,
  values: Record<string, string>,
  makeId: () => string,
) {
  const school = () => state.schools[actor.school];
  const required = (column: string) =>
    requireRule(values[column], column + " is required.");
  const guardianFor = (name: string, email: string) => {
    const existing = school().guardians.find(
      (item) => normal(item.email) === normal(email),
    );
    if (existing) return { id: existing.id, created: false };
    requireRule(name, "Guardian name is required for a new guardian.");
    const id = makeId();
    state = saveAcademicRecord(state, actor, "guardians", { id, name, email });
    return { id, created: true };
  };
  const relationship = (value: string) => {
    const match = relationships.find(
      (item) => normal(item) === normal(value || "Parent"),
    );
    requireRule(
      match,
      "Relationship must be Parent, Guardian, Grandparent or Other.",
    );
    return match;
  };

  if (kind === "teachers") {
    required("Name");
    required("Email");
    state = saveAcademicRecord(state, actor, "teachers", {
      id: makeId(),
      name: values.Name,
      email: values.Email,
      availability: values.Availability,
      status: "Active",
    });
    return { state, message: "Adds teacher " + values.Name };
  }

  if (kind === "students") {
    ["Student name", "Student number", "Class", "Section"].forEach(required);
    const year = school().years.find((item) => item.status === "Active");
    requireRule(year, "Set an active academic year first.");
    const section = school().sections.find(
      (item) =>
        item.year === year.id &&
        item.status === "Active" &&
        normal(item.grade) === normal(values.Class) &&
        normal(item.name) === normal(values.Section),
    );
    requireRule(
      section,
      "No active section " +
        values.Class +
        " · " +
        values.Section +
        " in " +
        year.name +
        ".",
    );
    const student = makeId();
    state = saveAcademicRecord(state, actor, "students", {
      id: student,
      name: values["Student name"],
      code: values["Student number"],
    });
    state = saveAcademicRecord(state, actor, "enrollments", {
      id: makeId(),
      student,
      section: section.id,
      status: "Enrolled",
    });
    let note = "";
    if (values["Guardian email"] || values["Guardian name"]) {
      required("Guardian email");
      const guardian = guardianFor(
        values["Guardian name"],
        values["Guardian email"],
      );
      state = saveAcademicRecord(state, actor, "links", {
        id: makeId(),
        guardian: guardian.id,
        student,
        relationship: relationship(values.Relationship),
        primary: "Yes",
      });
      note = guardian.created
        ? " with a new guardian"
        : " linked to an existing guardian";
    }
    return {
      state,
      message:
        "Adds " +
        values["Student name"] +
        " to " +
        section.grade +
        " · " +
        section.name +
        note,
    };
  }

  ["Guardian name", "Guardian email", "Student number"].forEach(required);
  const student = school().students.find(
    (item) => normal(item.code) === normal(values["Student number"]),
  );
  requireRule(
    student,
    "No student with number " + values["Student number"] + ".",
  );
  const primary = values["Primary contact"] || "No";
  const primaryValue = ["yes", "y", "true"].includes(normal(primary))
    ? "Yes"
    : ["no", "n", "false"].includes(normal(primary))
      ? "No"
      : undefined;
  requireRule(primaryValue, "Primary contact must be Yes or No.");
  const guardian = guardianFor(
    values["Guardian name"],
    values["Guardian email"],
  );
  state = saveAcademicRecord(state, actor, "links", {
    id: makeId(),
    guardian: guardian.id,
    student: student.id,
    relationship: relationship(values.Relationship),
    primary: primaryValue,
  });
  return {
    state,
    message:
      (guardian.created ? "Adds " : "Links ") +
      values["Guardian name"] +
      " to " +
      student.name,
  };
}
