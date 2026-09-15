import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifySession } from "@/lib/auth";

export default async function Home() {
  const session = await verifySession((await cookies()).get("market_briefing_session")?.value);
  if (!session) redirect("/login");
  redirect("/dashboard");
}
