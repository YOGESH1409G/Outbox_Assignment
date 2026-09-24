import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { LoginCard } from "@/components/LoginCard";

export default async function LoginPage() {
  const session = await getServerSession(authOptions);
  if (session) redirect("/dashboard/scheduled");

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <LoginCard />
    </main>
  );
}
