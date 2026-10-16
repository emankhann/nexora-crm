import { Suspense } from "react";
import CustomerProfileView from "@/components/customers/CustomerProfileView";
import { PageSkeleton } from "@/components/ui/States";

export default function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <CustomerProfile params={params} />
    </Suspense>
  );
}

async function CustomerProfile({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CustomerProfileView id={decodeURIComponent(id)} />;
}
