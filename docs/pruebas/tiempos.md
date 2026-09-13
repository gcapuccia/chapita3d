# Tiempos del pipeline de imagen

Mediana del banco sintético (15 imágenes, fuentes de 2000 px salvo una de 320 px), con la resolución elegida en F0.8: **0,10 mm/px**, que da ~530 × 530 px de trabajo para un llavero de 50 mm. Se regeneran con `node spikes/05-pipeline/correr.ts`.

## Por etapa (ms)

| Equipo | previa | buscar dibujo | reescalar | máscara | prefiltro | colores | limpieza | contornos | **total** |
|---|---|---|---|---|---|---|---|---|---|
| PC de desarrollo (Node 24) | 109 | 52 | 47 | 12 | 20 | 22 | 75 | 14 | **352** |
| Notebook vieja | | | | | | | | | *pendiente* |
| Android de gama media | | | | | | | | | *pendiente* |

**Presupuesto del plan:** < 2 s en desktop ✅ y < 5 s en Android ⏳.

## Lectura

- **La etapa más cara es la previa** (reducir la fuente de 2000 px a 900 px para buscar el dibujo). No depende de la resolución de trabajo. En el navegador, `createImageBitmap` con `resizeWidth` lo hace nativo y mucho más rápido, así que en la app debería bajar.
- **La limpieza es la segunda.** Hace 2 transformadas de distancia por color para la apertura. Sigue siendo lineal en píxeles, así que escala bien.
- Pasar de 0,20 a 0,10 mm/px cuadruplica los píxeles de trabajo, pero el total solo pasa de ~230 a ~350 ms, porque la previa pesa lo mismo en los dos casos.

## Cómo medir en los otros equipos

La página de diagnóstico del pipeline (`/#/dev/pipeline`, tarea F1.5) va a correr este mismo banco en el navegador del dispositivo, igual que `/#/dev/geometria` en F0.6. Hasta entonces estos son los únicos números medidos.
