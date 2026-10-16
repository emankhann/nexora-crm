"use client";

import PageHeader from "@/components/layout/PageHeader";
import AuditTable from "@/components/audit/AuditTable";
import { useCrm } from "@/lib/crm-store";
import { btnOutline } from "@/lib/ui";
import { downloadCsv } from "@/lib/csv";
import { formatDate, formatTime, timeAgo } from "@/lib/utils";

export default function AuditLogView() {
  const crm = useCrm();
  if (!crm) return null;
  const events = crm.audit.map((a) => ({ id: a.id, when: timeAgo(a.at), user: a.user, action: a.action, record: a.record, details: a.details }));

  return (
    <>
      <PageHeader title="Audit log" subtitle="A record of every change made in Nexora.">
        <button
          type="button"
          className={btnOutline}
          onClick={() =>
            downloadCsv(
              "nexora-audit-log.csv",
              ["Date", "Time", "User", "Action", "Record", "Details"],
              crm.audit.map((a) => [formatDate(a.at), formatTime(a.at), a.user, a.action, a.record, a.details])
            )
          }
        >
          Export log
        </button>
      </PageHeader>
      <AuditTable events={events} />
    </>
  );
}
