import { auth } from "@/auth";
import { CommandBar } from "@/components/command-bar";
import { DashboardView } from "@/components/dashboard-view";
import { getDashboardData } from "@/lib/dashboard";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) return null;
  const data = await getDashboardData(session.user.id);

  return (
    <div className="flex flex-col gap-8">
      <CommandBar featured />
      <DashboardView data={data} />
    </div>
  );
}
