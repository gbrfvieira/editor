# @pascal-app/cutlist

Gera um plano de corte a partir de uma lista de nós de armário (ou objetos
estruturalmente compatíveis com `CabinetNode`/`CabinetModuleNode`). As medidas
de entrada são em metros; `panels` e `edgeBanding` saem em milímetros.

`createCutList(cabinets)` retorna `{ panels, hardware, edgeBanding }` e
`toCsv(report)` serializa as três seções para CSV.

Esta v1 cobre apenas painéis de carcaça, portas, frentes, prateleiras e as
ferragens especificadas. A fita de borda é uma aproximação: usa o perímetro
completo de cada frente visível e não modela lados realmente colados, rasgos,
folgas ou orientação de veio.

A regra de dobradiça é simples: duas dobradiças por folha até 900 mm, três
acima disso. Portas duplas aplicam a regra a cada folha independentemente.

`toPdf(report, nesting?)` gera um PDF imprimível sem dependências externas,
contendo painéis, ferragens, fita de borda e (se fornecido) o plano de
aproveitamento de chapas.

Passe `{ hardwareBrand: 'blum' | 'hafele' | 'fgv' }` para `createCutList` pra
anotar as ferragens com nomes de produto representativos. O padrão genérico
mantém o formato original (só o item). Os presets de preço brasileiros em
`@pascal-app/quote` são valores indicativos em BRL e devem ser substituídos
pela tabela de preço atual do fornecedor.
