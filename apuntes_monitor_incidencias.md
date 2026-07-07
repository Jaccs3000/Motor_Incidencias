# Monitor de Incidencias Jira - Apuntes del Proyecto

Este documento es un borrador vivo. Su objetivo es capturar las definiciones funcionales y técnicas que se van aclarando durante la conversación, para usarlo luego como fuente de información en la construcción de la aplicación.

## Problema a resolver

En la compañía se utiliza Jira Cloud para gestionar proyectos de desarrollo de software. Un proyecto está compuesto por un conjunto de incidencias de Jira, donde participan distintos roles como desarrolladores, testers, analistas de criterios, desplegadores, entre otros.

Las incidencias tienen distintos tipos, estados, responsables, atributos propios, incidencias enlazadas y, en algunos casos, subtareas. A su vez, las incidencias enlazadas pueden tener otras incidencias enlazadas.

Actualmente es engorroso conocer el estado real de un proyecto porque el usuario debe navegar manualmente entre muchas incidencias relacionadas dentro de Jira.

La aplicación busca resolver este problema mostrando, en una única pantalla web, información consolidada de las incidencias relacionadas con un proyecto o conjunto de filtros definidos por el usuario.

## Objetivo inicial

Construir una primera versión funcional de una aplicación web local que permita:

- consultar incidencias de Jira Cloud mediante endpoints REST;
- permitir que el usuario configure uno o varios filtros de búsqueda;
- ejecutar esos filtros periódicamente;
- extraer atributos definidos de las incidencias obtenidas;
- persistir la información localmente;
- mostrar los resultados consolidados en un grid configurable;
- facilitar la visualización del estado actual de los proyectos o incidencias de interés.

La aplicación no busca reemplazar Jira. Actúa como una capa local de consulta, consolidación, persistencia y visualización.

## Usuarios previstos

La aplicación será utilizada por distintos roles involucrados en proyectos de desarrollo, por ejemplo:

- desarrolladores;
- testers;
- analistas de criterios;
- desplegadores;
- otros roles que necesiten seguimiento del estado de incidencias.

Cada usuario podrá tener su propia configuración de filtros, columnas y preferencias de visualización.

## Tipo de aplicación

Para la primera versión, la aplicación será una aplicación web local, orientada a ejecutarse desde `localhost` en el navegador del usuario.

La información y la configuración deben persistir localmente para que sobrevivan al cierre del navegador, reinicio del computador y posteriores aperturas de la aplicación.

La base de datos funcional de la aplicación será `IndexedDB`, es decir, base de datos del navegador. No se usará un motor de base de datos externo ni una base de datos de servidor para persistir la información funcional.

La aplicación contará con un backend local liviano ejecutándose en `localhost`.

Este backend local permitirá soportar funcionalidades que el navegador por sí solo no puede resolver bien, especialmente:

- escritura de logs en archivos locales;
- control centralizado para evitar sincronizaciones simultáneas;
- soporte a tareas operativas de sincronización si se requieren;
- posibles optimizaciones futuras del funcionamiento local.

La arquitectura inicial queda orientada a:

- frontend web en navegador;
- backend local en `localhost`;
- persistencia funcional en `IndexedDB`;
- carpeta local de logs.

## Arquitectura y tecnologías

La compañía utiliza una arquitectura de referencia basada en:

- backend Java con Spring Boot;
- frontend React con Vite;
- componentes visuales basados en MUI;
- uso de servicios, componentes, páginas y configuración separada en el frontend.

La primera versión de esta aplicación debe seguir esa línea tecnológica, tomando solo lo necesario para este caso.

Propuesta técnica:

- Backend:
  - Java 21;
  - Spring Boot;
  - Maven;
  - endpoints locales para logs, estado operativo y bloqueo de sincronización;
  - sin JPA ni base de datos de servidor para la persistencia funcional de la aplicación.
- Frontend:
  - React;
  - Vite;
  - MUI para componentes visuales;
  - Axios o `fetch` para llamadas HTTP;
  - IndexedDB para persistencia local;
  - Web Notifications API para notificaciones del sistema.

Las llamadas a Jira Cloud se realizarán desde el backend local Spring Boot.

Esta decisión se toma porque las llamadas `fetch` desde `localhost` hacia Jira Cloud fueron bloqueadas por CORS, aunque abrir la URL REST directamente en el navegador sí funcione.

El frontend no llamará directamente a Jira. El usuario no verá las URLs REST ni escribirá directamente las llamadas a Jira. La aplicación construirá internamente las consultas a partir de los filtros configurados y solicitará al backend que las ejecute.

En la primera versión, el backend leerá las credenciales Jira desde `config/application-local.yml`.

Ejemplo:

```yaml
jira:
  base-url: https://puertodecartagena.atlassian.net
  email: usuario@empresa.com
  api-token: PEGAR_TOKEN_AQUI
```

El backend usará autenticación Basic contra Jira, construida con:

```text
email:api-token
```

codificado en Base64 y enviado en el header:

```text
Authorization: Basic {base64(email:api-token)}
```

El API token no debe exponerse al frontend.

En una segunda versión se reemplazará esta configuración local por el mecanismo corporativo observado en el repositorio de ejemplo:

- token almacenado cifrado en base de datos corporativa;
- tabla `JIRA_IA.TOKENS`;
- cifrado con `ENCRYPT_AES`;
- descifrado con `DECRYPT_CHAR`;
- recuperación del token desde backend;
- validación del token contra `/rest/api/3/myself`;
- uso interno del token por el backend sin retornarlo al frontend.

## Estructura sugerida del proyecto

Estructura conceptual:

```text
config/
  application-local.yml
  logback.xml

logs/

src/
  main/
    java/
      com/
        gpc/
          monitorincidencias/
            MonitorIncidenciasApplication.java
            controller/
            service/
            dto/
            config/

  app/
    package.json
    index.html
    src/
      api/
      components/
      config/
      db/
      hooks/
      pages/
      services/
      utils/
      App.jsx
      main.jsx
```

La estructura exacta puede ajustarse durante la implementación, pero debe conservar una separación clara entre:

