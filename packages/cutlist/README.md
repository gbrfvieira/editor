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
