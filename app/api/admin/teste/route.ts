import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { adminLogado, uuidValido } from "@/lib/sessao";

export async function POST(req: Request) {
  if (!(await adminLogado())) return NextResponse.json({ erro: "não autorizado" }, { status: 401 });
  const form = await req.formData();
  const id = String(form.get("id") ?? "");
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const teste = form.get("teste") === "1";
  const sql = await db();
  if (email) await sql`update conversas set teste = ${teste} where email = ${email}`;
  else if (uuidValido(id)) await sql`update conversas set teste = ${teste} where id = ${id}`;
  return NextResponse.redirect(new URL(String(form.get("volta") || "/admin"), req.url), 303);
}