- componentes visuales;
- servicios de Jira;
- servicios de sincronización;
- acceso a IndexedDB;
- configuración técnica;
- construcción de filtros;
- evaluación de alertas;
- utilidades compartidas.

## Integración con Jira Cloud

La aplicación consultará Jira Cloud mediante endpoints REST.

Ejemplos de consultas esperadas:

```text
https://puertodecartagena.atlassian.net/rest/api/3/search/jql?jql=issuetype="Testing" AND status!="Cerrado"
```

```text
https://puertodecartagena.atlassian.net/rest/api/3/search/jql?jql=issuekey IN ("TEST-123","TEST-456","TEST-789")
```

En la primera versión sí se utilizará API token de Jira, configurado localmente en `config/application-local.yml`.

Inicialmente se intentó validar el consumo directo desde frontend usando la sesión abierta del navegador, pero la prueba desde `localhost` falló por CORS. Por esta razón, la aplicación usará el backend como intermediario para consultar Jira.

## URL base de Jira

La aplicación debe permitir configurar una URL base de Jira Cloud de la compañía.

Ejemplo:

```text
https://puertodecartagena.atlassian.net
```

Esta URL base se usará para construir las URLs completas de consulta, concatenando la base con el endpoint REST y la JQL generada por los filtros configurados por el usuario.

## Filtros de búsqueda

El usuario podrá crear uno o varios filtros de búsqueda contra Jira.

Cada filtro deberá tener un nombre para que el usuario pueda organizarlo.

Los filtros se construirán de forma gráfica y amigable. El usuario no debería tener que escribir JQL manualmente.

La idea es que el constructor de filtros funcione de forma similar a filtros de Excel u otras aplicaciones, usando controles como:

- selector de campo;
- selector de operador o símbolo de comparación;
- selector o entrada de valor;
- posibilidad de combinar condiciones.

En lo posible, los filtros deben permitir condiciones `AND` y `OR`.

Más adelante se definirá con mayor detalle cómo debe ser la interfaz para construir estos filtros.

## Campos disponibles para filtros

Los campos que el usuario podrá usar para construir filtros saldrán de un conjunto de atributos definidos por la aplicación.

Más adelante se definirán los atributos concretos que se extraerán de cada incidencia de Jira, sin importar el tipo de incidencia.

Conociendo esos atributos y sus tipos de dato, la aplicación podrá determinar:

- qué campos se muestran en el constructor de filtros;
- qué operadores aplican para cada tipo de dato;
- qué valores posibles se pueden seleccionar o escribir;
- cómo traducir cada condición a JQL.

## Flujo inicial de la aplicación

### Primer uso sin filtros configurados

Si el usuario abre la aplicación por primera vez o no existen filtros guardados:

1. La aplicación debe abrir inmediatamente la pantalla de configuración.
2. El usuario configura uno o varios filtros de búsqueda.
3. Al guardar la configuración, la aplicación ejecuta inmediatamente los filtros.
4. Se realiza el proceso de sincronización.
5. Se muestra la pantalla principal con el grid usando columnas definidas por defecto.

### Apertura posterior con filtros configurados

Si el usuario ya tiene filtros guardados:

1. La aplicación abre la pantalla principal.
2. Se muestra la información local existente, si ya fue persistida anteriormente.
3. La aplicación inicia el proceso de sincronización.
4. Al terminar la sincronización, actualiza la información persistida y refresca el grid.
5. Después de terminar la sincronización, empieza a contar el tiempo configurado para la próxima sincronización.

## Sincronización

Se llamará sincronización al proceso completo compuesto por:

1. Ejecutar las consultas configuradas contra Jira Cloud usando REST.
2. Recibir las respuestas JSON.
3. A partir de las incidencias encontradas, navegar sus incidencias enlazadas y subtareas según las reglas definidas.
4. Extraer los atributos definidos de las incidencias relevantes.
5. Consolidar los resultados de todos los filtros.
6. Persistir la información localmente.
7. Actualizar el grid principal.
8. Generar mensajes, avisos o notificaciones según reglas que se definirán más adelante.

El temporizador de sincronización periódica debe comenzar después de terminar la sincronización actual.

## Estado visual de sincronización

La pantalla principal debe mostrar el estado actual de sincronización de la aplicación.

Este estado se mostrará en un lugar visible, preferiblemente en la parte superior derecha.

Debe incluir:

- un indicador visual tipo círculo de color;
- texto del estado actual;
- fecha/hora del último intento de sincronización.

Estados esperados:

- Verde: sincronización correcta.
  - Texto ejemplo: `Sincronizado correctamente`.
- Naranja: sincronización parcial o con advertencias.
  - Ejemplo: falló la extracción de alguna incidencia, pero el proceso general pudo continuar.
- Rojo: error grave de sincronización.
  - Ejemplo: el usuario no está logueado en Jira y las consultas REST no funcionan.
  - Texto ejemplo: `Error de sincronización`.
- Sincronización en curso:
  - Texto: `Sincronizando...`.
  - Aplica tanto para sincronización automática como manual.

La fecha/hora mostrada corresponde al último intento de sincronización, incluso si ese intento falló.

Si el estado es error de sincronización, se entiende que la falla ocurrió en la fecha/hora mostrada.

## Sincronización manual

La pantalla principal debe incluir un botón de sincronización manual.

Este botón permite ejecutar la sincronización sin esperar el intervalo configurado.

Reglas:

- ejecuta el mismo proceso que la sincronización automática;
- solo está habilitado si no hay una sincronización en curso;
- al iniciar una sincronización manual, se deshabilita hasta que finalice;
- bajo ningún motivo debe existir más de una sincronización en curso;
- si ya hay una sincronización automática en ejecución, el botón debe permanecer deshabilitado.

El backend local puede apoyar el control de bloqueo para garantizar que no se ejecuten dos sincronizaciones simultáneas.

## Descubrimiento de incidencias relacionadas

Los filtros configurados por el usuario traerán inicialmente una o varias incidencias desde Jira Cloud. Estas incidencias pueden pertenecer a distintos proyectos de desarrollo de software.

A partir de esas incidencias iniciales, la aplicación debe navegar las incidencias relacionadas para identificar el conjunto de incidencias que forman parte del mismo proyecto o flujo de trabajo.

