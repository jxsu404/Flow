import { auth } from "@/auth";
import { AppHeader } from "@/components/app-header";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader name={session?.user?.name} />
      <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 md:px-8">{children}</div>
    </div>
  );
}
