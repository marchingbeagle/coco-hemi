# AGENTS.md

Este arquivo define as regras de engenharia para o repositorio `coco-hemi`.
Ele deve ser lido antes de qualquer analise, alteracao, revisao ou geracao de
codigo neste projeto.

O objetivo e manter o app simples, rapido, seguro, visualmente consistente e
focado em edicao de fotos para redes sociais. Uma entrega so esta concluida
quando o comportamento solicitado foi implementado, os dados sensiveis continuam
fora do Git e a verificacao adequada foi executada.

## 1. Contexto do Projeto

`Coco Hemi` e um webapp Vite/React para:

- aplicar filtros locais em fotos com canvas;
- reconhecer pessoa/assunto com `@mediapipe/tasks-vision`;
- refinar mascara manualmente com pincel;
- gerar filtros com IA usando `gemini-2.5-flash-image` via Google AI Studio;
- salvar imagens geradas localmente no navegador com IndexedDB;
- exportar imagens em PNG para postagem em redes sociais.

Stack atual:

- Vite `7`;
- React `19`;
- JavaScript com JSX;
- CSS global em `src/styles.css`;
- shadcn/ui adaptado localmente em `src/components/ui`;
- `lucide-react` para icones;
- `@google/genai` para Gemini;
- `@mediapipe/tasks-vision` para segmentacao local;
- IndexedDB para historico local de imagens IA.

Arquivos principais:

```text
src/main.jsx                 # fluxo principal do editor, filtros, IA e canvas
src/styles.css               # tokens visuais, layout e estados responsivos
src/components/ui/*.jsx      # componentes base no padrao shadcn adaptado
src/lib/utils.js             # helper cn()
components.json              # configuracao shadcn
.env.example                 # variaveis ficticias
```

## 2. Principios Obrigatorios

- Entenda o fluxo existente antes de editar. Leia `src/main.jsx`,
  `src/styles.css` e componentes afetados.
- Faca a menor mudanca coerente que resolva o problema por completo.
- Preserve comportamento existente salvo quando a solicitacao pedir mudanca.
- Nao reverta alteracoes locais que nao foram feitas por voce.
- Nao refatore areas nao relacionadas a tarefa.
- Nao esconda problemas com tratamento generico, codigo morto ou mudancas de UI
  que apenas mascaram a falha.
- Nao considere so o caminho feliz: pense em foto ausente, formato invalido,
  falha de modelo IA, quota, browser sem IndexedDB, mobile e desktop.
- Sempre informe quais verificacoes foram executadas e quais nao puderam ser.

## 3. Seguranca e Dados Sensiveis

- Nunca commite `.env`, chaves Gemini, tokens, cookies, imagens privadas, logs ou
  dumps locais.
- `.env.example` deve conter apenas placeholders, como
  `VITE_GEMINI_API_KEY=your_gemini_api_key_here`.
- A chave `VITE_GEMINI_API_KEY` e publica no bundle por definicao do Vite. Nao
  trate isso como segredo de servidor. Evite exibir a chave na UI, logs ou erros.
- Nao copie valores reais de `.env` para mensagens, documentacao, commits ou
  exemplos.
- Mantenha `node_modules/`, `dist/`, `.agents/`, `.codex/` e arquivos temporarios
  fora do Git.
- Nao envie fotos para servicos externos exceto quando o usuario selecionar
  filtros IA, que usam Gemini explicitamente.
- Filtros normais e refinamento de mascara devem continuar 100% locais.

## 4. Fluxo de Trabalho

Antes de editar:

1. Rode `git status --short --branch`.
2. Verifique se ha mudancas locais e preserve o que nao pertence a tarefa.
3. Leia a implementacao afetada.
4. Confirme se a mudanca toca filtros locais, IA, canvas, persistencia local ou
   layout responsivo.

Durante a implementacao:

- Trabalhe em incrementos pequenos.
- Use os padroes existentes de estado, renderizacao e componentes.
- Evite introduzir dependencias para tarefas que podem ser resolvidas com a
  stack atual.
- Se mexer em download, exportacao ou geracao IA, teste falhas e estados de
  loading.
- Se mexer em UI, preserve responsividade mobile e desktop.

Antes de concluir:

```bash
npm run build
```

Quando possivel para mudancas visuais, tambem abra o app em navegador local e
verifique:

- desktop amplo;
- largura mobile;
- foto inteira visivel em zoom `1x`;
- ausencia de overflow inesperado;
- botoes com estado disabled/loading correto;
- fluxo principal por teclado quando aplicavel.

## 5. Arquitetura e Estado

- `src/main.jsx` ainda concentra boa parte do fluxo. Nao aumente complexidade
  sem necessidade; extraia helpers quando reduzir acoplamento real.
- Filtros locais devem operar sobre canvas e `ImageData`.
- Exportacao PNG nao deve incluir overlay de mascara.
- Modo normal pode usar mascara automatica/manual.
- Modo IA nao deve usar reconhecimento de pessoa nem pincel; ajustes finos em IA
  sao pos-processamento local sobre a imagem gerada.
