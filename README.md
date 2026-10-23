# 📖 Socrix — Aprende de tus PDFs con IA

> **Sube tus apuntes o libros en PDF y ponte a prueba con cuestionarios interactivos de "2 mentiras y 1 verdad" generados con IA.**

[![Next.js](https://img.shields.io/badge/Next.js-16.3-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Supabase-pgvector-emerald?style=for-the-badge&logo=supabase)](https://supabase.com/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3.4-38bdf8?style=for-the-badge&logo=tailwindcss)](https://tailwindcss.com/)
[![Vitest](https://img.shields.io/badge/Vitest-3.2-yellow?style=for-the-badge&logo=vitest)](https://vitest.dev/)

---

## 💡 ¿Qué es Socrix?

**Socrix** es una aplicación web de estudio que te ayuda a comprobar si realmente entendiste lo que leíste o si solo tienes la sensación de haberlo aprendido.

En lugar de hacerte preguntas típicas de memoria, Socrix analiza cualquier PDF que subas y crea preguntas de **"2 mentiras y 1 verdad"**:
1. Plantea afirmaciones engañosas pero creíbles basadas en tu documento.
2. Te reta a identificar cuál es la única afirmación verdadera.
3. Te muestra el fragmento exacto del PDF original que justifica la respuesta correcta.

---

## ✨ Funcionalidades Principales

- 📄 **Carga de PDFs y Extracción de Texto**: Sube documentos de hasta 50 MB (limitado a 4.5 MB en Vercel). La app extrae el texto, divide los capítulos y guarda los fragmentos con su número de página original.
- 🎯 **Preguntas Basadas 100% en el Documento**: Usa búsqueda por vectores en base de datos (`pgvector`) para que la IA responda únicamente con información del texto subido, sin inventar datos.
- 📊 **Seguimiento de Confianza**: Antes de responder, indicas qué tan seguro estás de tu respuesta. La app te muestra si sueles tener exceso de confianza en temas que aún no dominas.
- 🧠 **Repetición Espaciada (SM-2)**: Agenda repasos automáticos de los conceptos que más te costaron en intervalos de días calculados según tu rendimiento.
- 👤 **Cuentas de Usuario y Biblioteca**: Inicia sesión para guardar tu historial de lectura, ver estadísticas de aciertos y gestionar tus documentos.
- 🌐 **Totalmente Bilingüe**: Puedes usar la interfaz y generar preguntas tanto en español como en inglés.

---

## 🛠️ Tecnologías Utilizadas

| Parte | Tecnologías |
|---|---|
| **Frontend & Backend** | Next.js 16 (App Router), React 19, TypeScript |
| **Diseño e Interfaz** | Tailwind CSS, Shadcn UI, Framer Motion, Lucide Icons |
| **Base de Datos & Búsqueda Vectorial** | Supabase (PostgreSQL 15+ con extensión `pgvector`) |
| **Autenticación** | Supabase Auth con sesiones seguras y cookies |
| **Modelos de IA** | OpenAI (GPT-4o-mini), DeepSeek, Qwen |
| **Embeddings** | OpenAI `text-embedding-3-small` (1536 dimensiones) |
| **Pruebas y Calidad** | Vitest (248 pruebas unitarias), Playwright (E2E), ESLint |

---

## 🚀 Cómo Ejecutar el Proyecto Localmente

### 1. Requisitos Previos

- **Node.js**: v20 o superior
- **Cuenta de Supabase**: Proyecto gratuito en [supabase.com](https://supabase.com)
- **API Key de OpenAI**: Clave de OpenAI para la generación de texto y embeddings

### 2. Instalación y Configuración

1. Clona el repositorio e instala las dependencias:
   ```bash
   git clone git@github.com:jsan2321/socratic-cross-examiner.git
   cd socratic-cross-examiner
   npm install
   ```

2. Crea tu archivo `.env.local`:
   ```bash
   cp .env.example .env.local
   ```

3. Completa tus credenciales en `.env.local`:
   ```env
   NEXT_PUBLIC_APP_URL=http://localhost:3000

   # Supabase
   SUPABASE_URL=https://tu-proyecto.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key
   SUPABASE_ANON_KEY=tu-anon-key
   NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON=tu-anon-key

   # IA
   AI_PROVIDER=openai
   AI_MODEL=gpt-4o-mini
   AI_TEMPERATURE=0.7
   OPENAI_API_KEY=sk-tu-clave-de-openai

   EMBEDDING_MODEL=text-embedding-3-small
   MAX_UPLOAD_MB=50
   MAX_INGESTION_SECONDS=50
   ```

### 3. Migraciones de Base de Datos

En el **SQL Editor** de tu panel de Supabase, ejecuta los archivos SQL de la carpeta `supabase/migrations/` en orden del `0001` al `0013`.

### 4. Iniciar Servidor de Desarrollo

```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000) en tu navegador.

---

## 🧪 Pruebas Automatizadas

```bash
# Verificación de tipos TypeScript
npm run typecheck

# Pruebas unitarias e integración (248 tests con Vitest)
npm run test:unit

# Pruebas End-to-End con Playwright
npm run test:e2e

# Verificación de variables y conexión antes de desplegar
npm run preflight:deploy
```

---

## 📁 Estructura del Proyecto

```
socratic-cross-examiner/
├── src/
│   ├── app/                # Rutas y páginas de Next.js (Dashboard, Quiz, Auth, API)
│   ├── components/         # Componentes de UI (Tarjetas, Preguntas, Gráficos)
│   ├── lib/
│   │   ├── ai/             # Conexión con proveedores de IA (OpenAI, DeepSeek, Qwen)
│   │   ├── auth/           # Gestión de usuarios y sesiones
│   │   ├── db/             # Conexión a Supabase y consultas SQL/pgvector
│   │   ├── i18n/           # Traducciones (Español / Inglés)
│   │   ├── pdf/            # Procesamiento de archivos PDF
│   │   └── repetition/     # Algoritmo de repetición espaciada SM-2
│   ├── schemas/            # Validación de datos con Zod
│   └── types/              # Definiciones de TypeScript
├── supabase/
│   └── migrations/         # Scripts SQL de la base de datos
└── tests/                  # Pruebas unitarias y de integración
```

---

## 📄 Licencia

Este proyecto está bajo la Licencia MIT.
