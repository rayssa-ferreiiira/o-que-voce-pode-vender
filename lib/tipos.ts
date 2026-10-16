export type Mensagem = { autor: "ray" | "cliente"; texto: string; em?: string };

export type Fase = "explorando" | "hipotese" | "email" | "concluida";

export type Provas = {
  situacoes: { momento: string; situacao: string; resultado: string }[];
  padroes: string[];
  demanda: string;
  jeitoAtuar: string;
  publico: string;
  tempo: string;
  foraDoTrabalho: boolean;
};

export type Estado = {
  nota?: string;
  provas?: Provas;
  frase?: string;
  fraseEm?: number;
  devolutivaHa?: number;
};

export const MODELOS = ["mentora", "consultora", "estrategista", "especialista"] as const;
export type Modelo = (typeof MODELOS)[number];
export const ROTULO_MODELO: Record<Modelo, string> = { mentora: "Mentora", consultora: "Consultora", estrategista: "Estrategista", especialista: "Especialista" };

export const TEMAS = ["dores", "posicionamento", "metodo", "produto", "oferta", "primeira venda"] as const;
export type Tema = (typeof TEMAS)[number];
export const ROTULO_TEMA: Record<Tema, string> = { dores: "Dores do público", posicionamento: "Posicionamento", metodo: "Método", produto: "Produto", oferta: "Oferta", "primeira venda": "Primeira venda" };

export type Sinais = { experiencia: number; reconhecimento: number; publico: number; aplicacao: number };

export type Mapa = {
  nome: string;
  hipotese: { frase: string; porque: string };
  sintese: string;
  trajetoria: { periodo: string; situacao: string; oQueFez: string; resultado: string }[];
  padroes: { padrao: string; evidencias: string[]; historias: number[] }[];
  resolve: string[];
  sinaisDemanda: { sinal: string; tipo: "procura" | "pagamento" | "problema recorrente" | "reconhecimento" }[];
  possibilidades: { direcao: string; sinais: Sinais; fundamentos: string[] }[];
  modelos: { modelo: Modelo; aderencia: number; porque: string; comoSeria: string }[];
  modeloRecomendado: Modelo;
  publico: { quem: string; momento: string; ondeEsta: string; frase: string; precisa: string };
  credibilidade: string[];
  descobrir: { tema: Tema; pergunta: string }[];
  lacunas: { secao: string; texto: string }[];
  geradoEm?: string;
};

export type MapaParcial = Partial<Mapa>;
