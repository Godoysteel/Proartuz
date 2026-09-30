import type { Proposta } from './types'
import { contraste, rgb } from './pdf'
import { QUADRO_H, dataBR, desenharQuadro } from './util'

// Réplica em canvas da capa gerada no PDF (mesmas medidas em mm), para pré-visualizar e enquadrar a foto.
const W = 210
const H = 297
const M = 16
const PT = 0.3528 // mm por ponto

const css = (c: [number, number, number]) => `rgb(${c[0]},${c[1]},${c[2]})`

export function desenharCapa(
  ctx: CanvasRenderingContext2D,
  cw: number,
  p: Proposta,
  foto: HTMLImageElement | null,
  logo: HTMLImageElement | null,
) {
  const k = cw / W
  const { capa } = p
  const cor = rgb(capa.cor)
  ctx.clearRect(0, 0, cw, H * k)
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, cw, H * k)
  ctx.textBaseline = 'alphabetic'

  const rect = (x: number, y: number, w: number, h: number, c: string) => {
    ctx.fillStyle = c
    ctx.fillRect(x * k, y * k, w * k, h * k)
  }
  const desenharLogo = (x: number, y: number, maxW: number, maxH: number) => {
    if (!logo) return
    const s = Math.min(maxW / logo.width, maxH / logo.height)
    ctx.drawImage(logo, x * k, y * k, logo.width * s * k, logo.height * s * k)
  }
  const fonte = (pt: number, bold = false) => {
    ctx.font = `${bold ? 'bold ' : ''}${pt * PT * k}px Helvetica, Arial, sans-serif`
  }
  const quebrar = (t: string, larg: number) => {
    const linhas: string[] = []
    let atual = ''
    for (const w of t.split(/\s+/)) {
      const teste = atual ? atual + ' ' + w : w
      if (atual && ctx.measureText(teste).width > larg * k) {
        linhas.push(atual)
        atual = w
      } else atual = teste
    }
    if (atual) linhas.push(atual)
    return linhas
  }

  const texto = (y: number, c: [number, number, number], x: number) => {
    const larg = W - x - M
    ctx.fillStyle = css(c)
    fonte(34, true)
    const t = quebrar(capa.titulo || 'PROPOSTA', larg)
    t.forEach((l, i) => ctx.fillText(l, x * k, (y + i * 13) * k))
    y += t.length * 13 + 2
    rect(x, y, 30, 1.6, capa.estilo === 'faixa' ? css(cor) : css(c))
    y += 12
    ctx.fillStyle = css(c)
    fonte(15)
    if (capa.subtitulo) {
      const s = quebrar(capa.subtitulo, larg)
      s.forEach((l, i) => ctx.fillText(l, x * k, (y + i * 7) * k))
      y += s.length * 7 + 4
    }
    if (p.cliente.nome) {
      fonte(11)
      ctx.fillText('Preparada para', x * k, y * k)
      fonte(15, true)
      const n = quebrar(p.cliente.nome, larg)
      n.forEach((l, i) => ctx.fillText(l, x * k, (y + 7 + i * 7) * k))
      y += 7 + n.length * 7
    }
    fonte(10)
    ctx.fillText(`${dataBR(p.data)}  |  Válida até ${dataBR(p.data, p.validadeDias)}`, x * k, (y + 8) * k)
    if (p.emitente.nome) ctx.fillText(p.emitente.nome, x * k, (H - 22) * k)
  }

  if (capa.estilo === 'imagem') {
    rect(0, 0, W, H, css(cor))
    if (foto) {
      desenharQuadro(ctx, foto, W * k, QUADRO_H * k, capa.imgZoom ?? 1, capa.imgX ?? 0.5, capa.imgY ?? 0.5)
    } else {
      rect(0, 0, W, QUADRO_H, '#d9dee3')
      ctx.fillStyle = '#6b7885'
      fonte(14)
      ctx.textAlign = 'center'
      ctx.fillText('Escolha a foto da capa', (W / 2) * k, (QUADRO_H / 2) * k)
      ctx.textAlign = 'left'
    }
    desenharLogo(M + 6, QUADRO_H + 8, 60, 20)
    texto(QUADRO_H + (logo ? 46 : 32), contraste(capa.cor), M + 6)
  } else if (capa.estilo === 'faixa') {
    rect(0, 0, 38, H, css(cor))
    rect(38, H - 14, W - 38, 14, css(cor))
    desenharLogo(58, 24, 70, 30)
    texto(H / 2 - 20, [30, 30, 30], 58)
  } else {
    rect(0, 0, W, H, css(cor))
    desenharLogo(M + 6, 26, 70, 30)
    texto(H / 2 - 20, contraste(capa.cor), M + 6)
  }
}
