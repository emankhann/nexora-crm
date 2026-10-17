import { Suspense } from "react";
import AuthLayout from "@/components/auth/AuthLayout";
import AcceptInviteForm from "@/components/auth/AcceptInviteForm";

export default function AcceptInvitePage() {
  return (
    <AuthLayout>
      {/* The form reads the token from the URL, so it renders in the browser. */}
      <Suspense fallback={null}>
        <AcceptInviteForm />
      </Suspense>
    </AuthLayout>
  );
}
