# AgentFlow

> Orquestación de agentes de IA con un archivo YAML. Como Kubernetes, pero para pipelines inteligentes.

---

## ¿Qué es AgentFlow?

AgentFlow es una plataforma open source para construir pipelines de agentes de IA que corren solos, de punta a punta, sin intervención humana.

La idea central es simple: tú defines **qué** quieres que pase en un archivo YAML. AgentFlow se encarga del **cómo**.

```yaml
pipeline: wellness-website
trigger: stripe.payment.success

agents:
  - research
  - copywriter
  - identity
  - frontend
  - qa

output:
  type: website
  deploy: vercel
  notify: email
```

Eso es todo lo que necesitas escribir. El sistema hace el resto.

---

## El problema que resuelve

Construir con agentes de IA hoy en día es caótico. Tienes agentes sueltos que nadie monitorea, prompts hardcodeados en el código, cero visibilidad de costos, y cuando algo falla nadie sabe por qué.

AgentFlow resuelve eso con tres principios:

**Declarativo.** Describes el estado deseado, no los pasos para llegar. Igual que k8s.

**Observable.** Cada agente reporta su estado, costo y output. Nada ocurre en silencio.

**Autónomo.** Una vez configurado, el pipeline corre solo. Tú solo intervienes cuando algo falla — y el sistema te avisa exactamente dónde y por qué.

---

## Cómo funciona

El flujo completo tiene cuatro momentos:

```
Trigger → Orquestador → Agentes → Output
```

**1. Trigger.** Algo dispara el pipeline: un pago en Stripe, un formulario enviado, un mensaje, una tarea en Linear. AgentFlow escucha el evento y arranca el job.

**2. Orquestador.** Lee el YAML, construye el grafo de dependencias entre agentes (el DAG), y los ejecuta en el orden correcto — paralelizando todo lo que puede.

**3. Agentes.** Cada agente es un `AgentPod` — una unidad aislada con su propio prompt, modelo, límite de tokens, timeout y validación de output. Se pueden combinar, reordenar y reemplazar sin tocar el resto del sistema.

**4. Output.** El resultado se ensambla, se deploya (website en Vercel, post en redes, email, etc.) y se entrega al cliente con sus credenciales — sin que el operador haga nada.

---

## Los tres niveles de control

AgentFlow está diseñado para ser usado de tres formas distintas según quién lo opera:

| Nivel | Interfaz | Para quién |
|---|---|---|
| Visual | Canvas drag & drop (GUI) | Operadores sin código |
| Declarativo | `agentflow.yaml` | Developers |
| Autónomo | Runtime | Nadie — corre solo |

Los tres niveles están sincronizados: cualquier cambio en la GUI actualiza el YAML, y cualquier cambio en el YAML se refleja en la GUI. El YAML es siempre el source of truth.

---

## Conceptos clave

### AgentPod

Un `AgentPod` es la unidad básica del sistema. Es un agente de IA envuelto en un contrato estandarizado que el runtime puede gestionar.

Un agente suelto es una función que llama a un LLM y devuelve texto. Un `AgentPod` es ese mismo agente, pero con:

- Contexto del cliente inyectado automáticamente
- Validación del output contra un schema
- Conteo de tokens y control de presupuesto
- Retry automático con backoff exponencial
- Checkpoint a Redis para recuperación ante fallas
- Lifecycle hooks (`onStart`, `onDone`, `onFail`)

Cualquier agente que implemente la interfaz `AgentPod` puede conectarse al canvas con drag & drop, sin tocar el runtime.

---

### El YAML spec

El archivo `agentflow.yaml` es el documento completo de un pipeline. Controla todo:

```yaml
apiVersion: florai/v1
kind: Pipeline
namespace: web
name: wellness-website

trigger:
  source: stripe.payment.success
  intake: forms.wellness-intake-v3   # formulario que alimenta el contexto

context:
  builder: wellness-context-v2       # convierte el form en JSON estructurado
  shared: true                       # todos los agentes ven el mismo contexto

agents:
  - name: research
    image: agents/research:v1.2
    resources:
      tokens: 3000
      timeout: 45s

  - name: copywriter
    image: agents/copywriter:v2.0
    dependsOn: [research]            # espera a research antes de correr
    resources:
      tokens: 5000
      timeout: 60s

  - name: frontend
    dependsOn: [copywriter, identity] # corre cuando ambos terminan
    resources:
      tokens: 8000
      timeout: 120s

  - name: qa
    dependsOn: [frontend]
    minScore: 0.80                   # si baja de 80%, reintenta frontend

policy:
  concurrency: 3                     # máx 3 pipelines en paralelo
  budget: $4.00                      # mata el job si supera este costo
  retries: 2
  backoff: exponential
  onFailure: dead-letter-queue

output:
  type: website
  deploy:
    provider: vercel
    domain: "{{ client.domain }}"
  notify:
    channel: email
    template: emails/delivery-es.md
```

