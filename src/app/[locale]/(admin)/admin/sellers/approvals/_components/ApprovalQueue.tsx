"use client";

import { useState } from "react";
import { DataTable } from "@/components/shared";
import type { DataTableColumn } from "@/components/shared";

const PAGE_SIZE = 20;

export function ApprovalQueue({
  columns,
  rows,
  caption,
  emptyLabel,
  errorLabel,
  retryLabel,
  previousLabel,
  nextLabel,
}: {
  columns: DataTableColumn[];
  rows: Record<string, string>[];
  caption: string;
  emptyLabel: string;
  errorLabel: string;
  retryLabel: string;
  previousLabel: string;
  nextLabel: string;
}) {
  const [pageIndex, setPageIndex] = useState(0);
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const pageRows = rows.slice(pageIndex * PAGE_SIZE, (pageIndex + 1) * PAGE_SIZE);

  return (
    <DataTable
      columns={columns}
      rows={pageRows}
      rowKey="id"
      rowHref={(row) => row.href}
      caption={caption}
      emptyLabel={emptyLabel}
      errorLabel={errorLabel}
      retryLabel={retryLabel}
      previousLabel={previousLabel}
      nextLabel={nextLabel}
      pageIndex={pageIndex}
      pageCount={pageCount}
      onPageChange={setPageIndex}
    />
  );
}
