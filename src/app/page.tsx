import { redirect } from "next/navigation";
import { getLoginSession } from "@/lib/auth";
import { requiresPayment } from "@/lib/access-gate";

export default async function Home() {
  const session = await getLoginSession();
  if (requiresPayment(session?.user?.email)) {
    redirect("/payment-required");
  }
  if (session?.user) {
    redirect("/projects");
  } else {
    redirect("/login");
  }
}
