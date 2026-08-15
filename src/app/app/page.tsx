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
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">¿Qué tengo que hacer?</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Habla o escribe. Flow organiza y sincroniza.
        </p>
      </div>
      <CommandBar />
      <DashboardView data={data} />
    </div>
  );
}
