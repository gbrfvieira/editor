# PDF vector extract

`extractPdfVectorSegments(pdfBytes)` percorre o `getOperatorList()` de cada
página e retorna `{ pageIndex, segments }`, com pontos `[x, y]` já transformados
pela matriz de transformação da página.

Curvas são reduzidas a um segmento entre o ponto atual e o fim da curva. Texto,
imagens e estilos (camada, cor e espessura) não são preservados nesta v1.
