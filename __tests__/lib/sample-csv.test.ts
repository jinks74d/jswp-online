import { describe, it, expect } from "vitest";
import {
  escapeCsvField,
  buildSampleCsv,
  sampleCsvFilename,
} from "@/lib/csv-import/sample-csv";

const BOM = "﻿";

describe("escapeCsvField", () => {
  it("leaves plain fields alone", () => {
    expect(escapeCsvField("Keller High School")).toBe("Keller High School");
  });
  it("quotes fields containing a comma", () => {
    expect(escapeCsvField("800 N. White Chapel Blvd, Southlake, TX")).toBe(
      '"800 N. White Chapel Blvd, Southlake, TX"'
    );
  });
  it("doubles internal quotes", () => {
    expect(escapeCsvField('The "Big" School')).toBe('"The ""Big"" School"');
  });
  it("quotes fields containing newlines", () => {
    expect(escapeCsvField("line one\nline two")).toBe('"line one\nline two"');
  });
  it("quotes fields with meaningful leading/trailing space", () => {
    expect(escapeCsvField(" padded ")).toBe('" padded "');
  });
});

describe("buildSampleCsv", () => {
  it("emits a BOM, CRLF endings, and a trailing newline", () => {
    const csv = buildSampleCsv(["name", "level"], [["Keller High", "high"]]);
    expect(csv.startsWith(BOM)).toBe(true);
    expect(csv).toBe(`${BOM}name,level\r\nKeller High,high\r\n`);
  });

  it("writes a headers-only file when no rows are given", () => {
    expect(buildSampleCsv(["name", "level"])).toBe(`${BOM}name,level\r\n`);
  });

  it("escapes cells inside rows", () => {
    const csv = buildSampleCsv(
      ["name", "address"],
      [["Keller High", "800 Chapel Blvd, Southlake, TX"]]
    );
    expect(csv).toContain('Keller High,"800 Chapel Blvd, Southlake, TX"');
  });

  it("pads short rows to the header count", () => {
    const csv = buildSampleCsv(["a", "b", "c"], [["1"]]);
    expect(csv).toBe(`${BOM}a,b,c\r\n1,,\r\n`);
  });

  it("truncates rows longer than the header count", () => {
    const csv = buildSampleCsv(["a", "b"], [["1", "2", "3"]]);
    expect(csv).toBe(`${BOM}a,b\r\n1,2\r\n`);
  });
});

describe("sampleCsvFilename", () => {
  it("slugifies the entity name", () => {
    expect(sampleCsvFilename("schools")).toBe("schools-example.csv");
    expect(sampleCsvFilename("school_admins")).toBe("school-admins-example.csv");
    expect(sampleCsvFilename("Class Periods")).toBe("class-periods-example.csv");
  });
  it("falls back when the entity has no usable characters", () => {
    expect(sampleCsvFilename("___")).toBe("import-example.csv");
  });
});
