# AI-83 — Trainer ticket inbox UI design

## Location and scope

Render the live ticket inbox in the existing teacher class tickets route. Keep the selected class from the route as the initial class filter. This page lists and reads tickets; answering and resolving them belong to separate tasks.

## Layout and behavior

- Header identifies the class inbox and its purpose.
- Filter controls allow `All`, `Open`, `Answered`, and `Resolved`, plus the current class selection where available.
- List rows show ticket ID, question, student, class, status, and creation time. Newest tickets appear first, matching server order.
- Selecting a row shows the question and optional assistant-answer excerpt. The inbox is owner-scoped: only the trainer a ticket was sent to can list, read, or answer it. Co-trainers of the same class see nothing until a ticket is handed over to them; tickets created before the owner column existed stay with the class primary trainer.
- Provide previous/next pagination and a visible result count. Reset to page 1 when filters change.
- Keep the existing two-pane inbox pattern on wide screens; on narrow screens, allow list/detail navigation without horizontal overflow.

## States and accessibility

Support loading, empty inbox, no filter matches, API error with retry, and populated states. The empty inbox explains that student questions go to the trainer they were sent to and that handed-over tickets appear in the inbox. Use labeled filter controls, semantic buttons for rows and pagination, visible focus, and status text that does not rely on color alone. Preserve a sensible selection when page/filter data refreshes; otherwise show an instruction to choose a ticket.

## Data contract

Call `GET /api/tickets` with `class_id`, optional status, page, and page size. Trust the returned `items`, `total`, `page`, and `page_size` for pagination. The server enforces role and ticket ownership; the UI is not an authorization boundary. Class access is still required, so a ticket from another trainer's class is rejected with `403`, and so is a ticket owned by another trainer of the same class.

## Verification

Verify each status filter, class scoping, newest-first display, page boundaries, empty and error states, keyboard operation, and narrow-screen layout. Confirm that trainer A cannot see trainer B's tickets — whether B teaches another class or the same class — and receives `403` when requesting one directly.
