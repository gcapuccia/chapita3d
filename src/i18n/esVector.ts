// Todo el texto visible de Vectorizar. Español rioplatense, de vos.

export const esVector = {
  nombre: 'Vectorizar',
  titulo: 'Limpiá el dibujo',
  bajada:
    'Le saca el fondo y lo convierte en formas. Después lo retocás vos: lo que el programa dejó de más, lo borrás.',

  subir: {
    titulo: 'Tu imagen',
    arrastrar: 'Arrastrá tu imagen acá',
    elegir: 'Elegir una imagen',
    cambiar: 'Cambiar la imagen',
    formatos: 'PNG, JPG o WEBP, hasta 25 MB. No sale de tu computadora.',
    procesando: 'Sacando el fondo…',
  },

  conversion: {
    titulo: 'Cómo la lee',
    ayuda:
      'Si el fondo quedó mal, probá otro tipo. Cambiarlo vuelve a empezar y perdés lo que editaste.',
    colores: 'Cuántos colores',
  },

  herramientas: {
    titulo: 'Para retocar',
    mancha: 'Borrar manchas',
    manchaAyuda:
      'Pasá por encima: se prende entera la parte que se va. Tocá y chau. Si tocás un hueco, lo rellena con el color elegido.',
    borrar: 'Borrador',
    borrarAyuda: 'Borrá pasando el dedo, para recortar un borde a mano.',
    pintar: 'Pincel',
    pintarAyuda: 'Pintá con un color de la paleta, para tapar un agujero o unir dos partes.',
    grosor: 'Grosor del pincel',
    color: 'Color del pincel',
    deshacer: 'Deshacer',
    rehacer: 'Rehacer',
    original: 'Volver al original',
    mover: 'Rueda para acercar · Shift y arrastrar para mover · dos dedos en el celular.',
  },

  salida: {
    titulo: 'Cuando esté listo',
    descargar: 'Descargar el SVG',
    bajado: 'Listo, bajé el SVG.',
    seguir: '¿Lo seguimos acá?',
    enLlavero: 'Usar en el llavero',
    enSello: 'Usar en el sello',
    enSelloAyuda:
      'El sello gofra la silueta de todo lo que haya quedado. Si querés solo las líneas, borrá el relleno antes de mandarlo.',
    cerrar: 'Ahora no',
    medidas: (x: number, y: number) =>
      `${x.toFixed(1).replace('.', ',')} × ${y.toFixed(1).replace('.', ',')} mm`,
    formas: (n: number) => `${n} ${n === 1 ? 'color' : 'colores'}`,
    sinDibujo: 'Te quedaste sin dibujo: deshacé algo antes de bajarlo.',
  },

  errores: {
    formato: 'Ese formato no lo puedo abrir. Probá con PNG, JPG o WEBP.',
    heic: 'Las fotos HEIC del iPhone no las puedo abrir. Compartila como JPG.',
    'muy-pesada': 'Esa imagen pesa más de 25 MB. Probá con una más chica.',
    'sin-dibujo': 'No encontré ningún dibujo en esa imagen. Probá con otro tipo de imagen.',
    trabado: 'Algo se me trabó convirtiendo la imagen. Probá con otra.',
  },
}
