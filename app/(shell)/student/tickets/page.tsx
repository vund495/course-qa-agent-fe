import { PageContainer } from "@/components/shared/PageShell";
import { StudentTickets } from "@/features/tickets/student-tickets";

export default function StudentTicketsPage() {
  return (
    <PageContainer className="flex min-h-full flex-col pt-8 pb-0">
      <StudentTickets />
    </PageContainer>
  );
}
