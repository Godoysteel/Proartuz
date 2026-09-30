import type { Proposta } from './types'
import { contraste, rgb } from './pdf'
import { QUADRO_H, dataBR, desenharQuadro } from './util'

// Réplica em canvas da 1ª página do PDF (mesmas medidas em mm): faixa do título com a foto de fundo
// e um esquema do restante do conteúdo. Serve para enquadrar a foto vendo o formato real.
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
  const HB = QUADRO_H
  ctx.clearRect(0, 0, cw, H * k)
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, cw, H * k)
  ctx.textBaseline = 'alphabetic'
  ctx.textAlign = 'left'

  const rect = (x: number, y: number, w: number, h: number, c: string) => {
    ctx.fillStyle = c
    ctx.fillRect(x * k, y * k, w * k, h * k)
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

  // --- faixa do título ---
  const comFoto = capa.estilo === 'imagem'
  if (comFoto && foto) {
    desenharQuadro(ctx, foto, W * k, HB * k, capa.imgZoom ?? 1, capa.imgX ?? 0.5, capa.imgY ?? 0.5)
    ctx.fillStyle = 'rgba(0,0,0,0.5)'
    ctx.fillRect(0, 0, W * k, HB * k)
  } else if (comFoto) {
    rect(0, 0, W, HB, '#8a96a3')
  } else {
    rect(0, 0, W, HB, css(cor))
  }
  const tc: [number, number, number] = comFoto ? [255, 255, 255] : contraste(capa.cor)
  ctx.fillStyle = css(tc)

  if (logo) {
    const s = Math.min(40 / logo.width, 16 / logo.height)
    const w = logo.width * s
    ctx.drawImage(logo, (W - M - w) * k, 8 * k, w * k, logo.height * s * k)
  }
  fonte(24, true)
  const tl = quebrar(capa.titulo || 'PROPOSTA', CW() - (logo ? 46 : 0)).slice(0, 2)
  let ty = 24
  tl.forEach((l, i) => ctx.fillText(l, M * k, (ty + i * 10) * k))
  ty += tl.length * 10 + 1
  rect(M, ty, 24, 1.2, css(tc))
  ty += 8
  fonte(11)
  ctx.fillStyle = css(tc)
  if (capa.subtitulo) quebrar(capa.subtitulo, CW()).slice(0, 2).forEach((l, i) => ctx.fillText(l, M * k, (ty + i * 5) * k))
  if (p.cliente.nome) {
    fonte(8)
    ctx.fillText('PREPARADA PARA', M * k, (HB - 17) * k)
    fonte(13, true)
    ctx.fillText(quebrar(p.cliente.nome, CW() * 0.6)[0], M * k, (HB - 10) * k)
  }
  fonte(9)
  ctx.textAlign = 'right'
  ctx.fillText(`${dataBR(p.data)}  |  Válida até ${dataBR(p.data, p.validadeDias)}`, (W - M) * k, (HB - 10) * k)
  ctx.textAlign = 'left'

  // --- esquema do restante da página ---
  const cinza = '#e6eaee'
  let y = HB + 14
  rect(M - 3, y - 5, CW() + 6, 26, '#f5f7f9')
  rect(M, y, 30, 2, css(cor))
  rect(M + CW() / 2 + 3, y, 12, 2, css(cor))
  for (let i = 0; i < 3; i++) {
    rect(M, y + 6 + i * 5, 55 - i * 8, 2, cinza)
    rect(M + CW() / 2 + 3, y + 6 + i * 5, 60 - i * 10, 2, cinza)
  }
  y += 32
  rect(M, y, CW(), 2.5, cinza)
  rect(M, y + 5, CW() * 0.7, 2.5, cinza)
  y += 16
  rect(M, y, 40, 2, css(cor))
  rect(M, y + 4, CW(), 6, css(cor))
  rect(M, y + 12, CW(), 5, '#f7f8fa')
  rect(W - M - 40, y + 22, 40, 2.5, cinza)
  rect(W - M - 40, y + 28, 40, 3.5, css(cor))
  y += 44
  for (let b = 0; b < 3; b++) {
    rect(M, y, 34, 2, css(cor))
    rect(M, y + 5, CW(), 2, cinza)
    rect(M, y + 9, CW() * 0.8, 2, cinza)
    y += 20
  }
  rect(M, H - 17, CW(), 0.3, '#d2d2d2')
  rect(M, H - 13, 60, 1.5, cinza)

  function CW() {
    return W - M * 2
  }
}
