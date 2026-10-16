import { Suspense } from "react";
import LeadDetailView from "@/components/leads/LeadDetailView";
import { PageSkeleton } from "@/components/ui/States";

export default function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <LeadDetail params={params} />
    </Suspense>
  );
}

async function LeadDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <LeadDetailView id={decodeURIComponent(id)} />;
}
