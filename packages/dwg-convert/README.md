# @pascal-app/dwg-convert

Converte um DWG para DXF chamando localmente o ODA File Converter. O caminho
pode ser definido por `ODA_FILE_CONVERTER_PATH`; sem override, são varridos os
diretórios comuns do Windows em `Program Files` e subdiretórios do ODA.

`convertDwgToDxf(dwgPath, outDir)` retorna `{ ok: true, dxfPath }` ou um erro
estruturado (`converter_not_found`/`conversion_failed`).

## Sintaxe do ODA

Segundo a [documentação oficial do ODA File Converter](https://www.opendesign.com/guestfiles/oda_file_converter),
a CLI recebe diretório de origem, diretório de destino, versão/tipo de saída,
flag recursiva e flag de auditoria, nesta ordem. Este pacote chama:

`ODAFileConverter.exe <inputDir> <outputDir> ACAD2018 DXF 0 1`

O ODA processa diretórios, não um arquivo isolado; por isso a API passa o
diretório pai do DWG e verifica o DXF esperado na pasta de saída. `0` desativa
a recursão e `1` habilita auditoria/reparo. O timeout é de dois minutos e o
utilitário não instala o ODA automaticamente.
