import { signIn } from "@/auth";
import { Button } from "@/components/ui/button";

export function GoogleSignIn() {
  return (
    <form
      action={async () => {
        "use server";
        await signIn("google", { redirectTo: "/app" });
      }}
    >
      <Button type="submit" size="lg" className="h-11 px-5 text-base">
        Continuar con Google
      </Button>
    </form>
  );
}
