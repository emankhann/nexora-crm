import TeamView from "@/components/team/TeamView";
import { getTeam } from "@/lib/data";

export default async function TeamPage() {
  // The permission table is configuration; members live in the CRM store.
  const { permissions } = await getTeam();
  return <TeamView permissions={permissions} />;
}
