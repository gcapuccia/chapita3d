// Todo el texto visible de la app de sellos. Español rioplatense, de vos.

export const esSellos = {
  nombre: 'Sellos',
  titulo: 'Sello para gofrar',
  bajada:
    'Dos placas unidas por una bisagra que se imprime armada. Lo cerrás como un libro y el dibujo queda marcado.',

  dibujo: {
    titulo: 'Qué va en el sello',
    texto: 'Un texto',
    archivo: 'Un dibujo (SVG)',
    escribir: 'Tu texto',
    fuente: 'Letra',
    elegirArchivo: 'Elegir un SVG',
    cambiarArchivo: 'Cambiar el SVG',
    arrastrar: 'Arrastrá tu SVG acá',
    formatos: 'Solo SVG: es el formato que guarda las formas, no los cuadritos.',
    renglones: 'Enter abre un renglón nuevo. El texto se achica solo para entrar en la placa.',
  },

  material: {
    titulo: 'Sobre qué vas a gofrar',
    ayuda: 'Cuanto más grueso el material, más tiene que sobresalir el dibujo.',
  },

  medidas: {
    titulo: 'Medidas',
    ancho: 'Ancho de cada placa',
    bisagras: 'Largo del sello',
    bisagrasDetalle: (n: number) => `${n} ${n === 1 ? 'bisagra' : 'bisagras'}`,
    escala: 'Tamaño del dibujo',
    girar: 'Girar 90°',
    invertir: 'Cambiar de lado',
    invertirAyuda: 'Pasa el relieve a la otra placa.',
  },

  avanzado: {
    titulo: 'Ajuste fino',
    ver: 'Ver ajuste fino',
    ocultar: 'Ocultar',
    tolerancia: 'Holgura entre las placas',
    toleranciaAyuda:
      'Cuánto más grande es el hueco que el relieve. Si el sello cierra duro, subila.',
    holgura: 'Aire de la bisagra',
    holguraAyuda:
      'Lo que separa las partes que giran. Si sale dura, subila; si queda floja, bajala.',
    espesor: 'Espesor de la placa',
    margen: 'Margen del dibujo',
    radio: 'Esquinas redondeadas',
    corrimiento: 'Correr el dibujo',
  },

  vista: {
    abierto: 'Abierto',
    cerrado: 'Cerrado',
    actualizando: 'Actualizando…',
  },

  avisos: {
    titulo: (n: number) => `${n} ${n === 1 ? 'aviso' : 'avisos'}`,
    detalleFino: (pct: number) =>
      `El ${pct} % del dibujo tiene partes más finas que 0,8 mm: pueden no marcarse.`,
    logoRecortado: (pct: number) =>
      `El dibujo se sale de la placa y perdés el ${pct} %. Hacelo más chico o ensanchá la placa.`,
    svgVacio: 'Ese SVG no tiene formas rellenas. Probá con uno donde el dibujo sea sólido.',
    svgIlegible:
      'No pude leer ese SVG. Fijate que sea un SVG de verdad y no una imagen renombrada.',
    trabado: 'Algo se me trabó armando el sello. Probá con un dibujo más simple.',
  },

  resumen: {
    medidas: (x: number, y: number, z: number) =>
      `${x.toFixed(1).replace('.', ',')} × ${y.toFixed(1).replace('.', ',')} × ${z.toFixed(1).replace('.', ',')} mm, abierto`,
    logo: (x: number, y: number) =>
      `Dibujo: ${x.toFixed(1).replace('.', ',')} × ${y.toFixed(1).replace('.', ',')} mm`,
    boton: 'Descargar',
    preparando: 'Armando el sello…',
    descargar: (bytes: number) => `Descargar el sello (ZIP · ${Math.round(bytes / 1024)} KB)`,
    adentro: 'Adentro del ZIP: el sello entero, cada placa por separado y los pasos escritos.',
    sinSoportes: 'Se imprime plano y sin soportes. La bisagra ya viene armada.',
  },
}
