"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

/** The old mock "My Proposals" page now lives at the real My Tickets page. */
export default function StudentProposalsRedirect() {
  const router = useRouter();

  React.useEffect(() => {
    router.replace("/student/tickets");
  }, [router]);

  return null;
}
