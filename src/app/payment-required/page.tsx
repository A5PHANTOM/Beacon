import { redirect } from "next/navigation";
import { getServerAuthSession } from "@/lib/auth";

export default async function PaymentRequiredPage() {
  const session = await getServerAuthSession();
  if (!session?.user) redirect("/login");
  // Keep old bookmarks and open tabs working after the restriction was removed.
  redirect("/projects");
}
