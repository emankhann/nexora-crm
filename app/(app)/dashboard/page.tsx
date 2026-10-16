import DashboardView from "@/components/dashboard/DashboardView";
import { getDashboard } from "@/lib/data";

export default async function DashboardPage() {
  // Monthly revenue history comes from the data layer; everything else on
  // the dashboard is worked out live from the CRM store.
  const { revenue } = await getDashboard();
  return <DashboardView revenueHistory={revenue} />;
}
