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
  imagem: string // dataURL (original reduzida), usado no estilo "imagem"
  imgZoom?: number // 1 = preenche o quadro; até 4
  imgX?: number // 0..1 posição horizontal do enquadramento
  imgY?: number // 0..1 posição vertical do enquadramento
}

export type Proposta = {
  id: string
  numero: number // sequencial, editável
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
  ocultarTotal?: boolean // esconde o bloco Valor / Desconto / Valor total no PDF
  secoes: Secao[]
}
