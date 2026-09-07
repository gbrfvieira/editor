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
