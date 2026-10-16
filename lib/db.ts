import postgres from "postgres";


declare global {
  // eslint-disable-next-line no-var
  var __sql: ReturnType<typeof postgres> | undefined;
  // eslint-disable-next-line no-var
  var __migrado: Promise<void> | undefined;
}

function cliente() {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL || "";
  if (!url) throw new Error("DATABASE_URL não configurada");
  const local = /localhost|127\.0\.0\.1/.test(url);
  return postgres(url, { ssl: local ? false : "require", max: 5, idle_timeout: 20, prepare: false });
}

function sqlCliente() {
  return (globalThis.__sql ??= cliente());
}

const MIGRACAO = `
create table if not exists conversas (
  id uuid primary key,
  nome text not null default '',
  email text,
  mensagens jsonb not null default '[]',
  estado jsonb not null default '{}',
  fase text not null default 'explorando',
  mapa jsonb,
  mapa_status text not null default 'nenhum',
  mapa_iniciado timestamptz,
  conta_no_limite boolean not null default false,
  teste boolean not null default false,
  criado timestamptz not null default now(),
  atualizado timestamptz not null default now()
);
create index if not exists conversas_email on conversas (email);
create table if not exists config (chave text primary key, valor text not null default '');
create table if not exists uso_ia (
  id bigserial primary key,
  conversa_id uuid,
  tipo text not null,
  modelo text not null,
  entrada int not null default 0,
  saida int not null default 0,
  cache_escrita int not null default 0,
  cache_leitura int not null default 0,
  custo_usd numeric(12,6) not null default 0,
  ms int not null default 0,
  criado timestamptz not null default now()
);
create index if not exists uso_ia_conversa on uso_ia (conversa_id);
create table if not exists buscas (id bigserial primary key, quem text not null, email text not null, criado timestamptz not null default now());
`;

export function migrar() {
  return (globalThis.__migrado ??= sqlCliente().unsafe(MIGRACAO).then(() => undefined).catch((e) => {
    globalThis.__migrado = undefined;
    throw e;
  }));
}

export async function db() {
  await migrar();
  return sqlCliente();
}
