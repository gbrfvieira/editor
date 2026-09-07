# @pascal-app/dwg-convert

Converte um DWG para DXF chamando localmente o ODA File Converter. O caminho
pode ser definido por `ODA_FILE_CONVERTER_PATH`; sem override, são varridos os
diretórios comuns do Windows em `Program Files` e subdiretórios cujo nome
começa por `ODA`.

`convertDwgToDxf(dwgPath, outDir)` retorna `{ ok: true, dxfPath }` ou um erro
estruturado (`converter_not_found`/`conversion_failed`).

### Sintaxe do ODA

Segundo a documentação oficial do ODA File Converter
([ODA File Converter](https://www.opendesign.com/guestfiles/oda_file_converter)),
a CLI recebe, nesta ordem, diretório de origem, diretório de destino, versão de
saída, tipo de saída, flag recursiva e flag de auditoria. Este pacote usa:

`ODAFileConverter.exe <inputDir> <outputDir> ACAD2018 DXF 0 1`

O ODA trabalha em diretórios (não em um arquivo isolado), portanto a API passa
o diretório pai do DWG e verifica a existência do DXF esperado. A conversão
usa `ACAD2018`, sem recursão e com auditoria habilitada. O processo tem timeout
de dois minutos; o utilitário não tenta instalar o ODA automaticamente.