La navegación debe considerar que:

- una incidencia puede tener incidencias enlazadas;
- una incidencia enlazada puede tener otras incidencias enlazadas;
- pueden existir varios niveles de enlaces;
- algunos tipos de incidencia pueden tener subtareas;
- no todas las incidencias encontradas durante el recorrido son relevantes para persistencia.

La aplicación debe evitar ciclos infinitos durante el recorrido. Si una incidencia ya fue visitada, no debe procesarse nuevamente como incidencia principal del recorrido.

Debe existir un mecanismo interno para registrar las incidencias ya visitadas durante una sincronización, usando una clave única como el `issueKey` o el identificador interno de Jira.

## Recorrido de incidencias durante la sincronización

El recorrido de incidencias debe intentar completar un proyecto antes de continuar con el siguiente.

Flujo conceptual:

1. Inicia la sincronización.
2. Se ejecutan las consultas configuradas por el usuario contra Jira mediante REST.
3. Jira devuelve un conjunto inicial de incidencias, incluyendo la información disponible de cada una y sus enlaces.
4. La aplicación toma la primera incidencia del conjunto inicial.
5. Consulta sus incidencias enlazadas, agrupando la mayor cantidad posible en una misma petición REST.
6. Si las incidencias enlazadas tienen más incidencias enlazadas, repite el proceso hasta completar el recorrido de ese proyecto.
7. Cuando termina el recorrido del proyecto asociado a la primera incidencia, continúa con la segunda incidencia del conjunto inicial.
8. Repite el mismo proceso hasta terminar todas las incidencias iniciales devueltas por los filtros.

Ejemplo:

```text
Se inicia la sincronización.
Los filtros configurados por el usuario devuelven 5 incidencias desde Jira.

Se procesa la incidencia 1 de 5:
- se consultan sus enlazadas en una sola petición REST cuando sea posible;
- se consultan las enlazadas de las enlazadas;
- se continúa hasta completar el proyecto.

Luego se procesa la incidencia 2 de 5.
Después la 3 de 5.
Después la 4 de 5.
Finalmente la 5 de 5.
```

Durante todo el proceso se debe agrupar la consulta de incidencias en la menor cantidad de peticiones REST posible.

Entre una petición REST a Jira y la siguiente, la aplicación debe esperar un tiempo configurado.

Este tiempo será un parámetro técnico definido en archivo de configuración interno, no visible para el usuario en la interfaz.

Ejemplo:

```json
{
  "jiraRequest": {
    "delayBetweenRequestsMs": 200
  }
}
```

Si el valor configurado es `200`, la aplicación esperará 200 milisegundos entre una petición REST a Jira y la siguiente.

El objetivo de este parámetro es evitar que la aplicación realice peticiones demasiado rápidas o agresivas contra Jira Cloud.

Además de la pausa entre peticiones, la aplicación debe considerar una parametrización técnica para controlar el tamaño de los lotes consultados.

Ejemplo:

```json
{
  "jiraRequest": {
    "delayBetweenRequestsMs": 200,
    "maxIssuesPerBatch": 25
  }
}
```

`maxIssuesPerBatch` indicaría cuántas incidencias como máximo se intentan consultar en una misma petición REST cuando se usen consultas por lote, por ejemplo mediante `issuekey IN (...)`.

## Tipos de incidencia relevantes

No se persistirán todas las incidencias enlazadas encontradas durante el recorrido.

La aplicación tendrá configurado de forma estática un conjunto de tipos de incidencia relevantes. Solo las incidencias cuyo tipo pertenezca a esa configuración serán consideradas para extracción de atributos y persistencia.

Las incidencias con tipos diferentes deben ignorarse para efectos de almacenamiento, aunque pueden ser usadas como parte del recorrido si son necesarias para llegar a otras incidencias enlazadas.

La lista de tipos de incidencia relevantes debe vivir en un archivo de configuración parametrizable interno de la aplicación. En la primera versión, esta configuración no será editable desde la interfaz del usuario.

Esto es importante porque pueden existir tipos de incidencia que no aparecen en el ejemplo real entregado inicialmente, y más adelante podrían agregarse o quitarse tipos según las necesidades de la compañía.

Ejemplo conceptual:

```json
{
  "issueTypesToPersist": [
    "Testing",
    "Testing de Criterios",
    "Criterios de aceptación",
    "Test criterios de aceptación",
    "Documentar Criterios de Aceptación",
    "Solicitud de Paso a TEST",
    "Solicitud Paso a Pre-Producción",
    "Solicitud Paso a Producción",
    "Implementación Q&A",
    "Criterios – Pruebas Automáticas"
  ]
}
```

## Atributos a extraer

De cada incidencia relevante se extraerá siempre un conjunto específico de atributos definido por la aplicación.

El resto de atributos recibidos en el JSON de Jira serán ignorados y no se persistirán.

Si una incidencia no tiene uno de los atributos configurados para extracción, ese atributo se guardará como `null` en la base de datos local.

Esto puede ocurrir porque:

- el campo todavía no tiene información;
- el campo no aplica para ese tipo de incidencia;
- el campo nunca estará disponible en esa incidencia.

La aplicación debe manejar esos casos sin error.

Lista inicial de atributos a persistir para la primera versión:

- `issueKey`: key visible de Jira, por ejemplo `AC-18405`.
- `jiraId`: identificador interno de Jira.
- `selfUrl`: URL REST de la incidencia.
- `browseUrl`: URL para abrir la incidencia en Jira.
- `projectKey`: key del proyecto Jira, por ejemplo `AC`.
- `projectName`: nombre del proyecto Jira.
- `issueType`: tipo de incidencia.
- `status`: estado actual.
- `statusCategory`: categoría del estado.
- `summary`: resumen o título.
- `description`: descripción, si se requiere y está disponible.
- `assignee`: responsable/asignado.
- `reporter`: reportador.
- `creator`: creador.
- `developer`: desarrollador, si existe como campo Jira o campo personalizado.
- `tester`: tester, si existe como campo Jira o campo personalizado.
- `criteriaResponsible`: responsable de criterios, si existe como campo Jira o campo personalizado.
- `priority`: prioridad.
- `labels`: etiquetas.
- `createdAt`: fecha de creación.
- `updatedAt`: fecha de última actualización en Jira.
- `resolution`: resolución.
- `resolutionDate`: fecha de resolución.
- `timeOriginalEstimate`: tiempo estimado original.
- `timeSpent`: tiempo registrado.
- `timeRemainingEstimate`: tiempo restante.
- `parentIssueKey`: key de incidencia padre, si aplica.
- `linkedIssueKeys`: keys de incidencias enlazadas.
- `subtaskIssueKeys`: keys de subtareas.
- `rawConfiguredFields`: objeto con valores extraídos desde campos personalizados configurados.

