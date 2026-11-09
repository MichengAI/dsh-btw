<p align="center">
  <img src="https://raw.githubusercontent.com/MichengAI/dsh-btw/2d8dd7752cec1b29dd705969eaa932635ba0bf4f/assets/branding/dsh-btw-banner.png" alt="DSH BTW" width="100%">
</p>

<div align="center">

# DSH BTW

**Preguntas secundarias rápidas en la sesión actual de DeepSeek Harness: solo responde, no ejecuta herramientas**

[简体中文](README.zh-CN.md) · [English](README.en.md) · [日本語](README.ja.md) · [Español](README.es.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [Русский](README.ru.md) · [Português](README.pt.md)

[Capturas](#capturas-de-pantalla) · [Instalación](#instalación) · [Uso](#uso) · [Registro de cambios](CHANGELOG.md) · [Apache-2.0](LICENSE)

[![Licencia: Apache-2.0](https://img.shields.io/badge/License-Apache--2.0-blue.svg)](LICENSE)
[![DSH Web Plugin](https://img.shields.io/badge/DSH%20Web-Plugin-0f766e.svg)](https://github.com/deepseek-ai/deepseek-harness)
[![Node.js 22+](https://img.shields.io/badge/Node.js-22%2B-339933.svg?logo=node.js&logoColor=white)](https://nodejs.org/)

</div>

> DSH BTW es un plugin para DeepSeek Harness mantenido por la comunidad, no un producto oficial de DeepSeek AI. Escriba `/btw su pregunta` en la conversación actual para obtener una respuesta contextual en una burbuja independiente sin interrumpir la tarea principal. Admite DSH Web y las aplicaciones de escritorio que integran DSH Web. A partir de `1.0.0`, los hosts no incluidos en la lista compatible serán rechazados de forma segura mediante la barrera de versión (la configuración instalada y los registros de la conversación se conservan).

## Características principales

- **Preguntas con contexto**: explique conceptos, resuma conclusiones o responda dudas puntuales sobre la conversación actual.
- **Solo responde, no ejecuta**: no lee archivos nuevos, no navega por la red, no ejecuta comandos ni modifica código.
- **Burbuja de respuesta independiente**: admite Markdown, fórmulas matemáticas, copiar, contraer, expandir y cerrar. Puede ver múltiples respuestas simultáneamente.
- **No interrumpe la tarea principal**: las preguntas secundarias se responden por separado y no se agregan a la conversación principal por defecto.
- **Reenvío bajo petición**: si desea la conclusión en el chat principal, solicite expresamente en la pregunta «enviar la respuesta al chat principal»; se utilizará `send_message` para enviar una respuesta completa y autosuficiente. No se reenviará si no se solicita.
- **Cancelación en cualquier momento**: cerrar la burbuja mientras responde cancela inmediatamente esa pregunta secundaria.
- **Internacionalización completa y temas**: sigue el tema claro u oscuro de DSH. A partir del host 0.2.2-rc.1 ofrece compatibilidad nativa con los 8 idiomas oficiales (español, inglés, chino, japonés, francés, alemán, ruso y portugués); en hosts anteriores 0.2.0〜0.2.1 recurre de forma segura al chino e inglés.

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

Abra **Plugins**, seleccione `@michengai/dsh-btw` y encontrará el formulario de configuración directamente en la página de detalles: herramientas permitidas e instrucciones personalizadas.

![Formulario de configuración en la página de detalles](assets/screenshots/btw-settings-panel.png)

### Dibujar diagramas en preguntas secundarias

Con `pele_draw` en la lista blanca, la pregunta secundaria también puede generar diagramas dentro de su propio panel sin alterar el chat principal.

![Renderizado de diagramas con pele_draw](assets/screenshots/btw-pele-draw.png)

## Ecosistema de productos DSH

Si desea utilizar la estación de trabajo de escritorio, descargue [DSH Codex Desktop](https://github.com/MichengAI/dsh-codex-desktop/releases). Si ya cuenta con [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness), instale los complementos según sus necesidades. A continuación se enumeran 11 plugins desarrollados internamente; la inclusión real en la versión de escritorio depende de las notas de la versión y el catálogo integrado correspondientes.

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
- Rango de compatibilidad del host: serie completa DeepSeek Harness `0.2.x` (`>=0.2.0-rc.1 <0.3.0-0`), verificado con `0.2.0-rc.1`, `0.2.0-rc.2`, `0.2.1-rc.1`〜`0.2.1-rc.5`, `0.2.2-rc.1`. Las actualizaciones dentro de la misma generación no requieren esperar nuevos lanzamientos del plugin.
- Rango de compatibilidad de idiomas: los 8 idiomas integrados son seleccionables de forma nativa a partir de DeepSeek Harness `0.2.2-rc.1`. En hosts `0.2.0`〜`0.2.1`, los diccionarios adicionales registrados permanecen inactivos y la interfaz recurre de manera segura al chino e inglés.
- Los hosts anteriores a `0.2.0-rc.1` ya no son compatibles. Las modificaciones destructivas de la generación `0.3.0` serán interceptadas por la barrera de versión. Los usuarios de `0.1.x` deben instalar la versión `0.1.24`.
- Node.js 22+, capaz de ejecutar el comando `dsh` en la terminal.

## Instalación

Los siguientes comandos usan el perfil `web`. Adáptelo a su entorno según corresponda. Desactive otros plugins que proporcionen el comando `/btw` antes de la instalación.

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

Instale o actualice después de terminar las tareas en curso; la aplicación de escritorio puede reiniciarse automáticamente. Si el cambio no surte efecto, use la acción de recarga de la aplicación o reinicie el servicio `dsh web`. No basta con actualizar la ventana del navegador.

En hosts anteriores a `0.2.0` y en `0.2.1` alpha, la instalación de `@latest` será rechazada por la barrera de versión y el plugin no se ejecutará. Para `0.1.x` instale `0.1.24`. El rechazo no elimina las configuraciones existentes ni los registros de las sesiones principales.

## Uso

### Consultar texto seleccionado

Seleccione texto en el cuerpo de un mensaje de la conversación y elija «Preguntar sobre este texto» en la barra flotante superior. Ingrese su duda y presione Enter o pulse «Explicar esto». Shift+Enter para salto de línea, Esc para cancelar. La respuesta se mostrará en una burbuja independiente de BTW, permitiendo desplegar la cita original.

- Admite párrafos convencionales, listas y bloques de código; hasta 8.000 unidades de código UTF-16 por selección (incluidos espacios en blanco). Si se supera el límite se avisará sin truncar el texto.
- La cita se fija al seleccionarla y no cambiará aunque el mensaje continúe generándose. El resto del contexto utiliza el contenido finalizado en el chat principal al momento del envío.
- No ocupa ni limpia el borrador del cuadro de entrada principal; las selecciones entre múltiples mensajes, en cuadros de entrada o en salidas de herramientas no mostrarán este menú.
- La barra también ofrece «Añadir a la conversación», agregando la cita al borrador actual y enfocando el cuadro de entrada sin enviarla automáticamente. Durante el envío de mensajes la adición se suspende. El clic derecho conserva el menú nativo del navegador.
- Admite selecciones mediante teclado dentro del elemento de texto; al soltar Shift se enfoca la barra flotante. Los navegadores sin soporte de Popover API recurren a una capa fija (fixed), que puede verse afectada por recortes de diseño del host.
- Tratamiento diferenciado respecto a `dsh-better-sidebar`: BTW solo gestiona el cuerpo de la conversación; la vista previa de archivos y el editor conservan la opción original «Añadir a la conversación» del plugin lateral, evitando barras duplicadas.
- Las nuevas entradas dependen de los selectores DOM del texto del host. En diseños no reconocidos se conserva el comportamiento original del clic derecho y se puede seguir utilizando `/btw`.

### Consultas mediante comando

En una conversación con contexto previo introduzca:

```text
/btw Resume la solución anterior en una sola frase
```

| Objetivo | Acción |
| --- | --- |
| Hacer una pregunta secundaria | Escriba `/btw su pregunta` y envíe, o elija `btw` en el menú `/` |
| Ver la respuesta | Espere a que la burbuja independiente sobre el cuadro de entrada devuelva la respuesta |
| Copiar la respuesta | Pulse el icono de copia en la esquina superior derecha de la burbuja |
| Contraer o expandir | Pulse el icono de pliegue o despliegue en la esquina superior derecha |
| Cancelar la consulta | Cierre la burbuja durante la generación (no cancela la tarea principal) |
| Cerrar la burbuja | Cierre las burbujas finalizadas |
| Continuar preguntando | Vuelva a escribir `/btw su pregunta`; cada consulta es totalmente independiente |

Si necesita ejecutar comandos, modificar código o continuar la tarea principal, envíela a través de la conversación ordinaria. BTW solo puede responder basándose en el contexto existente.

BTW solo acepta texto. Si el cuadro de entrada incluye imágenes o archivos adjuntos, rechazará la pregunta secundaria conservando el texto y los adjuntos; retire los archivos e inténtelo de nuevo.

### Instrucciones de uso

- Cada consulta secundaria es independiente y toma como referencia el contenido ya completado de la sesión principal en el momento de preguntar; no incluye respuestas en generación ni consultas secundarias previas.
- Las burbujas no se conservan tras refrescar la página; copie con antelación las respuestas que necesite conservar.

## Configuración

Las siguientes dos opciones son opcionales. Si ambas se dejan vacías se mantendrá el comportamiento predeterminado de fábrica: solo respuestas de texto plano con el prompt integrado.

Abra **Plugins**, busque `@michengai/dsh-btw` y pulse en **Configuración**. La ubicación de la página coincide con la de `dsh-subagent-default-model`.

| Parámetro | Función |
| --- | --- |
| **Herramientas permitidas** | Nombres de herramientas que la consulta secundaria puede invocar además de `send_message`, uno por línea (ej. `pele_draw`). Vacío restringe a solo texto (valor predeterminado). |
| **Prompt personalizado** | Sustituye el prompt integrado. El cuadro ya está precargado con el texto original para editarlo directamente; guardar sin cambios restaura el valor por defecto. |

Instrucciones:

- La lista blanca solo amplía el alcance de lo que la consulta secundaria puede invocar, sin restringir jamás el chat principal; indicar herramientas inexistentes equivale a no permitir nada.
- `send_message` no puede incluirse en la lista blanca. El reenvío al chat principal solo se permite hacia la sesión padre propia de la consulta secundaria, y la lista blanca no puede transformarlo en «enviar a cualquier agente».
- El prompt personalizado solo sustituye el prefijo de instrucciones; las aclaraciones sobre permisos de herramientas y canales de retorno se añaden siempre al final para evitar interpretaciones erróneas del modelo.
- Las modificaciones surten efecto en la siguiente consulta secundaria sin requerir recargar el plugin.
- Dado que las herramientas permitidas se detallan en el texto de permisos, ampliar la lista blanca altera el prompt de la consulta. Al formar parte del mensaje final del usuario, las definiciones de herramientas y el prompt del sistema permanecen idénticos byte a byte con la sesión principal, sin perjudicar la reutilización de la cache de prompts (prompt cache).

### Ejemplo: dibujar diagramas en consultas secundarias

[`dsh-pele`](https://github.com/hesheng01/dsh-pele) proporciona la herramienta `pele_draw`, que renderiza código fuente Mermaid como tarjetas de diagramas SVG en la sesión. Al añadir `pele_draw` a **Herramientas permitidas**, la consulta secundaria también podrá generar diagramas.

> Nota: `dsh-pele` es un plugin reciente que aún no está publicado en npm ni figura en el mercado de plugins. Puede instalarse clonando el repositorio de GitHub y añadiendo el directorio `plugin` al perfil:
>
> ```bash
> git clone https://github.com/hesheng01/dsh-pele.git
> dsh plugin --profile <profile> add <ruta_absoluta>/dsh-pele/plugin
> ```
>
> La primera vinculación requiere reiniciar el Host.

## Desinstalación

```powershell
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

dsh plugin --profile web remove @michengai/dsh-btw
```

Surte efecto tras recargar DSH. Desactivar o actualizar el plugin no elimina los registros de la conversación principal.

## Desarrollo local

```powershell
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
npm ci --ignore-scripts
npm run check
```

`npm run check` ejecuta la comprobación de tipos, las pruebas y la compilación.

La línea base de desarrollo y compilación es `0.2.2-rc.1`. `npm run test:compat` compila con dicha línea base y ejecuta el conjunto de pruebas en cada una de las versiones de host aisladas. Los modelos emplean adaptadores de prueba. Las pruebas de componentes DOM no sustituyen la verificación real en navegadores.

Tanto GitHub como npm contienen el directorio `lib` ejecutable; tras modificar el código fuente ejecute `npm run build` antes de realizar una confirmación (commit).

Para instalar desde el código fuente ejecute `dsh plugin --profile web add . --ignore-scripts` en el directorio del proyecto y recargue DSH.

## Licencia

[Apache-2.0](LICENSE) © 2026 MichengAI.
