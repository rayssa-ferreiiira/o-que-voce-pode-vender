import { NextResponse } from "next/server";
import { adminLogado, CHAVES_CONFIG, salvarConfig } from "@/lib/sessao";

export async function POST(req: Request) {
  if (!(await adminLogado())) return NextResponse.json({ erro: "não autorizado" }, { status: 401 });
  const form = await req.formData();
  for (const k of CHAVES_CONFIG) {
    const v = form.get(k);
    if (typeof v === "string") await salvarConfig(k, v.trim().slice(0, 500));
  }
  return NextResponse.redirect(new URL("/admin?salvo=1", req.url), 303);
}
