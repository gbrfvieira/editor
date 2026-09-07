# @pascal-app/quote

Calcula um orçamento a partir de um `CutListReport`, do resultado de nesting e
de uma `PriceTable`. O valor da chapa é cobrado pela área total das chapas
compradas (`sheetCount × largura × altura`), não apenas pela área ocupada pelos
painéis. A área usa metros quadrados e os preços são aplicados por material;
quando o material não existe no painel, usa-se a chave `default`.

Fita de borda e ferragens são somadas do cutlist. `laborMultiplier`, quando
informado, é aplicado sobre o subtotal final (por exemplo, `1.3` acrescenta
30%). A tabela de preços e as medidas da chapa são responsabilidade do
chamador.

`toQuoteText(report)` gera uma representação textual simples com cada item,
quantidade, preço unitário, total da linha, subtotal e total final.

`brazilianPricePreset(15 | 18)` fornece valores indicativos em BRL para
espessuras comuns de MDF, fita de borda e ferragem, incluindo um preço
opcional de mão de obra por m² de painel. Os preços são configuráveis e devem
ser substituídos por uma cotação atual de fornecedor.

Os presets também expõem um preço de chapa `default`. Ele é usado quando a
cena tem um nome de material personalizado sem chave correspondente na tabela,
evitando que o material seja orçado silenciosamente como zero.
