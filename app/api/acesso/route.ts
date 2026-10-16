import { NextResponse } from "next/server";
import { codigoValido, COOKIE_ACESSO, opcoesCookie } from "@/lib/sessao";

export async function POST(req: Request) {
  const { codigo } = (await req.json().catch(() => ({}))) as { codigo?: string };
  if (!codigo || !(await codigoValido(codigo))) return NextResponse.json({ erro: "Esse código não confere. Confere no email da sua compra." }, { status: 401 });
  const r = NextResponse.json({ ok: true });
  r.cookies.set(COOKIE_ACESSO, codigo.trim(), opcoesCookie);
  return r;
}
