# 3D Llaveros

Web que convierte una imagen en un llavero 3D multicolor listo para imprimir (3MF para Bambu Studio / OrcaSlicer y STL), con edición básica en el navegador.

Todo el procesamiento corre en el navegador de quien usa la web: sin servidor, sin IA y sin costo por conversión. La imagen nunca se sube.

## Estado

**Fase 0 — pruebas de riesgo.** Ver la hoja de ruta en [docs/03-plan-de-desarrollo.md](docs/03-plan-de-desarrollo.md) §10. Las decisiones que pisan al resto del plan están en §2-bis.

## Comandos

Requiere Node 24 y pnpm 10.

| Comando                   | Qué hace                                                                                     |
| ------------------------- | -------------------------------------------------------------------------------------------- |
| `pnpm dev`                | Servidor de desarrollo                                                                       |
| `pnpm preview:red`        | Sirve el build en la red local (para probar en el celular)                                   |
| `pnpm build`              | Build de producción. Incluye el chequeo de licencias del bundle y genera `dist/LICENSES.txt` |
| `pnpm verificar`          | Todo lo que corre el CI: tipos → lint → licencias → tests → build                            |
| `pnpm test`               | Tests con Vitest                                                                             |
| `pnpm lint`               | oxlint, con las reglas de capas del plan (§5.3)                                              |
| `pnpm chequear-licencias` | Revisa el árbol instalado de dependencias de producción                                      |
| `pnpm format`             | Prettier                                                                                     |

> No usar `pnpm ci`: es un comando reservado de pnpm y no ejecuta el script. El equivalente es `pnpm verificar`.

## Reglas del proyecto

- **Licencias:** nada GPL, AGPL ni LGPL en el código que se publica. Hay dos capas de chequeo: el árbol instalado (`pnpm chequear-licencias`) y lo que realmente entra al bundle (en cada `build`). Las reglas están en [scripts/reglas-licencias.ts](scripts/reglas-licencias.ts).
- **Capas:** `src/pipeline`, `src/geometria` y `src/export` son las únicas que importan las librerías de motor; `src/pipeline` no toca el DOM; nada de `src/` importa `spikes/`. Lo hace cumplir el lint.
- **Hosting portable:** se publica en Vercel como sitio estático, **sin nada propietario de Vercel** (functions, middleware, optimización de imágenes, paquetes `@vercel/*`), para poder mudarse a otro hosting sin tocar código.

## Estructura

```
docs/        investigación, auditorías, plan y registros de pruebas
spikes/      código descartable de la Fase 0 (fuera del build)
scripts/     chequeo de licencias
src/         la app
tests/       tests de Vitest
```
