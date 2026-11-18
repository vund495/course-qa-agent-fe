import { PageContainer } from "@/components/shared/PageShell";
import { TicketInbox } from "@/features/tickets/ticket-inbox";

export default function TeacherTicketsPage() {
  return (
    <PageContainer className="flex min-h-full flex-col pt-8 pb-0">
      <TicketInbox />
    </PageContainer>
  );
}
