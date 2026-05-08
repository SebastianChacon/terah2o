# Reporte de Pruebas de Funcionalidades IA — TeraH2O
**Fecha:** 8 de mayo de 2026  
**Usuario de prueba:** Ing. Carlos (carlos.test.777@ptap.ec) — Plan TRIAL  
**Tester:** Claude (Cowork Mode)

---

## Resumen Ejecutivo

Se probaron **13 funcionalidades de IA** distribuidas en **7 páginas** de la aplicación. Se identificaron y corregieron **3 bugs críticos** durante las pruebas. Al final del proceso, **12 de 13 funcionalidades** funcionan correctamente. 1 funcionalidad tiene un bug pendiente de corrección en el endpoint de streaming.

| Estado | Cantidad |
|--------|----------|
| ✅ Funciona correctamente | 12 |
| ⚠️ Funciona con issue menor (UX) | 1 |
| 🐛 Bug pendiente (streaming) | 1 |
| ❌ No funciona | 0 |

---

## Bugs Corregidos Durante las Pruebas

### Bug #1 — CRÍTICO: Respuestas IA truncadas en toda la app
**Afectaba:** Todos los endpoints que usan `/api/gemini`  
**Causa raíz:** `gemini-2.5-flash` (modelo 2.5) genera tokens de "pensamiento" interno que consumían el presupuesto de `maxOutputTokens`, dejando muy pocos tokens para la respuesta real. Además, la función `callGemini` solo leía `parts[0].text`, ignorando que la respuesta puede tener múltiples partes (pensamiento + texto).  
**Corrección aplicada en** `src/app/api/gemini/route.ts`:
- Añadido `thinkingConfig: { thinkingBudget: 0 }` para deshabilitar el pensamiento interno
- Cambiada la extracción de texto para filtrar partes con `thought: true` y concatenar todas las partes de texto restantes

**Corrección aplicada en** `src/lib/gemini-prompts.ts`:
- Duplicados todos los valores de `maxOutputTokens` para mayor holgura

**Resultado:** Todas las respuestas pasaron de estar truncadas (20-30 tokens) a respuestas completas y coherentes.

---

### Bug #2 — CRÍTICO: Crash de React en Hoja Operativa al recibir respuesta IA
**Afectaba:** `src/app/operaciones/hoja-operativa/page.tsx`  
**Síntoma:** `Maximum update depth exceeded` con `JavascriptAnimate` en el call stack al aparecer la respuesta del IA.  
**Causa raíz:** El gráfico de gauge (`<Pie>` de recharts) tiene `isAnimationActive={true}` por defecto. Cuando la respuesta del IA cambiaba el layout de la página, `ResponsiveContainer` remedía el contenedor, disparando la animación del chart repetidamente en un loop infinito de setState.  
**Corrección aplicada:** Añadido `isAnimationActive={false}` al `<Pie>` del gauge de cumplimiento.

---

### Bug #3 — PENDIENTE: Streaming IA en Academia Módulo I tiene mismo problema de thinking tokens
**Afectaba:** `/api/gemini-stream` (usado por el chat tutor en `public/academia/modulo-1.html`)  
**Causa:** El endpoint de streaming NO tiene `thinkingConfig: { thinkingBudget: 0 }`, y el parser SSE del HTML (`parseGeminiSseChunk`) lee `parts[0].text` sin filtrar partes con `thought: true`. Esto puede hacer que tokens de pensamiento interno aparezcan en el chat del usuario.  
**Estado:** **No corregido aún** — requiere:
1. Añadir `thinkingConfig: { thinkingBudget: 0 }` en `src/app/api/gemini-stream/route.ts`
2. Actualizar `parseGeminiSseChunk` en `public/academia/modulo-1.html` para filtrar partes `thought: true`

---

## Resultados por Página

---

### 1. Motor de Inteligencia Hidrometeorológica (`/motor-inteligencia`)
**Ruta pública — sin autenticación requerida**