Esta lista inicial puede ajustarse en el archivo de configuración técnica. Si un atributo no existe para una incidencia, se guardará como `null`.

Los atributos a extraer también deben definirse en un archivo de configuración parametrizable interno de la aplicación. En la primera versión, esta configuración no será editable desde la interfaz del usuario.

Cada atributo configurado debe indicar, como mínimo:

- clave interna del atributo;
- etiqueta funcional para mostrar en pantalla;
- ruta dentro del JSON de Jira;
- tipo de dato;
- si puede usarse en filtros;
- si puede mostrarse como columna en el grid;
- si participa en cálculos.

Ejemplo conceptual:

```json
{
  "attributes": [
    {
      "key": "issueKey",
      "label": "Jira",
      "path": "key",
      "type": "string",
      "filterable": true,
      "gridColumn": true,
      "calculationInput": true
    },
    {
      "key": "issueType",
      "label": "Tipo de incidencia",
      "path": "fields.issuetype.name",
      "type": "string",
      "filterable": true,
      "gridColumn": true,
      "calculationInput": true
    },
    {
      "key": "status",
      "label": "Estado",
      "path": "fields.status.name",
      "type": "string",
      "filterable": true,
      "gridColumn": true,
      "calculationInput": true
    },
    {
      "key": "summary",
      "label": "Resumen",
      "path": "fields.summary",
      "type": "string",
      "filterable": true,
      "gridColumn": true,
      "calculationInput": false
    },
    {
      "key": "assignee",
      "label": "Responsable",
      "path": "fields.assignee.displayName",
      "type": "user",
      "filterable": true,
      "gridColumn": true,
      "calculationInput": false
    },
    {
      "key": "developer",
      "label": "Desarrollador",
      "path": "fields.customfield_XXXXX.displayName",
      "type": "user",
      "filterable": true,
      "gridColumn": true,
      "calculationInput": false
    }
  ]
}
```

Para campos personalizados de Jira, la configuración debe permitir usar rutas como `fields.customfield_XXXXX`, ya que muchos atributos de negocio pueden venir en campos personalizados.

La aplicación debe leer esta configuración para saber:

- qué atributos persistir;
- qué campos ofrecer en el constructor gráfico de filtros;
- qué columnas pueden estar disponibles en el grid;
- qué valores pueden alimentar campos calculados;
- cómo extraer cada dato desde el JSON retornado por Jira.

Esta parametrización debe evitar que la lógica de extracción quede rígida dentro del código.

## Relación entre incidencias y proyectos

La información persistida debe permitir identificar qué conjunto de incidencias pertenece a un mismo proyecto de desarrollo de software.

Regla definida para la primera versión: las incidencias enlazadas entre sí pertenecen al mismo proyecto funcional.

El proyecto funcional se construye a partir del recorrido de enlaces iniciado desde cada incidencia semilla devuelta por los filtros Jira configurados por el usuario.

Si dos incidencias semilla terminan conectándose al mismo conjunto de incidencias enlazadas, deben consolidarse en un mismo `projectGroup`.

El `projectKey` de Jira se persistirá como atributo informativo, pero no será suficiente por sí solo para identificar una fila del grid, ya que un mismo proyecto Jira puede contener varios proyectos funcionales de desarrollo.

## Consideraciones de rendimiento

La aplicación debe intentar realizar la menor cantidad posible de peticiones REST a Jira Cloud para no afectar el rendimiento de Jira en la compañía.

Datos estimados para dimensionamiento inicial:

- un proyecto puede tener en promedio 30 incidencias;
- la compañía puede tener aproximadamente 20 proyectos en curso;
- una sincronización podría involucrar alrededor de 600 incidencias, dependiendo de los filtros configurados y del recorrido de enlaces.

El diseño de sincronización debe considerar estrategias como:

- evitar consultar la misma incidencia más de una vez durante una sincronización;
- consolidar incidencias repetidas devueltas por distintos filtros;
- usar consultas por lotes cuando sea posible;
- limitar la extracción a los atributos definidos;
- persistir resultados localmente para mostrar información previa mientras se actualiza;
- evitar recorridos infinitos o innecesarios sobre enlaces ya visitados.

## Periodicidad

El usuario podrá configurar cada cuánto tiempo se ejecutará la sincronización.

El valor será definido en minutos.

Ejemplo: si el usuario configura `5`, la aplicación sincronizará cada 5 minutos, contando desde que termine la sincronización anterior.

## Consolidación de resultados

El usuario puede tener múltiples filtros JQL configurados.

Los resultados de todos los filtros se consolidarán en una sola fuente de datos local.

El grid principal mostrará la información consolidada en una misma vista.

No es necesario mostrar en el grid el nombre del filtro del cual provino cada incidencia.

Más adelante se definirá cómo manejar incidencias duplicadas cuando una misma incidencia sea devuelta por más de un filtro.

## Grid principal

La pantalla principal mostrará un grid con la información consolidada de Jira.

Cada fila del grid representará un proyecto de desarrollo de software, no una única incidencia Jira.

Las columnas del grid podrán mostrar información proveniente de distintas incidencias Jira relacionadas con ese proyecto.

Inicialmente, después de la primera sincronización, el grid mostrará un conjunto de columnas definidas por defecto por la aplicación.

Posteriormente, el usuario podrá personalizar el grid:

- agregar columnas;
- quitar columnas;
- mover columnas;
- organizar columnas según su preferencia.

Ejemplos de columnas o información que podrían mostrarse:

