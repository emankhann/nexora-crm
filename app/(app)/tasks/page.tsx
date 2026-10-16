import { Suspense } from "react";
import TasksBoard from "@/components/tasks/TasksBoard";
import { PageSkeleton } from "@/components/ui/States";

export default function TasksPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <TasksBoard />
    </Suspense>
  );
}