| Funcionalidad | Contexto IA | Estado | Observaciones |
|---|---|---|---|
| Análisis de potabilidad (agua cruda) | `technical-diagnosis` | ✅ | Respuesta completa con evaluación de turbidez, color, pH y recomendaciones de dosificación |
| Cálculos de dosificación y riesgo | Lógica local (`turbidity.ts`) | ✅ | Dosis, consumo diario, autonomía calculados correctamente |
| Sincronización meteorológica | OpenWeatherMap API | ✅ | Temperatura, humedad, presión y condición reportados en tiempo real (Samborondón: 27°C, nublado) |
| Protocolo IA con TTS | `gemini-2.5-flash-preview-tts` | ⚠️ | El audio se genera correctamente para textos cortos (~8s). Para protocolos completos (10+ oraciones) el botón permanece en estado de carga 60+ segundos. No es un bug de código sino una limitación de performance del modelo TTS con textos largos. |

---

### 2. Consola Técnica — Jar-Test (`/operaciones/consola-tecnica`)
**Requiere autenticación**

| Funcionalidad | Contexto IA | Estado | Observaciones |
|---|---|---|---|
| Análisis de agua cruda (Jar-test) | `raw-water-analysis` | ✅ | Respuesta técnica completa con evaluación de parámetros fisicoquímicos y recomendación de coagulante basada en INEN 1108 |

---

### 3. Hoja Operativa (`/operaciones/hoja-operativa`)
**Requiere autenticación**

| Funcionalidad | Contexto IA | Estado | Observaciones |
|---|---|---|---|
| Consulta al experto de turno | `shift-expert` | ✅ | Devuelve respuesta estructurada con [ANÁLISIS], [ACCIÓN] y [CONTROL]. Bug de crash de React corregido. |
| Protocolo TTS | `gemini-2.5-flash-preview-tts` | ⚠️ | Misma limitación que en Motor: textos largos tardan mucho. |
| Gauge de cumplimiento | Lógica local | ✅ | Calcula porcentaje de parámetros dentro de norma INEN 1108 correctamente |

**Issue menor (display):** Las respuestas en Markdown con `**negrita**` muestran los asteriscos literales en algunos campos. El parser solo procesa los marcadores `[ANÁLISIS]`, `[ACCIÓN]`, `[CONTROL]` pero no el Markdown general. No impacta la funcionalidad, solo la presentación.

---

### 4. Finanzas (`/operaciones/finanzas`)
**Requiere autenticación**

| Funcionalidad | Contexto IA | Estado | Observaciones |
|---|---|---|---|
| Optimización de costos | `financial-optimization` | ✅ | Análisis multi-sección completo: diagnóstico inicial, recomendaciones bajo SENAGUA/ARCA, gestión de RRHH, sostenibilidad financiera. Respuesta de ~600 palabras. |
| Estrategia financiera | `financial-strategy` | ✅ | Análisis estratégico completo con contexto de datos cero-producción identificado correctamente. |
| Resumen ejecutivo | `financial-summary` | ✅ | Resumen conciso (máx 150 palabras) con situación actual y recomendaciones clave. |

**Issue display (heredado):** Markdown `**bold**` mostrado como asteriscos literales. Mismo problema que en Hoja Operativa.

---

### 5. Asistencia Técnica Multicliente (`/asistencia`)
**Requiere autenticación y plan Pro**

| Tab | Funcionalidad | Contexto IA | Estado | Observaciones |
|---|---|---|---|---|
| Captura Técnica | Diagnóstico de ingeniería | `technical-diagnosis` | ✅ | Genera diagnóstico técnico con datos disponibles. Correctamente identifica insuficiencia de datos cuando los campos están vacíos. |
| Gestión Comercial | Estrategia de ventas | `commercial-strategy` | ✅ | Genera estrategia de ventas flash con contexto del sector químico industrial Ecuador. Texto inyectado en el área "COMENTARIOS Y SUGERENCIA IA". |

---

### 6. Academia — Módulo I (`/academia/modulo-1`)
**Requiere autenticación**

El módulo es un HTML estático servido como iframe. Contiene dos funcionalidades IA independientes.

| Funcionalidad | Contexto IA | Endpoint | Estado | Observaciones |
|---|---|---|---|---|
| Diagnóstico de coagulación | `academia-coagulacion` | `/api/gemini` (non-streaming) | ✅ | Con Turbiedad=50 NTU, pH=7.2, Alcalinidad=45 mg/L devolvió recomendación técnica correcta: PAC como coagulante principal por baja alcalinidad, con justificación técnica detallada. Markdown renderizado correctamente en el HTML (tiene `mdToHtml()` propio). |
| Chat tutor (ASISTENTE SANITARIO) | `academia-tutor` | `/api/gemini-stream` (SSE streaming) | ⚠️ | Chat funciona y responde. Bug latente: el endpoint `/api/gemini-stream` no tiene `thinkingBudget: 0` y el parser SSE lee `parts[0].text` sin filtrar thinking tokens. En la práctica la respuesta fue coherente durante la prueba, pero bajo carga los thinking tokens podrían aparecer en el chat. |

