"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui";
import { apiPost } from "@/lib/api-client";

export function LogoutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="danger"
      className="w-full"
      loading={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await apiPost("/api/auth/logout");
        } finally {
          router.push("/login");
          router.refresh();
        }
      }}
    >
      <LogOut className="size-4" aria-hidden /> Çıkış Yap
    </Button>
  );
}