- descripción del proyecto;
- estado general;
- incidencia de tipo testing;
- estado de la incidencia;
- responsable;
- desarrollador;
- tester;
- documentación de criterios;
- responsable de criterios;
- cantidad de correcciones;
- automatización;
- incidencia de despliegue o montaje en test;
- porcentaje de jiras cerrados;
- tiempo planeado;
- tiempo registrado;
- tiempo restante;
- otros campos definidos por la aplicación o configurables por el usuario.

La estructura exacta del grid, las columnas por defecto y las reglas de agrupación se definirán más adelante.

## Detalle de incidencia desde el grid

Si una celda del grid muestra un número o key de incidencia Jira, esa celda debe ser cliqueable.

Las columnas que contienen otro tipo de información diferente a un número/key de incidencia no serán cliqueables; serán solo informativas.

Al hacer clic sobre una incidencia Jira en el grid:

1. No se abrirá Jira inmediatamente.
2. Se mostrará debajo del grid una sección de detalle de la incidencia.
3. El detalle mostrará todos los atributos persistidos en la base local para esa incidencia específica.

Para la primera versión, el detalle se mostrará debajo del grid como una sección fija, sin modal, sin panel lateral y sin desplegable especial.

Dentro del detalle debe existir un botón:

```text
Abrir incidencia en Jira
```

Este botón abrirá la incidencia en el navegador usando la URL base de Jira configurada y la key de la incidencia.

Ejemplo conceptual:

```text
{jiraBaseUrl}/browse/{issueKey}
```

## Campos directos y calculados

No todas las columnas del grid vendrán directamente de atributos de Jira.

Algunas columnas mostrarán valores extraídos desde atributos específicos de incidencias Jira.

Otras columnas serán calculadas por la aplicación a partir de la información obtenida durante el recorrido de incidencias enlazadas.

Ejemplos de campos calculados:

- `Correcciones`: cantidad de incidencias de tipo corrección por testing que se encuentran enlazadas al proyecto.
- `% jiras cerrados`: porcentaje de incidencias de tipo criterios de aceptación enlazadas al proyecto cuyo estado sea igual a `Cerrado`.
- `Tiempo restante`: puede derivarse de la diferencia entre tiempo planeado y tiempo registrado, según la regla que se defina más adelante.

La aplicación deberá soportar reglas de cálculo basadas en:

- tipo de incidencia;
- estado de la incidencia;
- cantidad de incidencias encontradas;
- atributos extraídos desde Jira;
- relaciones o enlaces entre incidencias.

Más adelante se definirá la lista exacta de campos calculados y la regla de negocio de cada uno.

## Referencias visuales y datos de ejemplo

Existe una imagen de borrador creada en Excel que ilustra aproximadamente cómo se quiere mostrar la información en el grid:

```text
C:\Monitor_Incidencias\Ejemplo_borrador.png
```

También existe un archivo `.zip` con un proyecto real de la compañía:

```text
C:\Monitor_Incidencias\Proyecto.zip
```

Este archivo contiene distintos tipos de incidencia que pertenecen a un mismo proyecto y que se encontraban enlazadas unas con otras.

El archivo servirá como referencia real para analizar:

- estructura de respuestas de Jira Cloud;
- tipos de incidencia existentes;
- atributos disponibles;
- enlaces entre incidencias;
- subtareas, si existen;
- forma en que la aplicación debe recorrer incidencias hasta completar un proyecto.

La aplicación debe partir de incidencias retornadas por los filtros configurados por el usuario y luego consultar Jira nuevamente para obtener sus incidencias enlazadas. Ese proceso se repetirá hasta completar el conjunto de incidencias del proyecto, evitando ciclos y extrayendo solo los tipos y atributos relevantes.

## Persistencia local

La aplicación debe persistir:

- configuración de URL base de Jira;
- filtros creados por el usuario;
- periodicidad de sincronización;
- preferencias del grid;
- última información obtenida desde Jira.

La información debe sobrevivir al cierre del navegador y al reinicio del computador.

Al abrir nuevamente la aplicación, si existe información persistida, debe poder mostrarse mientras se realiza una nueva sincronización.

## Modelo de datos local en IndexedDB

La base local debe ser sencilla y funcional. Solo se persistirá información necesaria para operar la aplicación.

No se guardará histórico funcional de incidencias, proyectos, sincronizaciones o alertas.

Stores sugeridos en `IndexedDB`:

### `appSettings`

Guarda configuración general del usuario.

Contenido sugerido:

- `jiraBaseUrl`;
- `syncIntervalMinutes`;
- `notificationPermissionStatus`;
- `lastSyncAttemptAt`;
- `lastSyncStatus`;
- `lastSyncMessage`.

### `jiraFilters`

Guarda los filtros configurados por el usuario para consultar Jira Cloud.

Contenido sugerido:

- `id`;
- `name`;
- `conditions`;
- `generatedJql`;
- `createdAt`;
- `updatedAt`.

### `alertRules`

Guarda las alertas configuradas por el usuario.

Contenido sugerido:

- `id`;
- `name`;
- `conditions`;
- `messageTemplate`;
- `createdAt`;
- `updatedAt`.

Las alertas no tendrán campo activo/inactivo. Si existen, se ejecutan.

### `issues`

Guarda el estado actual de las incidencias relevantes persistidas desde Jira.

Contenido sugerido:

- `issueKey`;
- `jiraId`;
- `projectKey`;
- `projectGroupId`;
- `issueType`;
- `status`;
- `summary`;
- `attributes`;
- `linkedIssueKeys`;
- `subtaskIssueKeys`;
- `jiraUrl`;
- `lastFetchedAt`;

`attributes` será un objeto con los atributos parametrizados extraídos desde Jira.

Solo se guarda el estado actual conocido de la incidencia.

### `projectGroups`

Guarda la agrupación consolidada que alimenta las filas del grid.

Como regla inicial, las incidencias enlazadas entre ellas pertenecen al mismo proyecto funcional.

Contenido sugerido:

- `projectGroupId`;
- `rootIssueKey`;
- `issueKeys`;
- `description`;
- `computedFields`;
- `updatedAt`.

`computedFields` guardará valores calculados necesarios para mostrar el grid o evaluar alertas.

### `gridPreferences`

Guarda preferencias del usuario sobre el grid.

