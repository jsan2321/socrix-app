# 🎓 The Socratic Cross-Examiner — Plataforma de Evaluación Socrática con IA & RAG

> **Elimina la ilusión de competencia mediante evaluaciones socráticas de "2 Mentiras + 1 Verdad" fundamentadas directamente en tus documentos.**

[![Next.js](https://img.shields.io/badge/Next.js-16.3-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Supabase-pgvector-emerald?style=for-the-badge&logo=supabase)](https://supabase.com/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3.4-38bdf8?style=for-the-badge&logo=tailwindcss)](https://tailwindcss.com/)
[![Vitest](https://img.shields.io/badge/Vitest-3.2-yellow?style=for-the-badge&logo=vitest)](https://vitest.dev/)

---

## 🌟 Descripción General

**The Socratic Cross-Examiner** es una plataforma educativa full-stack de práctica de recuperación (*retrieval practice*) basada en IA. A diferencia de los cuestionarios tradicionales que promueven la memorización superficial, este sistema evalúa la comprensión conceptual profunda y expone puntos ciegos de conocimiento.

El sistema procesa cualquier archivo PDF, lo divide en fragmentos semánticos respetando encabezados y coordenadas de página, y genera desafíos de **"2 Mentiras + 1 Verdad"** mediante un motor de IA que asume el rol de "Abogado del Diablo". Los distractores están diseñados deliberadamente como conceptos erróneos altamente plausibles, obligando al estudiante a discriminar con rigor la verdad y evitando la ilusión de competencia.

---

## ✨ Características Principales

- 📄 **Ingesta y Segmentación Semántica de PDFs**: Analiza documentos en memoria, extrayendo estructura jerárquica (encabezados, párrafos y números de página) con saneamiento automático contra caracteres nulos (`\u0000`).
- ⚡ **RAG Fundamentado con pgvector (Cero Alucinaciones)**: Genera embeddings de 1536 dimensiones (`text-embedding-3-small`) indexados con **HNSW** en Supabase PostgreSQL para recuperar evidencia con procedencia exacta del documento.
- 🎯 **Motor Socrático del "Abogado del Diablo"**: Formula preguntas de razonamiento donde dos afirmaciones son sutiles falacias plausibles y una es la verdad, invirtiendo la carga cognitiva del estudiante.
- 📊 **Trazador de Confianza y Calibración Metacognitiva**: Registra el nivel de certeza del usuario en cada respuesta frente a su precisión real, detectando sesgos de sobreconfianza mediante gráficos interactivos y alertas de brecha de comprensión.
- 🧠 **Repetición Espaciada (Algoritmo SM-2)**: Programa automáticamente repasos en intervalos optimizados según la dificultad y el rendimiento histórico del usuario.
- 🛡️ **Seguridad y Resiliencia de Nivel de Producción**:
  - Control de acceso multiusuario mediante **Supabase Auth** y **Row-Level Security (RLS)** en todas las tablas.
  - *Rate limiting* atómico distribuido en PostgreSQL para prevenir abusos en endpoints serverless.
  - Validación estricta con esquemas **Zod** y bucle de autoreparación ante respuestas malformadas de LLMs.
  - Arquitectura multi-proveedor (**OpenAI**, **DeepSeek**, **Qwen**) con mecanismo de respaldo silencioso (*fallback circuit-breaker*).
- 🌐 **Soporte Bilingüe Nativo (Español / Inglés)**: Interfaz de usuario e inferencia de preguntas completamente localizadas.
- 📁 **Gestión de Biblioteca y Dashboard**: Flujo de carga en dos fases (previsualización/edición antes de procesar), cancelación y eliminación en cascada de documentos y sesiones.

---

## 🛠️ Stack Tecnológico

| Capa | Tecnologías |
|---|---|
| **Frontend & Servidor** | Next.js 16 (App Router), React 19, TypeScript (Strict Mode) |
| **Estilos & UI** | Tailwind CSS, Lucide Icons, Shadcn UI, Framer Motion |
| **Base de Datos & Búsqueda Vectorial** | Supabase PostgreSQL 15+ con extensión `pgvector` (índices HNSW) |
| **Autenticación & Autorización** | Supabase Auth (SSR Cookies) con políticas RLS y middleware fail-closed |
| **Modelos de Lenguaje (LLMs)** | OpenAI (GPT-4o-mini, GPT-4o), DeepSeek V3, Qwen (Alibaba Cloud) |
| **Embeddings** | OpenAI `text-embedding-3-small` (1536 dimensiones) |
| **Testing & Calidad** | Vitest (38 suites de pruebas unitarias e integración), Playwright (E2E), ESLint |

---

## 🚀 Instalación y Puesta en Marcha

### 1. Requisitos Previos

- **Node.js**: v20.0.0 o superior
- **Cuenta de Supabase**: Proyecto en [supabase.com](https://supabase.com) (o instancia local mediante Supabase CLI)
- **API Key de IA**: OpenAI API Key (requerida para embeddings), y opcionalmente DeepSeek / Qwen.

### 2. Configuración de Variables de Entorno

Clona el repositorio e ingresa a la carpeta del proyecto:

```bash
git clone git@github.com:jsan2321/socratic-cross-examiner.git
cd socratic-cross-examiner
cp .env.example .env.local
```

Configura tu archivo `.env.local`:

```env
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Supabase
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key-secreta
SUPABASE_ANON_KEY=tu-anon-key-publica
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON=tu-anon-key-publica

# Proveedor de IA ('openai' | 'deepseek' | 'qwen')
AI_PROVIDER=openai
AI_MODEL=gpt-4o-mini
AI_TEMPERATURE=0.7

# API Keys
OPENAI_API_KEY=sk-tu-openai-key
# DEEPSEEK_API_KEY=sk-tu-deepseek-key
# QWEN_API_KEY=sk-tu-qwen-key

# Embeddings y Límites
EMBEDDING_MODEL=text-embedding-3-small
MAX_UPLOAD_MB=50
MAX_INGESTION_SECONDS=50
```

### 3. Migraciones de Base de Datos

Aplica los scripts SQL en el **Editor SQL de Supabase** en estricto orden secuencial:

1. `supabase/migrations/0001_init_extensions.sql` (Habilita la extensión `vector`)
2. `supabase/migrations/0002_documents.sql`
3. `supabase/migrations/0003_document_chunks.sql`
4. `supabase/migrations/0004_quiz_questions_and_statements.sql`
5. `supabase/migrations/0005_sessions_and_answers.sql`
6. `supabase/migrations/0006_match_document_chunks.sql` (Función RPC para búsqueda por similitud)
7. `supabase/migrations/0007_auth_user_links.sql` (Políticas RLS y vinculación de usuarios)
8. `supabase/migrations/0008_dashboard_indexes.sql`
9. `supabase/migrations/0009_quiz_generation_idempotency.sql`
10. `supabase/migrations/0010_repetition_schedule.sql` (Tabla de repetición espaciada SM-2)
11. `supabase/migrations/0011_session_question_target.sql`
12. `supabase/migrations/0012_session_quiz_language.sql`
13. `supabase/migrations/0013_production_hardening.sql` (Índices HNSW, chunks reanudables y rate limiting distribuido)

### 4. Ejecución en Desarrollo

```bash
npm install
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000) en tu navegador.

---

## 🧪 Pruebas y Validación de Calidad

El proyecto cuenta con una cobertura integral de pruebas automatizadas:

```bash
# Verificación de tipos TypeScript
npm run typecheck

# Análisis estático de código (Linter)
npm run lint

# Escaneo de seguridad contra fugas de claves y secretos
npm run test:security

# Pruebas Unitarias e Integración (Vitest - 248 pruebas)
npm run test:unit

# Pruebas End-to-End (Playwright)
npm run test:e2e

# Validación de despliegue en producción (Preflight)
npm run preflight:deploy

# Prueba de humo sobre el dominio en vivo
TARGET_URL=https://tu-app.vercel.app npm run test:smoke:prod
```

---

## 📁 Estructura del Código

```
socratic-cross-examiner/
├── .github/workflows/      # Flujo de Integración Continua (CI en GitHub Actions)
├── src/
│   ├── app/                # Next.js App Router (Páginas, Rutas de API, Auth, Dashboard)
│   ├── components/         # Componentes React (Quiz, Dashboard, UI, Temas, Navegación)
│   ├── hooks/              # Custom Hooks para gestión de estado y sesión
│   ├── lib/
│   │   ├── ai/             # Adaptadores multi-proveedor LLM y conmutación por error
│   │   ├── auth/           # Utilidades de autenticación y comprobaciones de propiedad
│   │   ├── confidence/     # Cálculos del Trazador de Confianza y detección de brechas
│   │   ├── db/             # Clientes Supabase, queries relacionales y operaciones pgvector
│   │   ├── i18n/           # Diccionarios bilingües (Español / Inglés) y contexto
│   │   ├── pdf/            # Parser de PDF, sanitización de caracteres y chunking
│   │   ├── repetition/     # Motor de repetición espaciada SuperMemo (SM-2)
│   │   └── security/       # Rate limiting distribuido en PostgreSQL
│   ├── schemas/            # Esquemas de validación Zod (Base de datos y API)
│   └── types/              # Definiciones de tipos TypeScript
├── supabase/
│   └── migrations/         # 13 migraciones versionadas en PostgreSQL + pgvector
├── scripts/                # Scripts de auditoría de secretos, benchmark y preflight
└── tests/                  # Suites de pruebas (Unitarias, Integración y E2E)
```