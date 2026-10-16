import { Suspense } from "react";
import PipelineBoard from "@/components/pipeline/PipelineBoard";
import { PageSkeleton } from "@/components/ui/States";

export default function PipelinePage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <PipelineBoard />
    </Suspense>
  );
}
