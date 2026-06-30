import { createFileRoute } from "@tanstack/react-router";
import { MemberForm } from "@/components/MemberForm";

export const Route = createFileRoute("/members/new")({
  head: () => ({ meta: [{ title: "New Member" }] }),
  component: () => <MemberForm />,
});
