export type Parte = {
  nome: string
  documento: string
  endereco: string
  email: string
  telefone: string
}

export type Item = { id: string; descricao: string; detalhe: string; qtd: number; valor: number }

export type Secao = { id: string; titulo: string; texto: string }

export type CoverStyle = 'solida' | 'faixa' | 'imagem'

export type Capa = {
  estilo: CoverStyle
  cor: string
  titulo: string
  subtitulo: string
  imagem: string // dataURL, usado no estilo "imagem"
}

export type Proposta = {
  id: string
  atualizadaEm: number
  data: string // yyyy-mm-dd
  validadeDias: number
  emitente: Parte
  cliente: Parte
  capa: Capa
  logo: string // dataURL
  apresentacao: string
  itens: Item[]
  desconto: number
  secoes: Secao[]
}
