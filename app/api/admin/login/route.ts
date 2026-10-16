import { NextResponse } from "next/server";
import { COOKIE_ADMIN, opcoesCookie } from "@/lib/sessao";

export async function POST(req: Request) {
  const form = await req.formData();
  const senha = String(form.get("senha") ?? "");
  const destino = new URL("/admin", req.url);
  if (!process.env.ADMIN_SENHA || senha !== process.env.ADMIN_SENHA) {
    destino.searchParams.set("erro", "1");
    return NextResponse.redirect(destino, 303);
  }
  const r = NextResponse.redirect(destino, 303);
  r.cookies.set(COOKIE_ADMIN, senha, { ...opcoesCookie, maxAge: 60 * 60 * 24 * 30 });
  return r;
}
