import { Suspense } from "react";
import { AuthFlow } from "@/components/auth/AuthFlow";

export default function AuthPage() {
  return (
    <Suspense>
      <AuthFlow />
    </Suspense>
  );
}