Contenido sugerido:

- `visibleColumns`;
- `columnOrder`;
- `columnWidths`, si aplica;
- `updatedAt`.

### `notificationControl`

Guarda control técnico para evitar alertas repetidas.

No es un historial funcional visible para el usuario.

Contenido sugerido:

- `id`;
- `alertRuleId`;
- `issueKey`;
- `projectGroupId`;
- `fingerprint`;
- `notifiedAt`.

La `fingerprint` representa la huella del evento o cambio ya notificado.

Esta store se mantiene aunque exista la store `notifications`, porque sirve para controlar duplicados incluso después de que una notificación haya sido marcada como leída.

No debe mostrarse al usuario como historial.

### `notifications`

Guarda las notificaciones generadas por alertas y su estado de lectura.

Contenido sugerido:

- `id`;
- `fingerprint`;
- `alertRuleId`;
- `title`;
- `message`;
- `issueKey`;
- `projectGroupId`;
- `status`: `unread` o `read`;
- `createdAt`;
- `firstShownAt`;
- `lastShownAt`;
- `nextReminderAt`;
- `readAt`.

Esta store permite:

- mostrar el contador de notificaciones no leídas;
- listar notificaciones pendientes desde la campana;
- evitar duplicados;
- controlar cuándo volver a mostrar una notificación no leída.

Cuando una notificación se marca como leída, deja de aparecer en la campana y no se vuelve a mostrar como recordatorio. La aplicación puede conservarla con estado `read` solo si resulta necesario para control técnico, pero no debe ofrecerse como historial funcional al usuario.

## Qué se debe persistir

Se debe persistir únicamente lo necesario para:

- reconstruir la pantalla principal al abrir la aplicación;
- ejecutar sincronizaciones periódicas;
- comparar cambios entre la información anterior y la nueva;
- evaluar alertas;
- evitar alertas repetidas;
- permitir la personalización del grid;
- mostrar el detalle de una incidencia seleccionada.

No se debe persistir:

- JSON completo de Jira si no es necesario;
- historial de cambios;
- historial completo de alertas ya resueltas;
- acciones normales del usuario en pantalla;
- datos de tipos de incidencia no relevantes;
- atributos no parametrizados.

## Archivo de configuración técnica

La aplicación tendrá un archivo de configuración técnica parametrizable, no editable desde la interfaz del usuario en la primera versión.

Este archivo define:

- tipos de incidencia relevantes;
- atributos a extraer desde Jira;
- campos calculados;
- parámetros de peticiones REST;
- columnas por defecto del grid;
- operadores permitidos por tipo de dato;
- reglas básicas de identificación de keys de Jira.

Ejemplo conceptual:

```javascript
export const monitorConfig = {
  jiraRequest: {
    delayBetweenRequestsMs: 200,
    maxIssuesPerBatch: 25
  },
  issueTypesToPersist: [
    "Testing",
    "Testing de Criterios",
    "Testing Pre-Producción",
    "Testing Criterios Pre-Producción",
    "Criterios de aceptación",
    "Test criterios de aceptación",
    "Documentar Criterios de Aceptación",
    "Solicitud de Paso a TEST",
    "Solicitud Paso a Pre-Producción",
    "Solicitud Paso a Producción",
    "Implementación Q&A",
    "Criterios – Pruebas Automáticas",
    "Criterios Pre-Producción",
    "Admon Pre-Produccion",
    "Subtarea",
    "Aprobación"
  ],
  attributes: [],
  calculatedFields: [],
  defaultGridColumns: []
};
```

El archivo debe estar pensado para poder agregar o quitar tipos de incidencia y atributos sin cambiar la lógica principal de la aplicación.

Ejemplo conceptual de atributos dentro del archivo:

```javascript
attributes: [
  {
    key: "issueKey",
    label: "Jira",
    path: "key",
    type: "string",
    filterable: true,
    gridColumn: true,
    detail: true,
    calculationInput: true
  },
  {
    key: "jiraId",
    label: "ID Jira",
    path: "id",
    type: "string",
    filterable: false,
    gridColumn: false,
    detail: true,
    calculationInput: false
  },
  {
    key: "issueType",
    label: "Tipo de incidencia",
    path: "fields.issuetype.name",
    type: "string",
    filterable: true,
    gridColumn: true,
    detail: true,
    calculationInput: true
  },
  {
    key: "status",
    label: "Estado",
    path: "fields.status.name",
    type: "string",
    filterable: true,
    gridColumn: true,
    detail: true,
    calculationInput: true
  },
  {
    key: "summary",
    label: "Resumen",
    path: "fields.summary",
    type: "string",
    filterable: true,
    gridColumn: true,
    detail: true,
    calculationInput: false
  },
  {
    key: "assignee",
    label: "Responsable",
    path: "fields.assignee.displayName",
    type: "user",
    filterable: true,
    gridColumn: true,
    detail: true,
    calculationInput: false
  },
  {
    key: "developer",
    label: "Desarrollador",
    path: "fields.customfield_XXXXX.displayName",
    type: "user",
    filterable: true,
    gridColumn: true,
    detail: true,
    calculationInput: false
  },
  {
    key: "tester",
    label: "Tester",
    path: "fields.customfield_YYYYY.displayName",
    type: "user",
    filterable: true,
    gridColumn: true,
    detail: true,
    calculationInput: false
  },
  {
    key: "timeOriginalEstimate",
    label: "Tiempo planeado",
    path: "fields.timeoriginalestimate",
    type: "number",
    filterable: true,
    gridColumn: true,
    detail: true,
    calculationInput: true
  },
  {
    key: "timeSpent",
    label: "Tiempo registrado",
    path: "fields.timespent",
    type: "number",
    filterable: true,
    gridColumn: true,
    detail: true,
    calculationInput: true
  },
  {
    key: "linkedIssueKeys",
    label: "Incidencias enlazadas",
    path: "fields.issuelinks",
    type: "issueKeyList",
    filterable: false,
    gridColumn: false,
    detail: true,
    calculationInput: true,
    extractor: "issueLinks"
  },
  {
    key: "subtaskIssueKeys",
    label: "Subtareas",
    path: "fields.subtasks",
    type: "issueKeyList",
    filterable: false,
    gridColumn: false,
    detail: true,
    calculationInput: true,
    extractor: "subtasks"
  }
]
```

