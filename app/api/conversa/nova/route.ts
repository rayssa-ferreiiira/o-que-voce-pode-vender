import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { COOKIE_CONVERSA, COOKIE_EMAIL, conversasDoEmail, CONVERSAS_POR_EMAIL, temAcesso } from "@/lib/sessao";

/** começa uma conversa nova, respeitando o limite por email lembrado */
export async function POST() {
  if (!(await temAcesso())) return NextResponse.json({ erro: "Seu acesso não vale mais." }, { status: 401 });
  const jar = await cookies();
  const email = jar.get(COOKIE_EMAIL)?.value;
  if (email) {
    const usadas = (await conversasDoEmail(email)).filter((c) => c.fase === "concluida").length;
    if (usadas >= CONVERSAS_POR_EMAIL) return NextResponse.json({ erro: `Esse email já usou as ${CONVERSAS_POR_EMAIL} conversas incluídas.` }, { status: 403 });
  }
  const r = NextResponse.json({ ok: true });
  r.cookies.delete(COOKIE_CONVERSA);
  return r;
}
