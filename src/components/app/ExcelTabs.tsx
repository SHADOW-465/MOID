"use client";

// Import and Files are two tabs of one destination. Kept as two routes so both
// stay bookmarkable and neither 800-line page has to move.

import React from "react";
import Tabs from "@/components/ui/Tabs";

export default function ExcelTabs({
  active,
  fileCount,
}: {
  active: "staging" | "workbooks";
  fileCount?: number;
}) {
  return (
    <div style={{ marginBottom: 16 }}>
      <Tabs
        ariaLabel="Excel data"
        active={active}
        items={[
          { id: "workbooks", label: "Files", href: "/workbooks", badge: fileCount },
          { id: "staging", label: "Import", href: "/staging" },
        ]}
      />
    </div>
  );
}
