# @pascal-app/floorplan-import

Camada desacoplada que recebe paredes detectadas e gera patches compatíveis
com os quatro campos geométricos do nó `wall`: `start`, `end`, `thickness` e
`height`. `toWallNodePatches` filtra confidence abaixo de `0.5` por padrão e
usa altura padrão de 2,7 m. `commitWalls` recebe a API da cena por injeção e
cria um nó por patch (`type: 'wall'`).

`summarizeImport` retorna contagem, comprimento total, confidence média e as
paredes abaixo de `0.6` que precisam de revisão. Os tipos são locais de
propósito, para o pacote não depender dos extratores nem do store da cena.
