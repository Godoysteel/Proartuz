import { jsPDF } from 'jspdf'
import type { Proposta } from './types'
import { QUADRO_H, brl, fmtNum, dataBR, recortarQuadro, totais } from './util'

const W = 210
const H = 297
const M = 16 // margem lateral
const CW = W - M * 2

export const rgb = (hex: string): [number, number, number] => {
  const h = hex.replace('#', '')
  const n = parseInt(h.length === 3 ? h.replace(/./g, '$&$&') : h, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

// Escolhe texto claro ou escuro conforme a cor de fundo.
export const contraste = (hex: string): [number, number, number] => {
  const [r, g, b] = rgb(hex)
  return (r * 299 + g * 587 + b * 114) / 1000 > 160 ? [30, 30, 30] : [255, 255, 255]
}

const dimensoesLogo = (dataUrl: string): Promise<{ w: number; h: number }> =>
  new Promise((res) => {
    const img = new Image()
    img.onload = () => res({ w: img.width, h: img.height })
    img.onerror = () => res({ w: 1, h: 1 })
    img.src = dataUrl
  })

export async function gerarPdf(p: Proposta): Promise<{ blob: Blob; nome: string }> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const cor = rgb(p.capa.cor)
  const logo = p.logo ? await dimensoesLogo(p.logo) : null

  const desenharLogo = (x: number, y: number, maxW: number, maxH: number, alignRight = false) => {
    if (!p.logo || !logo) return 0
    const s = Math.min(maxW / logo.w, maxH / logo.h)
    const w = logo.w * s
    const h = logo.h * s
    doc.addImage(p.logo, 'PNG', alignRight ? x - w : x, y, w, h)
    return w
  }

  // ---------- CONTEÚDO ----------
  let y = 0
  const rodape = () => {
    doc.setDrawColor(210)
    doc.line(M, H - 17, W - M, H - 17)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(120)
    const l1 = [p.emitente.nome, p.emitente.documento].filter(Boolean).join(' | ')
    doc.text(l1, M, H - 12)
    if (p.emitente.endereco) doc.text(p.emitente.endereco, M, H - 8, { maxWidth: CW - 20 })
    doc.text(`Página ${doc.getNumberOfPages()}`, W - M, H - 12, { align: 'right' })
  }
  const novaPagina = () => {
    doc.addPage()
    y = 20
    rodape()
  }
  const garante = (h: number) => {
    if (y + h > H - 22) novaPagina()
  }
  const titulo = (t: string) => {
    garante(16)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(...cor)
    doc.text(t.toUpperCase(), M, y)
    doc.setFillColor(...cor)
    doc.rect(M, y + 1.8, 14, 0.8, 'F')
    y += 8
  }
  const paragrafo = (t: string, size = 9.5, cinza = 50) => {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(size)
    doc.setTextColor(cinza)
    const lh = size * 0.42
    for (const bloco of t.split('\n')) {
      const linhas = doc.splitTextToSize(bloco || ' ', CW)
      for (const l of linhas) {
        garante(lh + 1)
        doc.text(l, M, y)
        y += lh + 0.6
      }
    }
    y += 3
  }

  // ---------- FAIXA DO TÍTULO (foto ou cor de fundo) ----------
  const { capa } = p
  const comFoto = capa.estilo === 'imagem' && !!capa.imagem
  const HB = QUADRO_H
  if (comFoto) {
    const recorte = await recortarQuadro(capa.imagem, capa.imgZoom ?? 1, capa.imgX ?? 0.5, capa.imgY ?? 0.5)
    doc.addImage(recorte, 'JPEG', 0, 0, W, HB)
    doc.setGState(new (doc as any).GState({ opacity: 0.5 }))
    doc.setFillColor(0, 0, 0)
    doc.rect(0, 0, W, HB, 'F')
    doc.setGState(new (doc as any).GState({ opacity: 1 }))
  } else {
    doc.setFillColor(...cor)
    doc.rect(0, 0, W, HB, 'F')
  }
  const tc = comFoto ? ([255, 255, 255] as [number, number, number]) : contraste(capa.cor)
  desenharLogo(W - M, 8, 40, 16, true)
  doc.setTextColor(...tc)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text(`PROPOSTA Nº ${fmtNum(p.numero)}`, M, 15)
  doc.setFontSize(24)
  const larguraTitulo = CW - (p.logo ? 46 : 0)
  const tl = doc.splitTextToSize(capa.titulo || 'PROPOSTA', larguraTitulo).slice(0, 2)
  let ty = 24
  doc.text(tl, M, ty)
  ty += tl.length * 10 + 1
  doc.setFillColor(...tc)
  doc.rect(M, ty, 24, 1.2, 'F')
  ty += 8
  if (capa.subtitulo) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(11)
    doc.text(doc.splitTextToSize(capa.subtitulo, CW).slice(0, 2), M, ty)
  }
  if (p.cliente.nome) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.text('PREPARADA PARA', M, HB - 17)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(13)
    doc.text(doc.splitTextToSize(p.cliente.nome, CW * 0.6)[0], M, HB - 10)
  }
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text(`${dataBR(p.data)}  |  Válida até ${dataBR(p.data, p.validadeDias)}`, W - M, HB - 10, { align: 'right' })
  rodape()
  y = HB + 14

  // Quadro emitente / cliente
  const col = CW / 2 - 3
  const bloco = (x: number, rotulo: string, linhas: string[]) => {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(...cor)
    doc.text(rotulo.toUpperCase(), x, y)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9.5)
    doc.setTextColor(40)
    let yy = y + 5.5
    for (const l of linhas.filter(Boolean)) {
      const t = doc.splitTextToSize(l, col)
      doc.text(t, x, yy)
      yy += t.length * 4.4
    }
    return yy
  }
  const yTopo = y
  doc.setFillColor(245, 247, 249)
  const eLin = [p.emitente.nome, p.emitente.documento && `CNPJ/CPF: ${p.emitente.documento}`, p.emitente.endereco, p.emitente.email, p.emitente.telefone]
  const cLin = [p.cliente.nome, p.cliente.documento, p.cliente.endereco, p.cliente.email, p.cliente.telefone]
  const alt = Math.max(
    eLin.filter(Boolean).reduce((n: number, l) => n + doc.splitTextToSize(String(l), col).length * 4.4, 0) + 10,
    cLin.filter(Boolean).reduce((s, l) => s + doc.splitTextToSize(l, col).length * 4.4, 0) + 10,
  )
  doc.roundedRect(M - 3, yTopo - 5, CW + 6, alt + 2, 2, 2, 'F')
  const y1 = bloco(M, 'Proposta enviada por', eLin)
  y = yTopo
  const y2 = bloco(M + CW / 2 + 3, 'Para', cLin)
  y = Math.max(y1, y2) + 6

  // Apresentação
  if (p.apresentacao.trim()) {
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(10.5)
    doc.setTextColor(60)
    const t = doc.splitTextToSize(p.apresentacao, CW - 6)
    for (const l of t) {
      garante(6)
      doc.text(l, M + 4, y)
      y += 5
    }
    doc.setFillColor(...cor)
    doc.rect(M, y - t.length * 5 - 3.5, 1, t.length * 5 + 2, 'F')
    y += 6
  }

  // Produtos e serviços
  titulo('Produtos e serviços')
  const cQtd = M + CW - 62
  const cUn = M + CW - 40
  const cTot = M + CW
  doc.setFillColor(...cor)
  doc.rect(M, y - 4.5, CW, 7, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.5)
  doc.setTextColor(...contraste(p.capa.cor))
  doc.text('ITEM', M + 2, y)
  doc.text('QTD', cQtd, y, { align: 'right' })
  doc.text('UNITÁRIO', cUn, y, { align: 'right' })
  doc.text('TOTAL', cTot - 2, y, { align: 'right' })
  y += 7
  p.itens.filter((i) => i.descricao.trim()).forEach((i, idx) => {
    const d = doc.splitTextToSize(i.descricao, cQtd - M - 22)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    const det = i.detalhe.trim() ? doc.splitTextToSize(i.detalhe, cQtd - M - 22) : []
    const h = d.length * 4.4 + det.length * 3.8 + 3
    garante(h)
    if (idx % 2 === 1) {
      doc.setFillColor(247, 248, 250)
      doc.rect(M, y - 4, CW, h, 'F')
    }
    doc.setTextColor(30)
    doc.setFont('helvetica', 'bold')
    doc.text(d, M + 2, y)
    doc.setFont('helvetica', 'normal')
    doc.text(String(i.qtd).replace('.', ','), cQtd, y, { align: 'right' })
    doc.text(brl(i.valor), cUn, y, { align: 'right' })
    doc.text(brl(i.qtd * i.valor), cTot - 2, y, { align: 'right' })
    if (det.length) {
      doc.setFontSize(8)
      doc.setTextColor(110)
      doc.text(det, M + 2, y + d.length * 4.4 - 0.4)
    }
    y += h
  })
  y += 2

  // Totais (podem ser ocultados no PDF)
  const { subtotal, total } = totais(p)
  if (!p.ocultarTotal) {
    garante(30)
    const linha = (r: string, v: string, forte = false) => {
      doc.setFont('helvetica', forte ? 'bold' : 'normal')
      doc.setFontSize(forte ? 12 : 9.5)
      doc.setTextColor(forte ? cor[0] : 60, forte ? cor[1] : 60, forte ? cor[2] : 60)
      doc.text(r, W - M - 62, y)
      doc.text(v, W - M, y, { align: 'right' })
      y += forte ? 7 : 5.5
  }
  doc.setDrawColor(210)
  doc.line(W - M - 70, y - 4, W - M, y - 4)
  linha('Valor', brl(subtotal))
  linha('Desconto', `- ${brl(p.desconto)}`)
  doc.line(W - M - 70, y - 3.5, W - M, y - 3.5)
  y += 2
  linha('Valor total', brl(total), true)
  y += 6
  }

  // Seções livres
  for (const s of p.secoes) {
    if (!s.texto.trim()) continue
    titulo(s.titulo || 'Informações')
    paragrafo(s.texto)
  }

  const nomeArq = `proposta-${fmtNum(p.numero)}-${(p.cliente.nome || 'cliente').toLowerCase().normalize('NFD').replace(/[^\w]+/g, '-').replace(/^-|-$/g, '')}-${p.data}.pdf`
  return { blob: doc.output('blob'), nome: nomeArq }
}
