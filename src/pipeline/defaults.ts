// TODOS los numeros del proyecto, cada uno con su origen (plan §7).
// Recalibrar = cambiar una constante, no tocar logica.

// ---------------------------------------------------------------------------------------
// Los dos epsilon: la falsa contradiccion que hay que dejar escrita (plan §3).
//
// audit-01 §3.3 y §6.4 exigen ε = 0,05 mm. audit-02 §2 dice "empezar sin epsilon".
// NO hablan del mismo epsilon. Quien quiera "arreglar" esto agregando un hueco en Z se
// fabrica exactamente el problema que cree estar evitando.
//
// |                | ε de audit-01                            | ε de audit-02                          |
// |----------------|------------------------------------------|----------------------------------------|
// | Donde          | En XY, en el plano                       | En Z, entre volumenes apilados         |
// | Que es         | Crecimiento 2D de cada region ANTES de   | Separacion vertical entre la base y    |
// |                | la cadena de resta por prioridad         | la capa de color                       |
// | Para que       | Contra micro-huecos entre colores        | Contra un solapamiento que NO existe   |
// |                | vecinos: en pantalla no se ven, impresos |                                        |
// |                | si                                       |                                        |
// | Decision       | SI. Siempre activo, oculto               | NO. Contacto cara a cara en Z es lo    |
// |                |                                          | normal y correcto                      |
// ---------------------------------------------------------------------------------------

/**
 * mm. Crecimiento de cada region de color antes de restar las de mayor prioridad.
 * Cierra huecos de hasta 2ε entre colores vecinos (el RDP por separado los abre).
 * Rango valido 0,02–0,10. Si la pieza patron P1 muestra una linea del color de la base
 * entre dos colores, subir de a 0,01 (plan F0.5). Fuente: audit-01 §3.3.
 */
export const EPSILON_SOLAPE_XY = 0.05

/** mm. NO TOCAR: el contacto cara a cara en Z es lo correcto. Fuente: plan §3. */
export const EPSILON_Z = 0
