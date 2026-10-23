// Account-specific access restriction. Shared by server auth and middleware.
export const PAYMENT_REQUIRED_MESSAGE = "Pay ₹300 to continue";

export function requiresPayment(email: string | null | undefined): boolean {
  return email?.trim().toLowerCase() === "bijokbinoy2005@gmail.com";
}
