import PageHeader from "@/components/layout/PageHeader";
import ReportsView from "@/components/reports/ReportsView";
import LiveReports from "@/components/reports/LiveReports";

export default function ReportsPage() {
  return (
    <>
      <PageHeader title="Reports" subtitle="How leads turn into revenue, and how the team is doing." />
      <ReportsView />
      <LiveReports />
    </>
  );
}
