import { createClient } from "@/lib/supabase/server";
import { InviteAcceptance } from "@/components/invite-acceptance";

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("poultryedos_view_invite", { p_token: token });
  const invite = !error && data && data.length > 0 ? data[0] : null;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return <InviteAcceptance token={token} invite={invite} isLoggedIn={!!user} />;
}