- Historico de imagens IA deve permanecer local no navegador via IndexedDB.
- Estado persistido em `localStorage` deve ter fallback seguro se storage falhar.
- Evite calculos caros a cada movimento de slider. Sliders devem preferir commit
  ao soltar quando isso preservar fluidez.

## 6. Filtros Locais e Canvas

- Filtros normais sao gratuitos, locais e devem continuar funcionando offline
  depois que a foto estiver carregada.
- Ao adicionar filtro normal, defina:
  - `id` estavel;
  - `name` curto;
  - `label` explicando quando usar;
  - `filter` com valores controlados e visualmente distintos.
- Atualize placeholders visuais em `src/styles.css` quando criar novo `id`.
- Preserve preview em miniatura dos filtros quando a foto estiver carregada.
- Nao aplique overlay da mascara no arquivo exportado.
- Qualquer ajuste de performance deve preservar qualidade do download final.

## 7. Filtros IA e Prompts

- Use `@google/genai` com o modelo configurado no codigo:
  `gemini-2.5-flash-image`.
- O app deve mostrar erros claros para chave ausente, chave invalida, permissao,
  quota e resposta sem imagem.
- Nao remova o editor de prompt lateral.
- Todo prompt enviado ao Gemini deve receber os guardrails comuns de realismo e
  preservacao de identidade quando ainda nao os contiver.
- O textarea deve mostrar o prompt editavel do filtro, sem duplicar os
  guardrails tecnicos a cada troca de preset.
- Quando a IA gerar imagem:
  - aplicar no preview principal;
  - salvar no historico local;
  - permitir download;
  - permitir ajustes finos locais depois da geracao.

## 8. UI, shadcn e Acessibilidade

- Reutilize `src/components/ui` antes de criar novo componente base.
- Componentes base devem seguir o padrao shadcn local: `Button`, `Card`,
  `Input`, `Textarea`, `cn` e `class-variance-authority` quando fizer sentido.
- Mantenha interface dark-first, direta e densa.
- Use `lucide-react` para icones.
- Botoes de icone precisam de nome acessivel ou texto visivel.
- Entradas precisam de label associado.
- Nao substitua `button` por `div` clicavel.
- Estados essenciais: loading, disabled, erro, vazio e sucesso devem ser claros.
- Layout deve ser responsivo e nao pode depender apenas de hover.
- A foto precisa caber inteira em zoom `1x` no desktop e no mobile sempre que a
  proporcao permitir.

## 9. Performance

- Evite recalcular `ImageData` em eventos de alta frequencia sem necessidade.
- Sliders de intensidade, zoom e ajustes finos devem priorizar atualizacao visual
  imediata do controle e aplicacao ao soltar.
- Use `requestAnimationFrame` quando uma renderizacao de canvas precisar ser
  agendada.
- Reaproveite caches existentes (`previewSourceRef`, thumbnails e mascaras) em
  vez de reconstruir a cada render.
- Nao aumente `PREVIEW_MAX_WIDTH` sem medir impacto.
- Download/exportacao pode usar qualidade maior que preview.
- Evite adicionar bibliotecas grandes para manipulacao simples de pixels.

## 10. Erros e Resiliencia

- Nao use `catch` vazio.
- Diferencie erro de chave, quota, permissao, resposta invalida e falha local.
- Preserve a imagem carregada quando uma geracao IA falhar.
- Nao apague historico local se uma operacao de salvar/remover falhar; informe o
  usuario com mensagem curta.
- Desabilite acoes duplicadas enquanto `aiBusy` estiver ativo.
- Se IndexedDB ou localStorage estiverem indisponiveis, o editor deve continuar
  funcionando sem historico persistente.

## 11. Dependencias

- Prefira a stack atual antes de instalar algo novo.
- Toda dependencia nova deve ter motivo claro, impacto de bundle aceitavel e
  estar refletida no `package-lock.json`.
- Nao instale pacotes para funcionalidades que podem ser implementadas com APIs
  do navegador ja disponiveis.
- Depois de alterar dependencias, rode `npm run build`.

## 12. Git

- Verifique `git status --short --branch` antes e depois das mudancas.
- Nao inclua `.env`, `dist/`, `node_modules/`, logs ou metadados locais.
- Commits, quando solicitados, devem ser pequenos e focados.
- Nao use comandos destrutivos de Git sem pedido explicito.
- Se houver mudancas nao relacionadas, preserve-as e nao as reverta.

## 13. Definicao de Pronto

Antes de concluir, confirme:

- [ ] A solicitacao foi atendida por completo.
- [ ] Nao ha vazamento de `.env`, chaves ou dados sensiveis.
- [ ] Filtros normais continuam locais.
- [ ] Modo IA continua separado do reconhecimento/pincel.
- [ ] Download PNG funciona e nao inclui overlay de mascara.
- [ ] Historico local de IA nao quebra o editor quando falha.
- [ ] UI funciona em desktop e mobile.
- [ ] Interacoes principais tem nomes/labels acessiveis.
- [ ] `npm run build` foi executado ou a limitacao foi informada.
- [ ] O diff contem apenas mudancas necessarias.

Qualidade neste projeto significa que a edicao deve parecer rapida, previsivel e
segura para fotos reais do usuario.
