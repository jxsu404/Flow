import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { CommandBar } from "@/components/command-bar";
import { TaskList } from "@/components/task-list";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { DEFAULT_TIMEZONE } from "@/lib/datetime";
import { listItems } from "@/lib/items";

export const dynamic = "force-dynamic";

export default async function TareasPage() {
  const session = await auth();
  if (!session?.user?.id) return null;
  const [itemRows, userRows] = await Promise.all([
    listItems(session.user.id),
    getDb().select().from(users).where(eq(users.id, session.user.id)).limit(1),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Tareas y entregas</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          También puedes dictar cambios: “borra el examen de matemáticas”.
        </p>
      </div>
      <CommandBar />
      <TaskList items={itemRows} timeZone={userRows[0]?.timezone || DEFAULT_TIMEZONE} />
    </div>
  );
}
