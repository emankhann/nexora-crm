import { Suspense } from "react";
import LeadsTable from "@/components/leads/LeadsTable";
import { PageSkeleton } from "@/components/ui/States";

export default function LeadsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <LeadsTable />
    </Suspense>
  );
}
