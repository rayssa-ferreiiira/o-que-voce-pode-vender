import { NextResponse } from "next/server";
import { salvarConversa } from "@/lib/conversa";
import { COOKIE_EMAIL, conversaAtual, conversasDoEmail, CONVERSAS_POR_EMAIL, emailValido, opcoesCookie, temAcesso } from "@/lib/sessao";

export async function POST(req: Request) {
  if (!(await temAcesso())) return NextResponse.json({ erro: "Seu acesso não vale mais." }, { status: 401 });
  const { email: bruto } = (await req.json().catch(() => ({}))) as { email?: string };
  const email = (bruto ?? "").trim().toLowerCase();
  if (!emailValido(email)) return NextResponse.json({ erro: "Esse email não parece certo. Confere pra mim?" }, { status: 400 });
  const c = await conversaAtual();
  if (!c || (c.fase !== "email" && c.fase !== "concluida")) return NextResponse.json({ erro: "Ainda não chegamos nessa parte da conversa." }, { status: 409 });

  const outras = (await conversasDoEmail(email)).filter((x) => x.id !== c.id && x.fase === "concluida").length;
  await salvarConversa(c.id, { email, fase: "concluida" });
  const restantes = Math.max(0, CONVERSAS_POR_EMAIL - outras - 1);
  const r = NextResponse.json({ ok: true, id: c.id, restantes });
  r.cookies.set(COOKIE_EMAIL, email, opcoesCookie);
  return r;
}
