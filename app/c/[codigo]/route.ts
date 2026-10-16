import { NextResponse } from "next/server";
import { codigoValido, COOKIE_ACESSO, opcoesCookie } from "@/lib/sessao";

export async function GET(req: Request, { params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params;
  const destino = new URL("/", req.url);
  if (!(await codigoValido(decodeURIComponent(codigo)))) {
    destino.searchParams.set("codigo", "invalido");
    return NextResponse.redirect(destino);
  }
  const r = NextResponse.redirect(destino);
  r.cookies.set(COOKIE_ACESSO, decodeURIComponent(codigo).trim(), opcoesCookie);
  return r;
}
