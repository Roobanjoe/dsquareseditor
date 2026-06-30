import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Plus, Pencil, IdCard, Trash2 } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CM Autos — Member ID Cards" },
      { name: "description", content: "Generate and manage Chennai Makkal Auto Union member ID cards." },
    ],
  }),
  component: MembersPage,
});

function MembersPage() {
  const qc = useQueryClient();
  const { data: members, isLoading } = useQuery({
    queryKey: ["members"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("members")
        .select("id, name, position, member_no, mobile, photo_url")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("members").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Member deleted");
      qc.invalidateQueries({ queryKey: ["members"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto max-w-6xl px-6 py-5 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">CM Autos · ID Card Generator</h1>
            <p className="text-sm text-muted-foreground">
              Chennai Makkal Auto Union — Member registry
            </p>
          </div>
          <Button asChild>
            <Link to="/members/new">
              <Plus className="mr-1 h-4 w-4" /> Add member
            </Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        {isLoading ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : !members?.length ? (
          <div className="rounded-lg border border-dashed p-12 text-center">
            <p className="text-muted-foreground mb-4">No members yet.</p>
            <Button asChild>
              <Link to="/members/new">Add your first member</Link>
            </Button>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border bg-card">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="px-4 py-3">Photo</th>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Position</th>
                  <th className="px-4 py-3">Member No</th>
                  <th className="px-4 py-3">Mobile</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.id} className="border-t">
                    <td className="px-4 py-2">
                      {m.photo_url ? (
                        <img src={m.photo_url} alt={m.name}
                          className="h-10 w-10 rounded-full object-cover" />
                      ) : (
                        <div className="h-10 w-10 rounded-full bg-muted" />
                      )}
                    </td>
                    <td className="px-4 py-2 font-medium">{m.name}</td>
                    <td className="px-4 py-2 text-muted-foreground">{m.position}</td>
                    <td className="px-4 py-2 text-muted-foreground">{m.member_no}</td>
                    <td className="px-4 py-2 text-muted-foreground">{m.mobile}</td>
                    <td className="px-4 py-2">
                      <div className="flex justify-end gap-2">
                        <Button asChild size="sm" variant="default">
                          <Link to="/members/$id/card" params={{ id: m.id }}>
                            <IdCard className="h-4 w-4" />
                          </Link>
                        </Button>
                        <Button asChild size="sm" variant="outline">
                          <Link to="/members/$id/edit" params={{ id: m.id }}>
                            <Pencil className="h-4 w-4" />
                          </Link>
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            if (confirm(`Delete ${m.name}?`)) del.mutate(m.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
