export type Cor = { r: number; g: number; b: number; a: number }

const PESO = [2, 4, 3] // percepção: verde pesa mais que vermelho e azul

// Paleta de k cores pela imagem: corte pela mediana + refinamento k-means.
// Escolhe cores "de verdade" da arte (amarelo continua amarelo), em vez de misturar tons.
export function paleta(dados: ImageData, k: number): Cor[] {
  const d = dados.data
  const total = d.length / 4
  const passo = Math.max(1, Math.floor(total / 60000))
  const px: number[] = []
  let transparente = false
  for (let i = 0; i < total; i++) {
    if (d[i * 4 + 3] < 128) {
      transparente = true
      continue
    }
    if (i % passo === 0) px.push(d[i * 4], d[i * 4 + 1], d[i * 4 + 2])
  }
  const n = px.length / 3
  const alvo = Math.max(1, transparente ? k - 1 : k)
  if (n === 0) return [{ r: 0, g: 0, b: 0, a: 0 }]

  // --- corte pela mediana ---
  let caixas: number[][] = [Array.from({ length: n }, (_, i) => i)]
  while (caixas.length < alvo) {
    let melhor = -1
    let melhorPeso = 0
    let canalMelhor = 0
    caixas.forEach((cx, ci) => {
      if (cx.length < 2) return
      for (let c = 0; c < 3; c++) {
        let mn = 255
        let mx = 0
        for (const i of cx) {
          const v = px[i * 3 + c]
          if (v < mn) mn = v
          if (v > mx) mx = v
        }
        const peso = (mx - mn) * PESO[c] * Math.sqrt(cx.length)
        if (peso > melhorPeso) {
          melhorPeso = peso
          melhor = ci
          canalMelhor = c
        }
      }
    })
    if (melhor < 0) break
    const cx = caixas[melhor].sort((a, b) => px[a * 3 + canalMelhor] - px[b * 3 + canalMelhor])
    const meio = cx.length >> 1
    caixas.splice(melhor, 1, cx.slice(0, meio), cx.slice(meio))
  }
  let cent = caixas.map((cx) => {
    let r = 0, g = 0, b = 0
    for (const i of cx) {
      r += px[i * 3]; g += px[i * 3 + 1]; b += px[i * 3 + 2]
    }
    return [r / cx.length, g / cx.length, b / cx.length]
  })

  // --- refinamento k-means ---
  for (let it = 0; it < 4; it++) {
    const soma = cent.map(() => [0, 0, 0, 0])
    for (let i = 0; i < n; i++) {
      const r = px[i * 3], g = px[i * 3 + 1], b = px[i * 3 + 2]
      let bi = 0
      let bd = Infinity
      for (let c = 0; c < cent.length; c++) {
        const dr = r - cent[c][0], dg = g - cent[c][1], db = b - cent[c][2]
        const dist = PESO[0] * dr * dr + PESO[1] * dg * dg + PESO[2] * db * db
        if (dist < bd) {
          bd = dist
          bi = c
        }
      }
      soma[bi][0] += r; soma[bi][1] += g; soma[bi][2] += b; soma[bi][3]++
    }
    cent = cent.map((c, i) => (soma[i][3] ? [soma[i][0] / soma[i][3], soma[i][1] / soma[i][3], soma[i][2] / soma[i][3]] : c))
  }

  const cores: Cor[] = cent.map((c) => ({ r: Math.round(c[0]), g: Math.round(c[1]), b: Math.round(c[2]), a: 255 }))
  if (transparente) cores.push({ r: 0, g: 0, b: 0, a: 0 })
  return cores
}