Los pipelines soportan `extends` — puedes tener un `base-website.yaml` y sobreescribir solo lo que cambia por nicho. Cuando mejoras la base, todos los pipelines heredan la mejora.

---

### El runtime

El runtime es el motor invisible. Lee el YAML, lo compila a un grafo ejecutable, y hace todo lo que no quieres hacer manualmente:

- Resuelve el orden de ejecución (DAG automático)
- Paraleliza agentes cuando sus dependencias lo permiten
- Escala workers según la carga
- Persiste estado en Redis para recuperación ante fallas
- Mata jobs que superan el budget
- Envía alertas solo cuando algo falla, no en cada paso

---

## Arquitectura en capas

```
┌─────────────────────────────────────┐
│  Capa 1 — Superficie del cliente    │
│  Landing · Intake form · Pago       │
└──────────────┬──────────────────────┘
               │ webhook trigger
┌──────────────▼──────────────────────┐
│  Capa 2 — Orquestador               │
│  Job queue · State machine ·        │
│  Context builder · Retry engine     │
└──────────────┬──────────────────────┘
               │ dispatch agents
┌──────────────▼──────────────────────┐
│  Capa 3 — AgentPods                 │
│  Research · Copy · Identity ·       │
│  Frontend · QA · SEO                │
└──────────────┬──────────────────────┘
               │ assembled output
┌──────────────▼──────────────────────┐
│  Capa 4 — Output engine             │
│  Assembler · Deploy · Email ·       │
│  DNS / dominio                      │
└──────────────┬──────────────────────┘
               │ siempre activo
┌──────────────▼──────────────────────┐
│  Capa 5 — Observabilidad            │
│  Logs · Cost tracker · Dashboard ·  │
│  Alertas por excepción              │
└─────────────────────────────────────┘
```

---

## Stack tecnológico

| Componente | Tecnología | Por qué |
|---|---|---|
| Canvas GUI | React Flow | Librería base de nodos, MIT, battle-tested |
| State management | Zustand | AST store sincronizado con el YAML |
| YAML parser | js-yaml | Parseo y serialización bidireccional |
| Job queue | BullMQ + Redis | Persistencia, retry, dead-letter-queue |
| Agent orchestration | LangGraph | Orquestación multi-agente con estado |
| Deploy automático | Vercel API | Deploy programático sin fricción |
| Email transaccional | Resend | Envío de credenciales al cliente |
| Monitoreo | Grafana + Prometheus | Dashboards de costo, latencia, estado |
| Modelos LLM | Anthropic / OpenAI / Groq | Intercambiables por agente |

---

## Modelo de negocio

AgentFlow es open source bajo licencia MIT. El modelo de monetización se basa en dos capas:

**Agencia propia.** El mismo sistema se usa internamente para producir websites, contenido y aplicaciones para clientes finales. Los primeros clientes validan el pipeline y financian el desarrollo.

**Servicios premium.** Hosting gestionado, soporte prioritario, agentes pre-construidos por industria, y acceso a pipelines de nicho listos para usar.

---

## Estado actual

El proyecto está en fase de diseño de arquitectura y especificación técnica. Los próximos pasos son:

1. Definir el schema completo del AST
2. Implementar el compilador YAML → AST → jobs
3. Construir el primer AgentPod funcional (copywriter)
4. Conectar el canvas de React Flow al AST store
5. Primer pipeline end-to-end: formulario → website deployado

---

## Desarrollo local

Requisitos: **Node.js ≥ 20**, **pnpm ≥ 9**, **Python ≥ 3.12** y [**uv**](https://docs.astral.sh/uv/) instalado.

Tras clonar el repositorio, instala dependencias de Node y sincroniza los entornos Python de la API y del runtime:

```bash
pnpm run setup
```

Equivale a `pnpm install` más `uv sync --group dev` en `apps/api` y `services/runtime`. Para repetir solo la parte Python:

```bash
pnpm run setup:python
```

El detalle de cómo levantar Postgres, Redis, API y web está en [CLAUDE.md](./CLAUDE.md) (comandos de infraestructura y servicios).

---

## Contribuir

AgentFlow está diseñado para ser extendido. Cualquier agente que implemente la interfaz `AgentPod` puede integrarse al sistema. Cualquier output que implemente `OutputRouter` puede recibir el resultado de un pipeline.

La documentación completa de la interfaz y el contrato de integración estará disponible con el primer release.

---

*AgentFlow — build once, run forever.*