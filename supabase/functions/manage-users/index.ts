import { withSupabase } from "npm:@supabase/server@^1";

type UserAction = "create" | "update" | "delete";
type UserPayload = {
  action: UserAction;
  id?: string;
  name?: string;
  email?: string;
  password?: string;
  role?: "admin" | "operation";
};

const fail = (message: string, status = 400) =>
  Response.json({ error: message }, { status });

export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    if (req.method !== "POST") return fail("Método não permitido.", 405);

    const claims = ctx.userClaims as { sub?: string; id?: string } | undefined;
    const callerId = String(claims?.sub ?? claims?.id ?? "");
    if (!callerId) return fail("Sessão inválida.", 401);
    const { data: caller, error: callerError } = await ctx.supabaseAdmin
      .from("profiles")
      .select("id, role")
      .eq("id", callerId)
      .single();

    if (callerError || caller?.role !== "admin") {
      return fail("Apenas administradores podem gerenciar usuários.", 403);
    }

    let body: UserPayload;
    try {
      body = await req.json();
    } catch {
      return fail("Dados inválidos.");
    }

    const name = body.name?.trim();
    const email = body.email?.trim().toLowerCase();
    const role = body.role;
    const password = body.password;

    if (body.action === "create") {
      if (!name || !email || !role || !password || password.length < 6) {
        return fail("Informe nome, e-mail, perfil e uma senha de pelo menos 6 caracteres.");
      }

      const { data, error } = await ctx.supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { name },
      });
      if (error || !data.user) return fail(error?.message ?? "Não foi possível criar o usuário.");

      const { error: profileError } = await ctx.supabaseAdmin
        .from("profiles")
        .update({ name, email, role })
        .eq("id", data.user.id);
      if (profileError) {
        await ctx.supabaseAdmin.auth.admin.deleteUser(data.user.id);
        return fail(profileError.message);
      }
      return Response.json({ ok: true, id: data.user.id });
    }

    if (!body.id) return fail("Usuário não informado.");

    const { data: target, error: targetError } = await ctx.supabaseAdmin
      .from("profiles")
      .select("id, name, email, role")
      .eq("id", body.id)
      .single();
    if (targetError || !target) return fail("Usuário não encontrado.", 404);

    const wouldRemoveAdmin = target.role === "admin" &&
      (body.action === "delete" || (body.action === "update" && role !== "admin"));
    if (wouldRemoveAdmin) {
      const { count } = await ctx.supabaseAdmin
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("role", "admin");
      if ((count ?? 0) <= 1) return fail("É necessário manter ao menos um administrador.");
    }

    if (body.action === "delete") {
      if (body.id === callerId) return fail("Você não pode excluir a conta que está usando.");
      const { error } = await ctx.supabaseAdmin.auth.admin.deleteUser(body.id);
      if (error) return fail(error.message);
      return Response.json({ ok: true });
    }

    if (body.action === "update") {
      if (!name || !email || !role) return fail("Informe nome, e-mail e perfil.");
      if (password && password.length < 6) return fail("A senha deve ter pelo menos 6 caracteres.");
      if (body.id === callerId && role !== "admin") {
        return fail("Você não pode remover seu próprio acesso administrativo.");
      }

      const attributes: Record<string, unknown> = {
        email,
        email_confirm: true,
        user_metadata: { name },
      };
      if (password) attributes.password = password;
      const { error: authError } = await ctx.supabaseAdmin.auth.admin.updateUserById(body.id, attributes);
      if (authError) return fail(authError.message);

      const { error: profileError } = await ctx.supabaseAdmin
        .from("profiles")
        .update({ name, email, role })
        .eq("id", body.id);
      if (profileError) return fail(profileError.message);
      return Response.json({ ok: true });
    }

    return fail("Ação inválida.");
  }),
};
