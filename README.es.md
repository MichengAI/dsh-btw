<p align="center">
  <img src="https://raw.githubusercontent.com/MichengAI/dsh-btw/2d8dd7752cec1b29dd705969eaa932635ba0bf4f/assets/branding/dsh-btw-banner.png" alt="DSH BTW" width="100%">
</p>

<div align="center">

# DSH BTW

**Preguntas secundarias rápidas en la sesión actual de DeepSeek Harness: solo responde, no ejecuta herramientas**

[简体中文](README.zh-CN.md) · [English](README.en.md) · [日本語](README.ja.md) · [Español](README.es.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [Русский](README.ru.md) · [Português](README.pt.md)

[Capturas](#capturas-de-pantalla) · [Instalación](#instalación) · [Uso](#uso) · [Registro de cambios](CHANGELOG.md) · [Apache-2.0](LICENSE)

[![License: Apache-2.0](https://img.shields.io/badge/License-Apache--2.0-blue.svg)](LICENSE)
[![DSH Web Plugin](https://img.shields.io/badge/DSH%20Web-Plugin-0f766e.svg)](https://github.com/deepseek-ai/deepseek-harness)
[![Node.js 22+](https://img.shields.io/badge/Node.js-22%2B-339933.svg?logo=node.js&logoColor=white)](https://nodejs.org/)

</div>

> DSH BTW es un plugin para DeepSeek Harness mantenido por la comunidad, no un producto oficial de DeepSeek AI. Escriba `/btw su pregunta` en la conversación actual para obtener una respuesta contextual en una burbuja independiente sin interrumpir la tarea principal. Admite DSH Web y las aplicaciones de escritorio que integran DSH Web. A partir de `1.0.0`, los hosts no incluidos en la lista compatible serán rechazados de forma segura mediante la barrera de versión (la configuración instalada y los registros de la conversación se conservan).

## Características principales

- **Preguntas con contexto**: explique conceptos, resuma conclusiones o responda dudas puntuales sobre la conversación actual.
- **Solo responde, no ejecuta**: no lee archivos nuevos, no navega por la red, no ejecuta comandos ni modifica código.
- **Burbuja de respuesta independiente**: admite Markdown, fórmulas matemáticas, copiar, contraer, expandir y cerrar. Puede ver múltiples respuestas simultáneamente.
- **No interrumpe la tarea principal**: las preguntas secundarias se responden por separado y no se agregan a la conversación principal por defecto.
- **Reenvío bajo petición**: si desea la conclusión en el chat principal, solicite expresamente en la pregunta «enviar la respuesta al chat principal»; se utilizará `send_message` para enviar una respuesta completa y autosuficiente.
- **Cancelación en cualquier momento**: cerrar la burbuja mientras responde cancela inmediatamente esa pregunta secundaria.
- **Internacionalización completa y temas**: sigue el tema claro u oscuro de DSH y ofrece compatibilidad nativa con los 8 idiomas oficiales (español, inglés, chino, japonés, francés, alemán, ruso y portugués).

## Capturas de pantalla

### Pregunta secundaria en DSH nativo

La conversación principal permanece intacta y la respuesta secundaria aparece directamente sobre el cuadro de entrada.

![Burbuja de respuesta independiente en la conversación](https://raw.githubusercontent.com/MichengAI/dsh-btw/2d8dd7752cec1b29dd705969eaa932635ba0bf4f/assets/screenshots/btw-conversation.png)

### Menú de comandos

Escriba `/` y seleccione `btw` en Comandos, o escriba directamente `/btw su pregunta`.

![Entrada btw en el menú oficial de comandos](https://raw.githubusercontent.com/MichengAI/dsh-btw/2d8dd7752cec1b29dd705969eaa932635ba0bf4f/assets/screenshots/btw-command-menu.png)

### Burbujas de respuesta independientes

Cada consulta se muestra en su propia burbuja, con botones en la esquina superior derecha para copiar, contraer/expandir o cerrar.

![Múltiples burbujas de respuesta con controles](https://raw.githubusercontent.com/MichengAI/dsh-btw/2d8dd7752cec1b29dd705969eaa932635ba0bf4f/assets/screenshots/btw-bubbles.png)

### Configuración de preguntas secundarias

Abra **Plugins**, seleccione `@michengai/dsh-btw` y encontrará el formulario de configuración en la página de detalles: herramientas permitidas e instrucciones personalizadas.

![Formulario de configuración en la página de detalles](assets/screenshots/btw-settings-panel.png)

### Dibujar diagramas en preguntas secundarias

Con `pele_draw` en la lista blanca, la pregunta secundaria también puede generar diagramas dentro de su propio panel sin alterar el chat principal.

![Renderizado de diagramas con pele_draw](assets/screenshots/btw-pele-draw.png)

## Ecosistema de productos DSH

Si desea utilizar la estación de trabajo de escritorio, descargue [DSH Codex Desktop](https://github.com/MichengAI/dsh-codex-desktop/releases). Si ya cuenta con [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness), instale los complementos según sus necesidades:

| Plugin | Utilidad |
| --- | --- |
| [Codex UI](https://github.com/MichengAI/dsh-codex-ui) | Organizar proyectos y sesiones, búsqueda de tareas y navegación |
| [Agency Agents](https://github.com/MichengAI/dsh-agency-agents) | Seleccionar e invocar especialistas según la tarea |
| [Skills Manager](https://github.com/MichengAI/dsh-skills-manager) | Buscar, activar, crear e importar habilidades locales |
| [Archive Manager](https://github.com/MichengAI/dsh-archive-manager) | Buscar, restaurar y depurar sesiones archivadas |
| [IM Connect](https://github.com/MichengAI/dsh-im-connect) | Asignar tareas y recibir respuestas desde mensajería instantánea |
| [Automation](https://github.com/MichengAI/dsh-automation) | Ejecutar tareas programadas y ver historiales de ejecución |
| [BTW](https://github.com/MichengAI/dsh-btw) | Consultas contextuales rápidas sin interrumpir la tarea principal |
| [Simplify](https://github.com/MichengAI/dsh-simplify) | Limpiar y optimizar cambios de Git con `/simplify` |
| [PUA](https://github.com/MichengAI/dsh-pua) | Guiar al agente para rectificar enfoques en fallos y verificar resultados |
| [Code Review](https://github.com/MichengAI/dsh-code-review) | Iniciar revisiones de código independientes con `/review` |
| [Codex Pet](https://github.com/MichengAI/dsh-codex-pet) | Avisos de sesión, aprobaciones de herramientas y respuestas mediante mascota |

## Requisitos previos

- DeepSeek Harness instalado.
- Rango de compatibilidad: serie DeepSeek Harness `0.2.x` (`>=0.2.0-rc.1 <0.3.0-0`).
- Node.js 22+, capaz de ejecutar el comando `dsh` en terminal.

## Instalación

Los siguientes comandos usan el perfil `web`. Adáptelo a su entorno según corresponda.

### Instalación mediante un agente (Recomendado)

Envíe el siguiente mensaje a cualquier agente capaz de ejecutar comandos de terminal local:

```text
Instale el plugin de DSH @michengai/dsh-btw en el perfil web local ejecutando: dsh plugin --profile web add @michengai/dsh-btw@latest --registry=https://registry.npmjs.org/. Tras la instalación, ejecute dsh --profile web --dump-config para comprobar que incluye michengai-btw y explíqueme cómo recargar DSH y comenzar a usarlo.
```

### Instalación manual desde npm

```powershell
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

dsh plugin --profile web add @michengai/dsh-btw@latest --registry=https://registry.npmjs.org/
```

### Recargar

Instale o actualice después de terminar las tareas en curso. Si no surte efecto, use la acción de recarga de la aplicación o reinicie el servicio `dsh web`.

## Uso

### Consultar texto seleccionado

Seleccione texto en el cuerpo de un mensaje y elija «Preguntar sobre este texto» en la barra flotante. Ingrese su duda y presione Enter o pulse «Explicar esto». Shift+Enter para salto de línea, Esc para cancelar.

- Admite párrafos, listas y bloques de código; hasta 8.000 caracteres por selección.
- La cita se fija al seleccionarla y no cambia si el mensaje sigue generándose.
- No ocupa ni borra el borrador del cuadro de entrada principal.

### Consultas mediante comando

En una conversación con contexto previo:

```text
/btw Resume la solución anterior en una sola frase
```

| Objetivo | Acción |
| --- | --- |
| Hacer una pregunta lateral | Escriba `/btw su pregunta` o elija `btw` en el menú `/` |
| Ver la respuesta | Espere la burbuja independiente sobre el cuadro de entrada |
| Copiar la respuesta | Pulse el icono de copia en la esquina de la burbuja |
| Contraer o expandir | Pulse el icono de pliegue/despliegue |
| Cancelar la consulta | Cierre la burbuja durante la generación (la tarea principal continúa) |
| Cerrar la burbuja | Cierre las burbujas finalizadas |

## Configuración

Ambas opciones son opcionales. Dejarlas vacías mantiene el comportamiento estándar de solo texto y el prompt predeterminado.

Vaya a **Plugins**, seleccione `@michengai/dsh-btw` y pulse en **Configuración**.

| Parámetro | Función |
| --- | --- |
| **Herramientas permitidas** | Nombres de herramientas que la pregunta secundaria puede invocar además de `send_message`, una por línea (ej. `pele_draw`). Vacío restringe a solo texto. |
| **Prompt personalizado** | Sustituye el prompt integrado. Ya viene precargado con el texto original para editarlo con facilidad. |

## Desinstalación

```powershell
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

dsh plugin --profile web remove @michengai/dsh-btw
```

## Licencia

[Apache-2.0](LICENSE) © 2026 MichengAI.