Los campos personalizados se dejarán parametrizados con `customfield_XXXXX` hasta identificar el código exacto de cada campo en Jira.

## Decisiones técnicas definidas

- La persistencia funcional será en `IndexedDB`.
- No se usará motor de base de datos externo.
- Las llamadas a Jira Cloud se harán desde el backend local Spring Boot usando API token configurado en `config/application-local.yml` para la primera versión.
- El backend local Spring Boot se usará para logs en archivos, bloqueo operativo de sincronización y soporte local.
- Las incidencias enlazadas entre ellas se consideran pertenecientes al mismo proyecto funcional.
- El modelo de datos se mantendrá simple y orientado a lo necesario para mostrar el grid, sincronizar, evaluar alertas y abrir detalle.
- La configuración de tipos, atributos, cálculos y parámetros técnicos estará en archivo parametrizable interno, no en pantalla de usuario.

## Logs

La aplicación debe generar logs para facilitar la revisión de problemas técnicos y situaciones que requieran corrección.

La preferencia es persistir los logs en archivos, no en base de datos.

Para lograrlo, la aplicación contará con un backend local liviano, ya que el navegador no puede escribir libremente archivos en una carpeta local por restricciones de seguridad.

Los logs se guardarán en una carpeta local del proyecto.

Ejemplo:

```text
C:\Monitor_Incidencias\logs\
```

Ejemplos de archivos:

```text
logs\app-2026-07-06.log
logs\sync-2026-07-06.log
```

No es necesario registrar todo lo que el usuario realiza en pantalla.

Se deben registrar solo eventos relevantes para soporte, diagnóstico o revisión.

Ejemplos de eventos a registrar:

- inicio y fin de sincronización;
- errores de conexión con Jira;
- respuestas HTTP fallidas;
- incidencias que no pudieron consultarse;
- errores al parsear JSON;
- errores de persistencia local;
- advertencias de sincronización parcial;
- errores al evaluar alertas;
- errores inesperados de la aplicación.

Ejemplos de eventos que no deben registrarse:

- cada clic del usuario;
- cada cambio visual;
- navegación normal por pantalla;
- datos excesivos de incidencias si no aportan diagnóstico.

## Notificaciones y avisos

La aplicación permitirá configurar alertas o notificaciones de advertencia.

Las alertas se configuran por el usuario desde la aplicación, usando una interfaz similar al constructor gráfico de filtros.

Las alertas no consultan Jira directamente. Se evalúan contra la información persistida en la base local y contra los cambios detectados durante la sincronización.

Cada alerta deberá tener:

- nombre;
- condiciones configurables;
- soporte para condiciones `AND` y `OR`;
- texto o mensaje de notificación configurable;
- ejecución automática desde el momento en que se crea.

No existirá un estado activo/inactivo para alertas. Si una alerta existe, se ejecuta. Si el usuario no la necesita, debe eliminarla o modificarla.

Se espera que cada usuario configure pocas alertas. No se espera un listado grande de alertas por usuario.

## Acknowledge de notificaciones

Las notificaciones generadas por alertas manejarán confirmación de lectura o acknowledge.

En la primera versión, el usuario marcará las notificaciones como leídas desde la aplicación, no desde el mensaje nativo del sistema operativo.

La pantalla principal debe mostrar un ícono de campana, preferiblemente en la parte superior.

La campana mostrará un contador con el total de notificaciones no leídas.

Al hacer clic en la campana:

1. Se mostrará un listado de notificaciones no leídas.
2. El usuario podrá revisar el título y mensaje de cada notificación.
3. El usuario podrá marcar una notificación como leída.
4. Al marcarla como leída, deja de contarse en la campana y no se vuelve a mostrar como recordatorio.

Cerrar una notificación nativa del sistema operativo no cuenta como lectura.

Una notificación solo se considera leída cuando el usuario la marca explícitamente como leída desde la aplicación.

No deben existir dos notificaciones exactamente iguales. Si ya existe una notificación igual y está no leída, no debe duplicarse aunque la misma condición vuelva a cumplirse en una sincronización posterior o venga de otro filtro.

Para identificar duplicados, la aplicación debe generar una `fingerprint` con los datos relevantes de la alerta, por ejemplo:

- regla de alerta;
- incidencia;
- proyecto funcional;
- tipo de evento;
- campo evaluado;
- valor anterior y valor nuevo, cuando aplique.

Si la `fingerprint` ya existe como notificación no leída, se conserva la notificación existente.

## Recordatorio de notificaciones no leídas

Si una notificación fue mostrada y el usuario no la marcó como leída, debe volver a mostrarse posteriormente.

No debe volver a mostrarse en cada sincronización.

La repetición debe respetar un intervalo parametrizado en la configuración técnica de la aplicación.

Ejemplo:

```javascript
notifications: {
  unreadReminderIntervalMinutes: 60
}
```

Si el valor es `60` y una notificación se muestra a las 9:30 a. m. sin ser leída, podrá volver a mostrarse a partir de las 10:30 a. m.

La campana siempre mostrará el total de notificaciones no leídas, aunque todavía no haya llegado el momento de volver a mostrarlas como recordatorio.

## Evaluación de alertas

Las alertas se evaluarán durante el proceso de sincronización.

Para cada incidencia relevante procesada:

1. La aplicación obtiene la información nueva recibida desde Jira.
2. Antes de insertar o actualizar la base local, busca la versión actual de esa incidencia en la base de datos local.
3. Compara la versión anterior con la versión nueva.
4. Construye un contexto de evaluación con la incidencia anterior, la incidencia nueva y los campos que cambiaron.
5. Evalúa las alertas configuradas contra ese contexto.
6. Si una alerta se cumple y no corresponde a una notificación ya enviada, se agrega a una cola temporal en memoria.
7. La aplicación inserta o actualiza la incidencia en la base local.

Al finalizar toda la sincronización, después de persistir los datos y refrescar el grid, la aplicación procesa la cola de notificaciones y las muestra una por una.

Ejemplos de alertas:

