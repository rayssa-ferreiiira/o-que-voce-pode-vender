import { cookies } from "next/headers";
import { db } from "./db";
import type { Estado, Fase, Mapa, Mensagem } from "./tipos";

export const COOKIE_ACESSO = "ovpv_acesso";
export const COOKIE_CONVERSA = "ovpv_conversa";
export const COOKIE_EMAIL = "ovpv_email";
export const COOKIE_ADMIN = "ovpv_admin";
const UM_ANO = 60 * 60 * 24 * 365;
export const opcoesCookie = { path: "/", maxAge: UM_ANO, httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const };

export const CONVERSAS_POR_EMAIL = 3;
export const CHAVES_CONFIG = ["codigo_acesso", "url_p2", "url_trama", "cambio", "preco_venda", "taxa_plataforma", "custo_fixo_mes"] as const;
export const MAX_MENSAGENS_CLIENTE = 34;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const uuidValido = (v: string | undefined | null): v is string => Boolean(v && UUID.test(v));

const cacheConfig = new Map<string, { valor: string; ate: number }>();
export async function config(chave: string): Promise<string> {
  const c = cacheConfig.get(chave);
  if (c && c.ate > Date.now()) return c.valor;
  const sql = await db();
  const [linha] = await sql<{ valor: string }[]>`select valor from config where chave = ${chave}`;
  const valor = linha?.valor ?? "";
  cacheConfig.set(chave, { valor, ate: Date.now() + 30_000 });
  return valor;
}
export async function salvarConfig(chave: string, valor: string) {
  const sql = await db();
  await sql`insert into config (chave, valor) values (${chave}, ${valor}) on conflict (chave) do update set valor = excluded.valor`;
  cacheConfig.delete(chave);
}

export async function codigoValido(codigo: string | undefined): Promise<boolean> {
  if (!codigo) return false;
  const certo = await config("codigo_acesso");
  return Boolean(certo) && codigo.trim().toUpperCase() === certo.trim().toUpperCase();
}

export async function temAcesso() {
  const c = await cookies();
  return codigoValido(c.get(COOKIE_ACESSO)?.value);
}

export async function adminLogado(req?: Request) {
  const senha = process.env.ADMIN_SENHA;
  if (!senha) return false;
  if (req?.headers.get("x-admin-senha") === senha) return true;
  const c = await cookies();
  return c.get(COOKIE_ADMIN)?.value === senha;
}

export type Conversa = {
  id: string;
  nome: string;
  email: string | null;
  mensagens: Mensagem[];
  estado: Estado;
  fase: Fase;
  mapa: Mapa | null;
  mapa_status: "nenhum" | "gerando" | "pronto" | "erro";
  mapa_iniciado: Date | null;
  teste: boolean;
  criado: Date;
  atualizado: Date;
};

export async function buscarConversa(id: string | undefined | null): Promise<Conversa | null> {
  if (!uuidValido(id)) return null;
  const sql = await db();
  const [c] = await sql<Conversa[]>`select * from conversas where id = ${id}`;
  return c ?? null;
}

export async function conversaAtual() {
  const c = await cookies();
  return buscarConversa(c.get(COOKIE_CONVERSA)?.value);
}

export async function conversasDoEmail(email: string) {
  const sql = await db();
  return sql<Conversa[]>`select * from conversas where email = ${email.trim().toLowerCase()} order by atualizado desc`;
}

export function emailValido(t: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(t.trim()) && t.length <= 200;
}
