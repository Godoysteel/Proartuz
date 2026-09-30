// Filtro de mediana 3x3 por canal (RGB): tira o ruído e os "anéis" de meio-tom que o JPEG cria nas bordas,
// mantendo os cantos e contornos nítidos. Alfa não é alterado.
export function mediana(dados: ImageData, passes: number) {
  const { width: w, height: h } = dados
  let origem = dados.data
  const v = new Int32Array(9)
  const troca = (a: number, b: number) => {
    if (v[a] > v[b]) {
      const t = v[a]
      v[a] = v[b]
      v[b] = t
    }
  }
  for (let p = 0; p < passes; p++) {
    const destino = new Uint8ClampedArray(origem)
    for (let y = 0; y < h; y++) {
      const y0 = Math.max(0, y - 1) * w
      const y1 = y * w
      const y2 = Math.min(h - 1, y + 1) * w
      for (let x = 0; x < w; x++) {
        const x0 = Math.max(0, x - 1)
        const x2 = Math.min(w - 1, x + 1)
        const i = (y1 + x) * 4
        if (origem[i + 3] === 0) continue
        for (let c = 0; c < 3; c++) {
          v[0] = origem[(y0 + x0) * 4 + c]; v[1] = origem[(y0 + x) * 4 + c]; v[2] = origem[(y0 + x2) * 4 + c]
          v[3] = origem[(y1 + x0) * 4 + c]; v[4] = origem[i + c]; v[5] = origem[(y1 + x2) * 4 + c]
          v[6] = origem[(y2 + x0) * 4 + c]; v[7] = origem[(y2 + x) * 4 + c]; v[8] = origem[(y2 + x2) * 4 + c]
          // rede de ordenação de Paeth: mediana de 9 valores
          troca(1, 2); troca(4, 5); troca(7, 8); troca(0, 1); troca(3, 4); troca(6, 7)
          troca(1, 2); troca(4, 5); troca(7, 8); troca(0, 3); troca(5, 8); troca(4, 7)
          troca(3, 6); troca(1, 4); troca(2, 5); troca(4, 7); troca(4, 2); troca(6, 4); troca(4, 2)
          destino[i + c] = v[4]
        }
      }
    }
    origem = destino
  }
  dados.data.set(origem)
}
