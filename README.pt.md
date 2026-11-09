<p align="center">
  <img src="https://raw.githubusercontent.com/MichengAI/dsh-btw/2d8dd7752cec1b29dd705969eaa932635ba0bf4f/assets/branding/dsh-btw-banner.png" alt="DSH BTW" width="100%">
</p>

<div align="center">

# DSH BTW

**Perguntas secundárias rápidas na sessão atual do DeepSeek Harness: apenas respostas, sem execução de ferramentas**

[简体中文](README.zh-CN.md) · [English](README.en.md) · [日本語](README.ja.md) · [Español](README.es.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [Русский](README.ru.md) · [Português](README.pt.md)

[Capturas](#capturas-de-tela) · [Instalação](#instalação) · [Uso](#uso) · [Registro de alterações](CHANGELOG.md) · [Apache-2.0](LICENSE)

[![Licença: Apache-2.0](https://img.shields.io/badge/License-Apache--2.0-blue.svg)](LICENSE)
[![DSH Web Plugin](https://img.shields.io/badge/DSH%20Web-Plugin-0f766e.svg)](https://github.com/deepseek-ai/deepseek-harness)
[![Node.js 22+](https://img.shields.io/badge/Node.js-22%2B-339933.svg?logo=node.js&logoColor=white)](https://nodejs.org/)

</div>

> O DSH BTW é um plugin para o DeepSeek Harness mantido pela comunidade, não um produto oficial da DeepSeek AI. Digite `/btw sua pergunta` na conversa atual para obter uma resposta contextual em um balão independente sem interromper a tarefa principal. Compatível com o DSH Web e aplicativos de desktop baseados nele. A partir da versão `1.0.0`, hosts fora da lista compatível são rejeitados com segurança pela barreira de versão (as configurações instaladas e o histórico de conversas são preservados).

## Principais Recursos

- **Perguntas com contexto**: esclareça conceitos, resuma conclusões ou tire dúvidas pontuais com base no histórico atual.
- **Apenas respostas, sem ferramentas**: não lê novos arquivos, não acessa a internet, não executa comandos nem edita código.
- **Balão de resposta independente**: suporta Markdown, equações matemáticas, cópia, recolhimento, expansão e fechamento. Várias respostas podem ser visualizadas simultaneamente.
- **Não interrompe a tarefa principal**: as perguntas secundárias são respondidas à parte e não afetam o diálogo principal por padrão.
- **Envio sob solicitação**: se desejar registrar a resposta no chat principal, peça explicitamente na pergunta «envie a resposta para o chat principal» para que `send_message` transmita uma resposta completa e autossuficiente. Nenhum envio é feito sem solicitação direta.
- **Cancele a qualquer momento**: fechar o balão enquanto a resposta está sendo gerada cancela imediatamente a pergunta secundária.
- **Internacionalização completa e temas**: acompanha os temas claro e escuro do DSH. A partir do host `0.2.2-rc.1`, há suporte nativo para todos os 8 idiomas oficiais (português, inglês, chinês, japonês, espanhol, francês, alemão e russo); em versões anteriores `0.2.0`〜`0.2.1`, o sistema recorre com segurança ao chinês e ao inglês.

## Capturas de tela

### Pergunta secundária no DSH padrão

A conversa principal continua no mesmo lugar, e o balão da pergunta secundária é exibido diretamente acima da área de entrada.

![Balão de resposta BTW na conversa](https://raw.githubusercontent.com/MichengAI/dsh-btw/2d8dd7752cec1b29dd705969eaa932635ba0bf4f/assets/screenshots/btw-conversation.png)

### Menu de comandos

Digite `/` e selecione `btw` no menu de comandos, ou digite diretamente `/btw sua pergunta`.

![Entrada btw no menu oficial de comandos](https://raw.githubusercontent.com/MichengAI/dsh-btw/2d8dd7752cec1b29dd705969eaa932635ba0bf4f/assets/screenshots/btw-command-menu.png)

### Balões de resposta independentes

Cada pergunta é exibida em seu próprio balão, com controles no canto superior direito para copiar, recolher/expandir ou fechar.

![Múltiplos balões de resposta](https://raw.githubusercontent.com/MichengAI/dsh-btw/2d8dd7752cec1b29dd705969eaa932635ba0bf4f/assets/screenshots/btw-bubbles.png)

### Configuração de perguntas secundárias

Abra **Plugins**, selecione `@michengai/dsh-btw` e o formulário de configuração estará disponível diretamente na página de detalhes: ferramentas permitidas e instruções personalizadas.

![Formulário de configuração de perguntas secundárias](assets/screenshots/btw-settings-panel.png)

### Geração de diagramas

Com `pele_draw` na lista de permissões, a pergunta secundária também pode renderizar fluxogramas sem interferir no chat principal.

![Renderização de diagramas com pele_draw](assets/screenshots/btw-pele-draw.png)

## Ecossistema de soluções DSH

Para obter um ambiente de trabalho completo em desktop, baixe o [DSH Codex Desktop](https://github.com/MichengAI/dsh-codex-desktop/releases). Em ambientes já existentes do [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness), instale os plugins de acordo com suas necessidades. A seguir estão 11 plugins desenvolvidos internamente; o escopo real na versão desktop depende das notas da versão e catálogo integrado.

| Plugin | Finalidade |
| --- | --- |
| [Codex UI](https://github.com/MichengAI/dsh-codex-ui) | Organização de projetos e sessões, busca de tarefas e navegação |
| [Agency Agents](https://github.com/MichengAI/dsh-agency-agents) | Escolher e invocar especialistas dedicados por tarefa |
| [Skills Manager](https://github.com/MichengAI/dsh-skills-manager) | Localizar, ativar, criar e importar habilidades locais |
| [Archive Manager](https://github.com/MichengAI/dsh-archive-manager) | Buscar, restaurar e limpar conversas arquivadas |
| [IM Connect](https://github.com/MichengAI/dsh-im-connect) | Atribuir tarefas e receber respostas em plataformas de mensagens |
| [Automation](https://github.com/MichengAI/dsh-automation) | Executar tarefas agendadas e visualizar relatórios |
| [BTW](https://github.com/MichengAI/dsh-btw) | Perguntas contextuais rápidas sem interromper a tarefa principal |
| [Simplify](https://github.com/MichengAI/dsh-simplify) | Limpar e refatorar alterações do Git com `/simplify` |
| [PUA](https://github.com/MichengAI/dsh-pua) | Orientar o agente a corrigir rotas em falhas e validar resultados |
| [Code Review](https://github.com/MichengAI/dsh-code-review) | Iniciar revisões de código independentes com `/review` |
| [Codex Pet](https://github.com/MichengAI/dsh-codex-pet) | Alertas de sessão, aprovação de ferramentas e respostas via pet |

## Pré-requisitos

- DeepSeek Harness instalado.
- Intervalo de suporte do host: linha completa DeepSeek Harness `0.2.x` (`>=0.2.0-rc.1 <0.3.0-0`), verificado em `0.2.0-rc.1`, `0.2.0-rc.2`, `0.2.1-rc.1`〜`0.2.1-rc.5`, `0.2.2-rc.1`. Atualizações dentro da mesma geração não requerem aguardar novas versões do plugin.
- Suporte a idiomas: todos os 8 idiomas integrados são selecionáveis nativamente a partir do DeepSeek Harness `0.2.2-rc.1`. Em hosts `0.2.0`〜`0.2.1`, dicionários registrados adicionais permanecem inativos e a interface recorre de forma segura ao chinês e inglês.
- Hosts anteriores a `0.2.0-rc.1` não são mais suportados. Modificações destrutivas da geração `0.3.0` serão interceptadas pela barreira de versão. Usuários da versão `0.1.x` devem instalar a versão `0.1.24`.
- Node.js 22+, comando `dsh` funcional no terminal.

## Instalação

Os exemplos abaixo utilizam o perfil `web`. Adapte-os para o seu ambiente conforme necessário. Desative outros plugins que forneçam o comando `/btw` antes da instalação.

### Instalação por Agente (Recomendado)

Envie a seguinte instrução para qualquer agente com acesso ao terminal local:

```text
Instale o plugin DSH @michengai/dsh-btw no perfil web local executando: dsh plugin --profile web add @michengai/dsh-btw@latest --registry=https://registry.npmjs.org/. Após a instalação, execute dsh --profile web --dump-config para confirmar a presença de michengai-btw e me explique como recarregar o DSH e começar a usá-lo.
```

### Instalação manual via npm

```powershell
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

dsh plugin --profile web add @michengai/dsh-btw@latest --registry=https://registry.npmjs.org/
```

### Recarregar

Instale ou atualize após finalizar as tarefas atuais; aplicativos de desktop podem ser reiniciados automaticamente. Se a alteração não surtir efeito, use a opção de recarregar do aplicativo desktop ou reinicie o serviço `dsh web`. Apenas atualizar a aba do navegador não é suficiente.

Em hosts anteriores a `0.2.0` e em `0.2.1` alpha, a instalação de `@latest` será rejeitada pela barreira de versão e o plugin não será executado. Para `0.1.x`, instale `0.1.24`. A rejeição não remove configurações existentes nem registros da conversa principal.

## Uso

### Pergunta sobre texto selecionado

Selecione um trecho de texto no corpo de uma mensagem da conversa e escolha «Perguntar sobre este texto» na barra flutuante superior. Digite sua pergunta e pressione Enter ou clique em «Explicar isso». Shift+Enter para nova linha, Esc para cancelar. A resposta será exibida em um balão BTW independente, e o texto original da citação poderá ser expandido.

- Suporta parágrafos normais, listas e blocos de código; até 8.000 unidades de código UTF-16 por citação (incluindo espaços). Se o limite for excedido, um aviso será exibido sem truncar o texto.
- A citação é fixada no momento da seleção e não será alterada caso a mensagem continue sendo gerada. O restante do contexto utiliza o conteúdo concluído na conversa principal no momento do envio.
- Não consome nem apaga o rascunho na caixa de entrada principal; seleções que cruzam múltiplas mensagens, campos de entrada ou saídas de ferramentas não exibirão esse menu.
- A barra também oferece a opção «Adicionar à conversa», anexando a citação ao rascunho existente e focando o campo de entrada sem envio automático. Durante o envio de mensagens, a adição fica suspensa. O clique com o botão direito mantém o menu padrão do navegador.
- Suporta seleções via teclado em elementos de texto; soltar a tecla Shift coloca o foco na barra flutuante. Navegadores sem suporte à API Popover recorrem a uma camada fixa (fixed).
- Separação de áreas com `dsh-better-sidebar`: o BTW processa exclusivamente o corpo da conversa; a visualização de arquivos e o editor preservam a opção original «Adicionar à conversa» da barra lateral sem duplicações.
- As novas opções dependem dos seletores de DOM do texto do host. Em layouts não reconhecidos, o comportamento original do botão direito é preservado e o comando `/btw` continua disponível.

### Pergunta por comando

Em uma conversa com contexto anterior:

```text
/btw Resuma a solução anterior em uma única frase
```

| Objetivo | Ação |
| --- | --- |
| Fazer pergunta secundária | Digite `/btw sua pergunta` e envie, ou escolha `btw` no menu `/` |
| Ver a resposta | Aguarde o balão independente surgir sobre a área de entrada |
| Copiar resposta | Clique no ícone de cópia no canto superior direito do balão |
| Recolher ou expandir | Clique no ícone de recolhimento/expansão no canto superior direito |
| Cancelar pergunta | Feche o balão durante a geração (a tarefa principal continua) |
| Fechar balão | Feche balões já finalizados |
| Fazer outra pergunta | Digite novamente `/btw sua pergunta`; cada consulta é 100% independente |

Caso precise executar comandos, modificar código ou continuar a tarefa principal, envie a solicitação na conversa normal. O BTW responde exclusivamente com base no contexto já existente.

O BTW aceita apenas texto. Se a mensagem contiver imagens ou arquivos anexados, a pergunta secundária será recusada mantendo o texto e os anexos intactos; remova os arquivos e tente novamente.

### Instruções de uso

- Cada pergunta secundária é autônoma e toma como referência o conteúdo finalizado da sessão principal no momento da solicitação; ela não inclui respostas em geração nem perguntas secundárias anteriores.
- Os balões não são preservados após a atualização da página; copie previamente as respostas que desejar manter.

## Configuração

As duas opções a seguir são opcionais. Se ambas ficarem em branco, o comportamento padrão será mantido: respostas puramente textuais com a instrução interna original.

Acesse **Plugins**, localize `@michengai/dsh-btw` e clique em **Configurações**. A página fica no mesmo local das configurações de `dsh-subagent-default-model`.

| Configuração | Descrição |
| --- | --- |
| **Ferramentas permitidas** | Nomes de ferramentas que a pergunta secundária pode invocar além de `send_message`, uma por linha (ex. `pele_draw`). Vazio restringe a apenas texto (padrão). |
| **Instrução personalizada** | Substitui a instrução integrada. Já vem pré-preenchida com o texto padrão para facilitar ajustes; salvar sem alterações restaura o padrão. |

Observações:

- A lista de permissões apenas expande o que a pergunta secundária pode chamar, sem jamais limitar a conversa principal; indicar ferramentas inexistentes equivale a não liberar nada.
- `send_message` não pode ser inserido na lista de permissões. O reenvio para o chat principal só é permitido para a própria sessão-mãe da pergunta secundária, e a lista não permite alterar o destino para outros agentes.
- A instrução personalizada substitui apenas o prefixo de instruções; as explicações sobre permissões de ferramentas e canal de retorno são sempre anexadas ao final para evitar alucinações de permissão pelo modelo.
- As alterações entram em vigor na próxima pergunta secundária sem necessidade de recarregar o plugin.
- Como as ferramentas liberadas são citadas no texto de permissões, expandir a lista altera a instrução da pergunta. Por fazer parte da mensagem final do usuário, as definições de ferramentas e as instruções do sistema continuam idênticas byte a byte à sessão principal, sem prejudicar o reaproveitamento do prompt cache.

### Exemplo: gerar diagramas em perguntas secundárias

O plugin [`dsh-pele`](https://github.com/hesheng01/dsh-pele) oferece a ferramenta `pele_draw`, que renderiza código Mermaid como cartões de diagramas SVG na sessão. Ao adicionar `pele_draw` em **Ferramentas permitidas**, a pergunta secundária também poderá desenhar diagramas.

> Observação: `dsh-pele` é um plugin recente ainda não publicado no npm nem catalogado no mercado de plugins. Para instalar, clone o repositório do GitHub e adicione a pasta `plugin` ao perfil:
>
> ```bash
> git clone https://github.com/hesheng01/dsh-pele.git
> dsh plugin --profile <profile> add <caminho_absoluto>/dsh-pele/plugin
> ```
>
> A primeira integração exige reiniciar o Host.

## Desinstalação

```powershell
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

dsh plugin --profile web remove @michengai/dsh-btw
```

Surte efeito após recarregar o DSH. Desativar ou atualizar não remove nenhum registro da conversa principal.

## Desenvolvimento local

```powershell
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
npm ci --ignore-scripts
npm run check
```

O comando `npm run check` executa verificação de tipos, testes e compilação.

A base de referência de desenvolvimento e compilação é `0.2.2-rc.1`. O comando `npm run test:compat` compila com essa base e executa a suíte de testes nas versões isoladas do host. Testes de componentes DOM não substituem a validação real em navegadores.

Tanto o GitHub quanto o npm contêm a pasta executável `lib`; após modificar o código-fonte, execute `npm run build` antes de fazer o commit.

Para instalar a partir do código-fonte, execute `dsh plugin --profile web add . --ignore-scripts` no diretório do projeto e recarregue o DSH.

## Licença

[Apache-2.0](LICENSE) © 2026 MichengAI.