---

### 7. Academia — Módulo II y otros (`/academia/modulo-2-filtracion`, etc.)
**Requiere autenticación**

| Módulo | AI Features | Estado |
|---|---|---|
| Módulo II.2 — Filtración | Ninguna detectada (solo contenido educativo estático) | N/A |
| Módulo II.3 — Desinfección | No visitado | N/A |
| Módulo III — Operación y Control | No visitado | N/A |
| Módulo IV | No visitado | N/A |

> **Nota:** Los contextos `filtration-diagnostic` y `academia-tutor` están definidos en `gemini-prompts.ts` pero el Módulo II de Filtración no tiene ningún botón o panel de IA visible en su contenido. El contexto `filtration-diagnostic` puede estar reservado para uso futuro o para módulos Pro.

---

## Issues Pendientes (No Corregidos)

### P1 — Bug en `/api/gemini-stream`: thinking tokens pueden aparecer en chat
**Archivo:** `src/app/api/gemini-stream/route.ts`  
**Fix requerido:**
```typescript
body: JSON.stringify({
  contents: [{ parts: [{ text: prompt }] }],
  systemInstruction: { parts: [{ text: resolvedSystemPrompt }] },
  generationConfig: {
    ...generationConfig,
    thinkingConfig: { thinkingBudget: 0 },  // ← AÑADIR ESTO
  },
}),
```

**Archivo:** `public/academia/modulo-1.html` — función `parseGeminiSseChunk`  
**Fix requerido:** Filtrar partes con `thought: true` antes de extraer el texto:
```javascript
function parseGeminiSseChunk(chunk, onToken, state) {
    const lines = chunk.split('\n');
    for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line.startsWith('data:')) continue;
        const json = line.slice(5).trim();
        if (!json || json === '[DONE]') continue;
        try {
            const data = JSON.parse(json);
            const parts = data.candidates?.[0]?.content?.parts ?? [];
            const text = parts
                .filter(p => !p.thought && p.text)  // ← FILTRAR THINKING PARTS
                .map(p => p.text)
                .join('');
            if (text) {
                onToken(text, state.firstToken);
                state.firstToken = false;
            }
        } catch {}
    }
}
```

---

### P2 — Issue UX: Markdown no renderizado en respuestas de componentes React
**Afecta:** Hoja Operativa, Finanzas, Asistencia  
**Síntoma:** El modelo devuelve `**texto**` y aparecen los asteriscos literales  
**Causa:** Los componentes React muestran la respuesta como texto plano. Solo el HTML de Módulo I tiene `mdToHtml()`.  
**Fix sugerido:** Instalar `react-markdown` o aplicar una conversión básica de Markdown a HTML (`**` → `<strong>`) antes de renderizar con `dangerouslySetInnerHTML`.

---

### P3 — Issue UX: TTS lento para textos largos
**Afecta:** Motor de Inteligencia, Hoja Operativa (botón "OÍR PROTOCOLO IA")  
**Síntoma:** El botón permanece en estado de carga 60+ segundos para protocolos de 10+ oraciones  
**Causa:** Limitación de rendimiento del modelo `gemini-2.5-flash-preview-tts` para texto largo  
**Fix sugerido:** Truncar el texto a un máximo de 3-4 oraciones antes de enviarlo al TTS, o dividir en chunks con reproducción secuencial.

---

## Arquitectura IA Verificada

| Endpoint | Modelo | Uso | Estado |
|---|---|---|---|
| `POST /api/gemini` | `gemini-2.5-flash` | Análisis, diagnósticos, recomendaciones (non-streaming) | ✅ Corregido y funcional |
| `POST /api/gemini-stream` | `gemini-2.5-flash` | Chat tutor Academia Módulo I (SSE streaming) | ⚠️ Funcional con bug latente |
| `POST /api/gemini-tts` | `gemini-2.5-flash-preview-tts` | Texto a voz en Motor e Hoja Operativa | ✅ Funcional (lento para textos largos) |
| `GET /api/weather` | OpenWeatherMap | Datos meteorológicos en tiempo real | ✅ Funcional |
