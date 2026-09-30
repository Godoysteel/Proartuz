import type { Parte, Proposta } from './types'

export const uid = () => Math.random().toString(36).slice(2, 10)

export const brl = (n: number) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export const hoje = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export const dataBR = (iso: string, addDias = 0) => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d + addDias).toLocaleDateString('pt-BR')
}

export const totais = (p: Proposta) => {
  const subtotal = p.itens.reduce((s, i) => s + i.qtd * i.valor, 0)
  return { subtotal, total: Math.max(0, subtotal - p.desconto) }
}

const parteVazia = (): Parte => ({ nome: '', documento: '', endereco: '', email: '', telefone: '' })

const emitentePadrao = (): Parte => {
  try {
    const s = localStorage.getItem('emitente')
    if (s) return JSON.parse(s)
  } catch {
    /* ignora */
  }
  return parteVazia()
}

export const novaProposta = (): Proposta => ({
  id: uid(),
  atualizadaEm: Date.now(),
  data: hoje(),
  validadeDias: 30,
  emitente: emitentePadrao(),
  cliente: parteVazia(),
  capa: { estilo: 'solida', cor: '#0f3d5e', titulo: 'PROPOSTA COMERCIAL', subtitulo: '', imagem: '' },
  logo: localStorage.getItem('logo') ?? '',
  apresentacao: '',
  itens: [{ id: uid(), descricao: '', detalhe: '', qtd: 1, valor: 0 }],
  desconto: 0,
  secoes: [
    { id: uid(), titulo: 'PRAZO DE PAGAMENTO', texto: 'ENTRADA: 50% ANTECIPADO\nSALDO FINAL NA ENTREGA' },
    { id: uid(), titulo: 'PRAZO DE EXECUÇÃO', texto: '' },
    { id: uid(), titulo: 'GARANTIA', texto: '' },
  ],
})

// Recorta a imagem para a proporção desejada (cover) e reduz o tamanho.
export const carregarImagem = (file: File, w: number, h: number, quality = 0.85): Promise<string> =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const c = document.createElement('canvas')
      c.width = w
      c.height = h
      const ctx = c.getContext('2d')!
      const s = Math.max(w / img.width, h / img.height)
      const dw = img.width * s
      const dh = img.height * s
      ctx.fillStyle = '#fff'
      ctx.fillRect(0, 0, w, h)
      ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh)
      URL.revokeObjectURL(url)
      resolve(c.toDataURL('image/jpeg', quality))
    }
    img.onerror = reject
    img.src = url
  })

// Logo: mantém proporção (PNG para preservar transparência).
export const carregarLogo = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const s = Math.min(1, 500 / Math.max(img.width, img.height))
      const c = document.createElement('canvas')
      c.width = Math.round(img.width * s)
      c.height = Math.round(img.height * s)
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
      URL.revokeObjectURL(url)
      resolve(c.toDataURL('image/png'))
    }
    img.onerror = reject
    img.src = url
  })