- notificar si se crea una nueva incidencia de un tipo específico asignada a una persona específica;
- notificar si una incidencia de tipo montaje en test cambia su estado a `Cerrado`;
- notificar si una incidencia existente cambia de responsable;
- notificar si una incidencia cumple varias condiciones combinadas con `AND` u `OR`;
- notificar si un campo calculado alcanza determinado valor.

Ejemplo conceptual de condición:

```text
Tipo de incidencia = "Documentar Criterios de Aceptación"
AND Responsable = "Pepito Pérez"
AND Es nueva = true
```

Ejemplo conceptual de condición sobre cambio:

```text
Tipo de incidencia = "Solicitud de Paso a TEST"
AND Estado anterior != "Cerrado"
AND Estado nuevo = "Cerrado"
```

## Alertas sobre campos calculados

Las alertas también podrán configurarse sobre campos calculados por la aplicación.

Ejemplo:

```text
% jiras cerrados = 100
```

Para esto, los campos calculados que puedan usarse en alertas deberán estar definidos en la configuración interna de campos o en una configuración equivalente.

## Control de alertas repetidas

Aunque no se guardará histórico funcional de alertas para consulta del usuario, sí se agregará una tabla local de control técnico para evitar notificaciones repetidas.

Esta tabla permitirá saber qué alerta ya fue enviada para una incidencia, campo, condición o cambio específico.

El objetivo es evitar que una misma condición siga notificándose en cada sincronización si no ha ocurrido un cambio nuevo.

Estructura conceptual:

- identificador de la alerta;
- key de la incidencia;
- tipo de evento o condición;
- huella del cambio notificado;
- fecha/hora técnica de envío.

Esta información se usará solo como control interno, no como historial visible para el usuario.

## Cola de notificaciones

Las notificaciones no se mostrarán inmediatamente cuando se detectan.

Durante la sincronización, las alertas cumplidas se acumularán en una cola temporal en memoria.

Al terminar la sincronización, después de actualizar la base local y refrescar el grid, se persistirán las notificaciones nuevas no duplicadas y se procesará la cola.

Las notificaciones se mostrarán una por una:

1. Se muestra una notificación.
2. Se espera el tiempo de visualización configurado o definido por defecto.
3. La notificación se cierra automáticamente o desaparece según el comportamiento del navegador/sistema operativo.
4. Se muestra la siguiente.
5. El proceso continúa hasta completar la cola.

Las notificaciones no leídas existentes también podrán entrar en la cola si ya se cumplió su `nextReminderAt`.

## Tecnología de notificaciones

Para cumplir el requisito de mostrar notificaciones aunque el navegador esté minimizado, el usuario esté en otra pestaña o esté usando otra aplicación, se utilizará la Web Notifications API del navegador.

Esta API permite mostrar notificaciones nativas del sistema operativo, siempre que:

- la aplicación esté abierta en el navegador;
- el usuario haya concedido permiso para mostrar notificaciones;
- el navegador soporte la API.

La aplicación deberá solicitar permiso al usuario para mostrar notificaciones.

Para la primera versión, las notificaciones solo se mostrarán mientras la aplicación esté abierta en el navegador.

En la primera versión, las notificaciones nativas no tendrán botón de `Leído`.

En una segunda versión se evaluará agregar marcación de notificación leída directamente desde el mensaje nativo de Chrome. Para esto sería necesario usar notificaciones persistentes mediante `ServiceWorkerRegistration.showNotification(...)` y manejar acciones desde un service worker.

## Contenido de las notificaciones

El texto de la notificación podrá ser parte de la configuración de la alerta.

La notificación podrá incluir información como:

- nombre de la alerta;
- texto configurado por el usuario;
- key de la incidencia;
- tipo de incidencia;
- resumen corto;
- campo que cambió;
- valor anterior;
- valor nuevo;
- proyecto o descripción relacionada, si está disponible.

Ejemplo:

```text
Alerta: Montaje Test cerrado
AC-951 cambió de En Progreso a Cerrado
```

Ejemplo:

```text
Alerta: Nueva incidencia asignada
AC-456 fue asignada a Pepito Pérez
```

## Acción al hacer clic en una notificación

Se desea que al hacer clic en una notificación el usuario pueda:

- abrir la incidencia relacionada en Jira;
- o volver/enfocar la aplicación local.

Esta funcionalidad se incluirá en la primera versión si no implica una complejidad alta. Si resulta compleja, quedará como mejora para una versión posterior.

## Pendientes por definir

Estos puntos no bloquean el inicio del desarrollo. Pueden resolverse durante la implementación de cada módulo.

- Diseño detallado del constructor gráfico de filtros.
- Operadores disponibles por tipo de dato.
- Manejo de grupos de condiciones, `AND`, `OR` y posibles paréntesis.
- Reglas para incidencias duplicadas devueltas por varios filtros.
- Mapeo exacto de campos personalizados `customfield_XXXXX` contra sus nombres funcionales.
- Columnas por defecto definitivas del grid.
- Reglas específicas de cálculo para cada campo calculado.
- Diseño visual de la pantalla principal y pantalla de configuración.
- Criterios de error para marcar sincronización en verde, naranja o rojo.
- Definición final de mensajes por defecto para notificaciones.
- Criterios de aceptación.

## Faltantes mínimos para comenzar desarrollo

Para comenzar a desarrollar con seguridad, solo falta preparar valores y decisiones operativas iniciales:

- Definir el email Jira y API token que se colocarán en `config/application-local.yml` para pruebas locales.
- Confirmar que el backend Spring Boot podrá salir a internet/red corporativa para consumir `https://puertodecartagena.atlassian.net`.
- Definir el primer valor de `syncIntervalMinutes` para pruebas.
- Definir el primer valor de `jiraRequest.delayBetweenRequestsMs`, sugerido inicialmente en `200`.
- Definir el primer valor de `jiraRequest.maxIssuesPerBatch`, sugerido inicialmente en `25`.
- Identificar al menos los `customfield_XXXXX` indispensables para responsable/desarrollador/tester si se desean mostrar desde la primera iteración.

Si alguno de estos datos no está disponible al inicio, se puede comenzar usando datos del `Proyecto.zip` como fixture local y luego conectar Jira real.
