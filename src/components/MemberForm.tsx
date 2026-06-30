import { useState, useEffect } from "react";
import { useNavigate, Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";

export type MemberFormValues = {
  name: string;
  position: string;
  dob: string;
  member_no: string;
  mobile: string;
  blood_group: string;
  license_no: string;
  renewal_date: string;
  auto_stand: string;
  emergency_mobile: string;
  father_name: string;
  address: string;
  photo_url: string;
};

const empty: MemberFormValues = {
  name: "", position: "", dob: "", member_no: "", mobile: "",
  blood_group: "", license_no: "", renewal_date: "", auto_stand: "",
  emergency_mobile: "", father_name: "", address: "", photo_url: "",
};

export function MemberForm({
  memberId,
  initial,
}: {
  memberId?: string;
  initial?: Partial<MemberFormValues>;
}) {
  const nav = useNavigate();
  const [values, setValues] = useState<MemberFormValues>({ ...empty, ...initial });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (initial) setValues({ ...empty, ...initial });
  }, [initial]);

  const upd = <K extends keyof MemberFormValues>(k: K, v: MemberFormValues[K]) =>
    setValues((s) => ({ ...s, [k]: v }));

  const handlePhoto = (file: File | null) => {
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) {
      toast.error("Photo must be under 3MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => upd("photo_url", reader.result as string);
    reader.readAsDataURL(file);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (memberId) {
        const { error } = await supabase.from("members").update(values).eq("id", memberId);
        if (error) throw error;
        toast.success("Member updated");
        nav({ to: "/members/$id/card", params: { id: memberId } });
      } else {
        const { data, error } = await supabase
          .from("members").insert(values).select("id").single();
        if (error) throw error;
        toast.success("Member created");
        nav({ to: "/members/$id/card", params: { id: data.id } });
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const field = (k: keyof MemberFormValues, label: string, type = "text") => (
    <div>
      <Label htmlFor={k}>{label}</Label>
      <Input id={k} type={type} required={k !== "photo_url"}
        value={values[k]} onChange={(e) => upd(k, e.target.value)} />
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto max-w-3xl px-6 py-4 flex items-center gap-3">
          <Button asChild variant="ghost" size="sm">
            <Link to="/"><ArrowLeft className="h-4 w-4 mr-1" /> Back</Link>
          </Button>
          <h1 className="text-xl font-bold">
            {memberId ? "Edit member" : "New member"}
          </h1>
        </div>
      </header>

      <form onSubmit={submit} className="mx-auto max-w-3xl px-6 py-8 space-y-6">
        <div>
          <Label>Photo</Label>
          <div className="flex items-center gap-4 mt-1">
            {values.photo_url && (
              <img src={values.photo_url} alt="" className="h-24 w-24 rounded-full object-cover border" />
            )}
            <Input type="file" accept="image/*"
              onChange={(e) => handlePhoto(e.target.files?.[0] ?? null)} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {field("name", "Name (பெயர்)")}
          {field("position", "Position (பதவி)")}
          {field("dob", "Date of Birth", "date")}
          {field("member_no", "Member No")}
          {field("mobile", "Mobile")}
          {field("blood_group", "Blood Group")}
          {field("license_no", "Driving License No")}
          {field("renewal_date", "Renewal Date", "date")}
          {field("auto_stand", "Auto Stand")}
          {field("emergency_mobile", "Emergency Contact")}
          {field("father_name", "Father's Name")}
        </div>
        <div>
          <Label htmlFor="address">Address</Label>
          <Textarea id="address" required value={values.address}
            onChange={(e) => upd("address", e.target.value)} rows={2} />
        </div>

        <div className="flex gap-3">
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : memberId ? "Save changes" : "Create member"}
          </Button>
          <Button asChild type="button" variant="outline">
            <Link to="/">Cancel</Link>
          </Button>
        </div>
      </form>
    </div>
  );
}
