// TODOS los textos visibles de la interfaz (plan §4.7). Español rioplatense, trato de vos,
// nunca "Error", sin jerga, sin signos de exclamacion en los errores. tests/textos.test.ts lo verifica.

const mb = (bytes: number) => `${Math.round(bytes / 1024 / 1024)} MB`
const kb = (bytes: number) =>
  bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : mb(bytes)
const g = (gramos: number) =>
  gramos < 10 ? gramos.toFixed(1).replace('.', ',') : String(Math.round(gramos))
const mm = (n: number) => n.toFixed(1).replace('.', ',')

export const es = {
  marca: '3DLlaveros',

  inicio: {
    // Texto 2
    promesa: 'Convertí tu dibujo o logo en un llavero listo para imprimir.',
    promesaDos: 'Funciona también si tu impresora es de un solo color.',
    arrastrar: 'Arrastrá tu imagen acá, o hacé click',
    formatos: 'PNG · JPG · WEBP · hasta 25 MB',
    // Texto 1
    elegir: 'Elegir una imagen',
    sacarFoto: 'Sacar una foto',
    galeria: 'Elegir de la galería',
    // Texto 3
    privacidad: 'Tu imagen no se sube a ningún lado: todo pasa en tu navegador.',
    privacidadCelular: 'Todo pasa en tu teléfono.',
    muestras: '¿No tenés una a mano? Probá con estas:',
    muestrasCorto: 'Probá con estas:',
    consejosTitulo: 'Qué imágenes funcionan mejor',
    consejos: [
      { ok: true, texto: 'Colores planos y bien marcados' },
      { ok: true, texto: 'Fondo liso o transparente' },
      { ok: false, texto: 'Líneas más finas que 1 mm' },
    ],
    propiedad:
      'Subí solo imágenes propias o con permiso. Convertirlas no te da derechos sobre personajes, logos o marcas de terceros.',
    soltar: 'Soltala acá',
    proyecto: 'También podés arrastrar un proyecto.json que hayas guardado.',
  },

  errores: {
    // Texto 4
    heic: (archivo: string) =>
      `No pude abrir «${archivo}». Las fotos de iPhone en HEIC no se abren en la web. En el iPhone: Ajustes ▸ Cámara ▸ Formatos ▸ «Más compatible». O mandátela por WhatsApp y usá esa.`,
    formato: (archivo: string) =>
      `No pude abrir «${archivo}». Probá con una imagen PNG, JPG o WEBP. Si es una captura, sacala de nuevo y guardala como imagen.`,
    // Texto 5
    muyPesada: (archivo: string, bytes: number) =>
      `«${archivo}» pesa ${mb(bytes)} y el máximo es 25 MB. Sacale una captura de pantalla o mandátela por WhatsApp: eso la achica sola.`,
    // Texto 7
    trabado:
      'Algo se me trabó procesando la imagen. Suele pasar con imágenes muy grandes. ¿La proceso más chica?',
    // Texto 6
    sinDibujo:
      'Me llevé casi todo el dibujo. Probá con otro tipo de imagen (Foto suele andar mejor), o con una imagen de fondo liso.',
    proyectoInvalido: (archivo: string) =>
      `«${archivo}» no parece un proyecto guardado desde acá. Probá con el proyecto.json que viene adentro del ZIP.`,
    entendido: 'Entendido',
  },

  procesando: {
    hitos: {
      leer: 'Leí tu imagen',
      fondo: 'Sacando el fondo',
      colores: 'Separando los colores',
      llavero: 'Armando el llavero',
    },
    grande: 'Tu imagen es grande, esto puede tardar unos segundos.',
    lento: 'Está tardando más de lo normal.',
    cancelar: 'Cancelar',
  },

  crear: {
    solapas: { fondo: 'Fondo', colores: 'Colores', llavero: 'Llavero' },
    descargar: 'Descargar',
    atras: 'Atrás',
    tuLlavero: 'Tu llavero',
    girar: 'Arrastrá para girar',
    vistas: { arriba: 'Arriba', tresD: '3D', capas: 'Capas' },
    actualizando: 'Actualizando…',
    sinImagen:
      'Este proyecto se abrió sin la imagen original: el fondo y los colores no se pueden cambiar.',
  },

  fondo: {
    tipo: 'Tipo de imagen',
    presets: { auto: 'Automático', dibujo: 'Dibujo', foto: 'Foto', silueta: 'Silueta' },
    listo: 'El fondo está bien',
    saltear: 'Saltear este paso',
    ayuda: 'Lo que ves en colores es tu dibujo. Lo que queda en cuadritos se va a sacar.',
  },

  colores: {
    cuantos: '¿Cuántos colores?',
    lista: 'Los colores de tu llavero',
    impresora: '¿Cuántos colores podés cargar a la vez en tu impresora?',
    variosSlots: '4 o más (AMS, CFS, ACE, MMU)',
    unSlot: 'Solo 1 (los cambio a mano)',
    pausas: (n: number) =>
      `Te van a quedar ${n} ${n === 1 ? 'pausa' : 'pausas'} para cambiar el filamento. Te doy la lista exacta al descargar.`,
    fusionados: (n: number) =>
      `Tu imagen tiene ${n} colores distintos: los muy parecidos se juntan solos.`,
    lugar: (n: number) => `lugar ${n}`,
    base: 'Base y borde',
    listo: 'Los colores están bien',
  },

  llavero: {
    tamano: 'Tamaño',
    referencia: (mmLado: number) =>
      mmLado <= 30
        ? 'como una moneda'
        : mmLado <= 55
          ? 'como una tarjeta SUBE'
          : 'como la palma de la mano',
    espesor: 'Espesor',
    espesores: { delgado: 'Delgado', estandar: 'Estándar', reforzado: 'Reforzado' },
    argolla: 'Argolla',
    argollas: { bola: 'Bolitas', comun: 'Común', gruesa: 'Gruesa', sin: 'Sin' },
    borde: 'Borde',
    texto: 'Texto',
    agregarTexto: 'Agregar texto',
    textoPlaceholder: 'Tu nombre, por ejemplo',
    fuente: 'Letra',
    quitarTexto: 'Sacar el texto',
    listo: 'Descargar mi llavero',
  },

  avisos: {
    titulo: (n: number) => (n === 1 ? '1 aviso' : `${n} avisos`),
    bloqueante: 'Hay que arreglar esto antes de descargar.',
  },

  descargar: {
    volver: 'Volver al llavero',
    listo: 'Tu llavero está listo',
    medidas: (x: number, y: number, z: number, colores: number) =>
      `${mm(x)} × ${mm(y)} × ${mm(z)} mm · ${colores} ${colores === 1 ? 'color' : 'colores'}`,
    pieza: (gramos: number) => `Filamento de la pieza: ~${g(gramos)} g`,
    purga: (gramos: number, cambios: number) =>
      `Purga por cambios de color: ~${g(gramos)} g (${cambios} cambios)`,
    cebado: (cambios: number, gramos: number) =>
      `Cambios de filamento: ${cambios} ${cambios === 1 ? 'pausa' : 'pausas'} · ~${g(gramos)} g de cebado cada una`,
    // Texto 9
    consejoPurga: (purga: number, pieza: number) =>
      `Vas a gastar unos ${g(purga)} g de filamento en purga${purga > pieza ? `: más que el llavero, que pesa ${g(pieza)} g` : ''}. Imprimí 6 juntos en la misma placa y la purga se reparte entre todos.`,
    // Texto 10
    boton: (bytes: number) => `Descargar mi llavero (ZIP · ${kb(bytes)})`,
    preparando: 'Preparando el archivo…',
    slicer: '¿Con qué vas a imprimir?',
    slicers: { bambu: 'Bambu Studio u OrcaSlicer', prusa: 'PrusaSlicer', otro: 'Otra / No sé' },
    adentro: 'Adentro del ZIP',
    archivos: {
      tresMf: 'Este es el tuyo. Doble click y listo.',
      stlColores: 'Un archivo por color, para cualquier otro programa.',
      stlEntera: 'La pieza entera, para imprimir de un color o pintar.',
      instrucciones: 'Los pasos, en texto.',
      proyecto: 'Para volver a editarlo acá.',
    },
    cuandoCambiar: 'Cuándo cambiar el filamento',
    capa: (capa: number, z: number, color: string) =>
      `Capa ${capa} (Z = ${z.toFixed(2).replace('.', ',')} mm) → poné ${color.toUpperCase()}`,
    pausaSola: 'La impresora se va a pausar sola. No apagues nada.',
    comoImprimir: 'Cómo imprimirlo',
    pasos: {
      bambu: [
        'Abrí el archivo .3mf con Bambu Studio u OrcaSlicer.',
        'Si te pregunta algo al abrir, elegí importar solo la geometría.',
        'Fijate que los colores hayan quedado en los espacios de filamento (slots) correctos.',
        'Activá «purgar dentro del objeto» y mandá a imprimir.',
      ],
      prusa: [
        'Abrí PrusaSlicer y arrastrá todos los archivos de la carpeta stl/ a la vez.',
        'Cuando pregunte, elegí cargarlos como un objeto con varias partes.',
        'Asigná a cada parte su filamento, en el orden de INSTRUCCIONES.txt.',
        'Rebanalo y mandá a imprimir.',
      ],
      otro: [
        'Si tu programa abre archivos .3mf, probá primero con ese.',
        'Si no, importá los archivos de la carpeta stl/ como un objeto con varias partes.',
        'Asigná a cada parte su filamento, en el orden de INSTRUCCIONES.txt.',
        'Para imprimirlo de un solo color, usá stl/pieza-entera.stl.',
      ],
    },
    /** Impresora de un filamento: los cambios van por altura, no por pieza. */
    pasosApilado: {
      bambu: [
        'Abrí el archivo .3mf con Bambu Studio u OrcaSlicer.',
        'Si te pregunta algo al abrir, elegí importar solo la geometría.',
        'Las pausas ya vienen marcadas en las alturas de la lista de arriba.',
        'Cargá el filamento de la base, mandá a imprimir y cambialo en cada pausa.',
      ],
      prusa: [
        'Abrí stl/pieza-entera.stl con PrusaSlicer.',
        'En la vista previa, agregá un cambio de color en cada capa de la lista de arriba.',
        'Cargá el filamento de la base, mandá a imprimir y cambialo en cada pausa.',
      ],
      otro: [
        'Abrí stl/pieza-entera.stl con tu programa.',
        'Buscá la opción de pausa o cambio de color por capa y agregala en cada capa de la lista de arriba.',
        'Cargá el filamento de la base, mandá a imprimir y cambialo en cada pausa.',
      ],
    },
    bloqueado: 'Hay algo para arreglar antes de descargar:',
    fallo: 'El navegador no dejó bajar el archivo. Probá de nuevo, o bajá los archivos de a uno:',
    otro: 'Empezar otro',
    guardar: 'Guardar el proyecto',
  },

  pie: {
    enlaces: ['Términos', 'Privacidad', 'Compatibilidad con slicers', 'Licencias'],
  },
}
