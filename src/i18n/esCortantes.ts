// Todo el texto visible de la app de cortantes. Español rioplatense, de vos.

const mm = (n: number) => String(Math.round(n * 10) / 10).replace('.', ',')

export const esCortantes = {
  titulo: 'Cortante de galletitas',
  bajada:
    'Subís un dibujo y sale el cortante con su forma, más un marcador que deja los detalles hundidos en la masa.',

  subir: {
    titulo: 'Tu dibujo',
    arrastrar: 'Arrastrá tu imagen acá',
    elegir: 'Elegir mi imagen',
    cambiar: 'Cambiar',
    muestra: 'Probar con el gato',
    formatos: 'PNG, JPG o WEBP. Sale mejor con dibujos de colores planos que con fotos.',
    procesando: 'Sacando el fondo…',
    deVector: 'Viene de Vectorizar',
    limpiar: '¿Quedó algo de más? Limpialo en Vectorizar',
  },

  tamano: {
    titulo: 'Tamaño de la galletita',
    ayuda: 'El lado más largo de la galletita, sin contar el cortante.',
  },

  alto: {
    titulo: 'Alto del cortante',
    detalle: { 12: 'masa fina', 15: 'normal', 20: 'masa gruesa' } as Record<number, string>,
  },

  marcador: {
    titulo: 'Marcador',
    opciones: { lineas: 'Las líneas', colores: 'Colores', no: 'Sin marcador' },
    ayuda: {
      lineas: 'Marca el borde de cada color, como un dibujo para colorear.',
      colores: 'Los colores que elijas quedan hundidos en la masa.',
      no: 'Solo el cortante, sin detalles adentro.',
    },
    cuales: 'Qué colores marcan',
  },

  avanzado: {
    ver: 'Ver ajuste fino',
    ocultar: 'Ocultar',
    margen: 'Aire alrededor del dibujo',
    margenAyuda: 'Con más aire, la galletita sale más redondeada y el dibujo no toca el borde.',
    grosor: 'Grosor del filo',
    grosorAyuda: 'En la base. En la punta se afina solo hasta 0,6 mm.',
    reborde: 'Ancho del reborde',
    linea: 'Grosor de las líneas',
    relieve: 'Cuánto marca',
    holgura: 'Holgura del marcador',
    holguraAyuda: 'El aire entre el marcador y el filo. Si no entra, subila.',
  },

  vista: {
    actualizando: 'Actualizando…',
    espejado: 'Espejado a propósito: al darlo vuelta, sale al derecho.',
  },

  galletita: 'Así sale la galletita',

  avisos: {
    titulo: (n: number) => `${n} ${n === 1 ? 'aviso' : 'avisos'}`,
    partesUnidas: 'Tu dibujo tenía partes sueltas: las uní para que salga una sola galletita.',
    detalleFino: (pct: number) =>
      `El ${pct} % del marcador tiene líneas más finas que 1 mm, y la masa puede no tomarlas. Agrandá la galletita o engrosá las líneas.`,
    marcadorVacio:
      'El marcador quedó sin nada para marcar. Elegí algún color o pasá a "Las líneas".',
  },

  errores: {
    formato: 'Ese formato no lo puedo abrir. Probá con PNG, JPG o WEBP.',
    heic: 'Las fotos HEIC del iPhone no las puedo abrir. Compartila como JPG.',
    'muy-pesada': 'Esa imagen pesa más de 25 MB. Probá con una más chica.',
    'sin-dibujo':
      'No encontré ningún dibujo en esa imagen. Probá con otra, o limpiala en Vectorizar.',
    trabado: 'Algo se me trabó armando el cortante. Probá con un dibujo más simple.',
  },

  resumen: {
    galletita: (x: number, y: number) => `Galletita: ${mm(x)} × ${mm(y)} mm`,
    cortante: (x: number, y: number, z: number) => `Cortante: ${mm(x)} × ${mm(y)} × ${mm(z)} mm`,
    sinSoportes:
      'Se imprime sin soportes: el cortante con el reborde abajo y el marcador con el dibujo para arriba.',
    boton: 'Descargar',
    preparando: 'Armando el cortante…',
  },
}
