import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import { db } from "@/lib/db";
import { COOKIE_EMAIL, conversasDoEmail, emailValido, opcoesCookie, temAcesso } from "@/lib/sessao";

async function lista(email: string) {
  return (await conversasDoEmail(email))
    .filter((c) => c.mapa?.hipotese?.frase && c.mapa_status === "pronto")
    .map((c) => ({ id: c.id, frase: c.mapa!.hipotese.frase, em: c.atualizado }));
}

export async function GET() {
  const email = (await cookies()).get(COOKIE_EMAIL)?.value;
  if (!email) return NextResponse.json({ email: null, mapas: [] });
  return NextResponse.json({ email, mapas: await lista(email) });
}

export async function POST(req: Request) {
  if (!(await temAcesso())) return NextResponse.json({ erro: "Entre primeiro com o código de acesso da sua compra." }, { status: 401 });
  const { email: bruto } = (await req.json().catch(() => ({}))) as { email?: string };
  const email = (bruto ?? "").trim().toLowerCase();
  if (!emailValido(email)) return NextResponse.json({ erro: "Esse email não parece certo." }, { status: 400 });

  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || "local";
  const sql = await db();
  const [{ n }] = await sql<{ n: number }[]>`select count(distinct email)::int as n from buscas where quem = ${ip} and criado > now() - interval '1 hour' and email <> ${email}`;
  if (n >= 5) return NextResponse.json({ erro: "Muitas buscas seguidas. Tenta de novo daqui a pouco." }, { status: 429 });
  await sql`insert into buscas (quem, email) values (${ip}, ${email})`;

  const mapas = await lista(email);
  const r = NextResponse.json({ email, mapas });
  if (mapas.length) r.cookies.set(COOKIE_EMAIL, email, opcoesCookie);
  return r;
}

export async function DELETE() {
  const r = NextResponse.json({ ok: true });
  r.cookies.delete(COOKIE_EMAIL);
  return r;
}
