import { redirect } from "next/navigation";
import { getLoginSession } from "@/lib/auth";
import { requiresPayment } from "@/lib/access-gate";
import { PaymentRequiredScreen } from "@/components/navigation/payment-required-screen";

export default async function PaymentRequiredPage() {
  const session = await getLoginSession();
  if (!session?.user) redirect("/login");
  if (!requiresPayment(session.user.email)) redirect("/projects");

  return <PaymentRequiredScreen />;
}
