import { auth } from "@/auth";
import { CommandBar } from "@/components/command-bar";
import { ClassScheduleEditor } from "@/components/class-schedule-editor";
import { listClassBlocks } from "@/lib/classes";

export const dynamic = "force-dynamic";

export default async function HorarioPage() {
  const session = await auth();
  if (!session?.user?.id) return null;
  const classes = await listClassBlocks(session.user.id);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Horario de clases</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Estos bloques son tiempo ocupado. Flow los usa para detectar huecos.
        </p>
      </div>
      <CommandBar />
      <ClassScheduleEditor initial={classes} />
    </div>
  );
}
