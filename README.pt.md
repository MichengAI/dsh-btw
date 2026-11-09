<p align="center">
  <img src="https://raw.githubusercontent.com/MichengAI/dsh-btw/2d8dd7752cec1b29dd705969eaa932635ba0bf4f/assets/branding/dsh-btw-banner.png" alt="DSH BTW" width="100%">
</p>

<div align="center">

# DSH BTW

**Perguntas secundárias rápidas na sessão atual do DeepSeek Harness: apenas respostas, sem execução de ferramentas**

[简体中文](README.zh-CN.md) · [English](README.en.md) · [日本語](README.ja.md) · [Español](README.es.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [Русский](README.ru.md) · [Português](README.pt.md)

[Capturas](#capturas-de-tela) · [Instalação](#instalação) · [Uso](#uso) · [Registro de alterações](CHANGELOG.md) · [Apache-2.0](LICENSE)

[![License: Apache-2.0](https://img.shields.io/badge/License-Apache--2.0-blue.svg)](LICENSE)
[![DSH Web Plugin](https://img.shields.io/badge/DSH%20Web-Plugin-0f766e.svg)](https://github.com/deepseek-ai/deepseek-harness)
[![Node.js 22+](https://img.shields.io/badge/Node.js-22%2B-339933.svg?logo=node.js&logoColor=white)](https://nodejs.org/)

</div>

> O DSH BTW é um plugin para o DeepSeek Harness mantido pela comunidade, não um produto oficial da DeepSeek AI. Digite `/btw sua pergunta` na conversa atual para obter uma resposta contextual em um balão independente sem interromper a tarefa principal. Compatível com o DSH Web e aplicativos de desktop baseados nele. A partir da versão `1.0.0`, hosts fora da lista compatível são rejeitados com segurança pela barreira de versão.

## Principais Recursos

- **Perguntas com contexto**: esclareça conceitos, resuma conclusões ou tire dúvidas pontuais com base no histórico atual.
- **Apenas respostas, sem ferramentas**: não lê novos arquivos, não acessa a internet, não executa comandos nem edita código.
- **Balão de resposta independente**: suporta Markdown, equações matemáticas, cópia, recolhimento, expansão e fechamento.
- **Não interrompe a tarefa principal**: as perguntas secundárias são respondidas à parte e não afetam o diálogo principal por padrão.
- **Envio sob solicitação**: se desejar registrar a resposta no chat principal, peça explicitamente na pergunta «envie a resposta para o chat principal» para que `send_message` transmita uma resposta completa e autossuficiente.
- **Cancele a qualquer momento**: fechar o balão enquanto a resposta está sendo gerada cancela imediatamente a pergunta secundária.
- **Internacionalização completa e temas**: acompanha os temas claro e escuro do DSH com suporte nativo a todos os 8 idiomas oficiais (português, inglês, chinês, japonês, espanhol, francês, alemão e russo).

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

Abra **Plugins**, selecione `@michengai/dsh-btw` e o formulário de configuração estará disponível diretamente na página de detalhes.

![Formulário de configuração de perguntas secundárias](assets/screenshots/btw-settings-panel.png)

### Geração de diagramas

Com `pele_draw` na lista de permissões, a pergunta secundária também pode renderizar fluxogramas sem interferir no chat principal.

![Renderização de diagramas com pele_draw](assets/screenshots/btw-pele-draw.png)

## Ecossistema de soluções DSH

Para obter um ambiente de trabalho completo em desktop, baixe o [DSH Codex Desktop](https://github.com/MichengAI/dsh-codex-desktop/releases). Em ambientes já existentes do [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness), instale os plugins de acordo com suas necessidades:

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
- Intervalo de suporte: série DeepSeek Harness `0.2.x` (`>=0.2.0-rc.1 <0.3.0-0`).
- Node.js 22+, comando `dsh` funcional no terminal.

## Instalação

### Instalação por Agente (Recomendado)

Envie a seguinte instrução para qualquer agente com acesso ao terminal local:

```text
Instale o plugin DSH @michengai/dsh-btw no perfil web local executando: dsh plugin --profile web add @michengai/dsh-btw@latest --registry=https://registry.npmjs.org/. Após a instalação, execute dsh --profile web --dump-config para confirmar a presença de michengai-btw e me explique como recarregar o DSH.
```

### Instalação manual via npm

```powershell
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

dsh plugin --profile web add @michengai/dsh-btw@latest --registry=https://registry.npmjs.org/
```

### Recarregar

Instale ou atualize após finalizar as tarefas atuais. Se a alteração não surtir efeito, use a opção de recarregar do aplicativo desktop ou reinicie o serviço `dsh web`.

## Uso

### Pergunta sobre texto selecionado

Selecione um trecho de texto no corpo de uma mensagem e escolha «Perguntar sobre este texto» na barra flutuante. Digite sua pergunta e pressione Enter ou clique em «Explicar isso». Shift+Enter para nova linha, Esc para cancelar.

### Pergunta por comando

```text
/btw Resuma a solução anterior em uma única frase
```

| Objetivo | Ação |
| --- | --- |
| Fazer pergunta secundária | Digite `/btw sua pergunta` ou escolha `btw` no menu `/` |
| Ver a resposta | Aguarde o balão independente surgir sobre a área de entrada |
| Copiar resposta | Clique no ícone de cópia no canto do balão |
| Recolher ou expandir | Clique no ícone de recolhimento/expansão |
| Cancelar pergunta | Feche o balão durante a geração (a tarefa principal continua) |
| Fechar balão | Feche balões já finalizados |

## Configuração

Acesse **Plugins**, localize `@michengai/dsh-btw` e clique em **Configurações**.

| Configuração | Descrição |
| --- | --- |
| **Ferramentas permitidas** | Nomes de ferramentas que a pergunta secundária pode chamar além de `send_message`, uma por linha (ex. `pele_draw`). Vazio permite apenas texto. |
| **Instrução personalizada** | Substitui a instrução integrada. Já vem pré-preenchida com o texto padrão para facilitar ajustes. |

## Desinstalação

```powershell
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

dsh plugin --profile web remove @michengai/dsh-btw
```

## Licença

[Apache-2.0](LICENSE) © 2026 MichengAI.
