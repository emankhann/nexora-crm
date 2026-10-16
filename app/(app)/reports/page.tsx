import PageHeader from "@/components/layout/PageHeader";
import ReportsView from "@/components/reports/ReportsView";
import LiveReports from "@/components/reports/LiveReports";
import { getReports } from "@/lib/data";

export default async function ReportsPage() {
  const { revenue } = await getReports();

  return (
    <>
      <PageHeader title="Reports" subtitle="How leads turn into revenue, and how the team is doing." />
      <ReportsView history={revenue} />
      <LiveReports />
    </>
  );
}
