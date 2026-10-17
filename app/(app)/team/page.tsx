import TeamView from "@/components/team/TeamView";
import { PERMISSION_TABLE } from "@/lib/permissions";

export default function TeamPage() {
  // The permission table is configuration; members come from the CRM store.
  return <TeamView permissions={PERMISSION_TABLE} />;
}
