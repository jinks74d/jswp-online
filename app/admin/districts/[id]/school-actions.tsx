"use client";

/**
 * Footer actions for the Schools card on the district detail page: two buttons
 * ("Add a school" / "Import schools") that reveal the matching form below.
 * Reuses <SchoolForm> and <CsvImporter> verbatim.
 */

import { useState } from "react";
import { Plus, Upload } from "lucide-react";
import { CsvImporter } from "@/components/admin/csv-importer";
import { SchoolForm } from "@/components/school-structure/school-form";

type Panel = "none" | "add" | "import";

export function SchoolActions({ districtId }: { districtId: string }) {
  const [panel, setPanel] = useState<Panel>("none");

  const toggle = (next: Exclude<Panel, "none">) =>
    setPanel((p) => (p === next ? "none" : next));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => toggle("add")}
          aria-expanded={panel === "add"}
          className={`inline-flex items-center justify-center gap-2 rounded-md border px-4 py-2.5 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2 ${
            panel === "add"
              ? "border-rose-300 bg-rose-100 text-rose-800"
              : "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
          }`}
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add a school
        </button>
        <button
          type="button"
          onClick={() => toggle("import")}
          aria-expanded={panel === "import"}
          className={`inline-flex items-center justify-center gap-2 rounded-md border px-4 py-2.5 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2 ${
            panel === "import"
              ? "border-gray-300 bg-gray-100 text-gray-900"
              : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
          }`}
        >
          <Upload className="h-4 w-4" aria-hidden="true" />
          Import schools (CSV)
        </button>
      </div>

      {panel === "add" && (
        <div className="border-t border-gray-100 pt-4">
          <SchoolForm mode="create" districtId={districtId} />
        </div>
      )}
      {panel === "import" && (
        <div className="border-t border-gray-100 pt-4">
          <CsvImporter
            entity="schools"
            sampleHeaders={["name", "level"]}
            sampleRows={[
              ["Keller High School", "high"],
              ["Southlake Middle School", "middle"],
              ["Chapel Elementary", "elementary"],
            ]}
            scope={{ districtId }}
          />
        </div>
      )}
    </div>
  );
}
