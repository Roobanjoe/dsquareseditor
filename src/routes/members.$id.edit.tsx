import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MemberForm } from "@/components/MemberForm";

export const Route = createFileRoute("/members/$id/edit")({
  head: () => ({ meta: [{ title: "Edit Member" }] }),
  component: EditMember,
});

function EditMember() {
  const { id } = Route.useParams();
  const { data, isLoading } = useQuery({
    queryKey: ["member", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("members").select("*").eq("id", id).single();
      if (error) throw error;
      return data;
    },
  });
  if (isLoading || !data) {
    return <div className="p-8 text-muted-foreground">Loading…</div>;
  }
  return <MemberForm memberId={id} initial={data} />;
}
