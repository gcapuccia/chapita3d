// Todo el texto visible de la landing, en el orden en que aparece (diseño: copy-landing.md).
// Español rioplatense, de vos. Ninguna palabra de la lista prohibida (ver tests/textos.test.ts).

export const esLanding = {
  marca: 'Chapita3d',
  descriptor: 'llaveros 3D desde tu imagen',

  barra: {
    herramientas: 'Herramientas',
    comoFunciona: 'Cómo funciona',
    preguntas: 'Preguntas',
    entrar: 'Entrar',
    crearCuenta: 'Crear cuenta',
  },

  hero: {
    titulo: 'Convertí tu logo en un llavero listo para imprimir.',
    bajada:
      'Subís una imagen y bajás el .3mf con los colores separados. Gratis, sin IA y sin que tu imagen salga de tu computadora.',
    principal: 'Probar con mi imagen',
    secundario: 'Crear cuenta',
    pieDeBotones: 'Bambu Studio · OrcaSlicer · PrusaSlicer · un archivo por color.',
    antes: 'Tu imagen',
    despues: 'Tu llavero',
    epigrafe: 'El logo de una tienda y su llavero, tal como sale.',
  },

  pruebaEnVivo: {
    titulo: 'Probalo acá mismo',
    bajada: 'Arrastrá tu imagen y mirá qué sale. No hace falta cuenta.',
    arrastrar: 'Arrastrá tu imagen acá, o hacé click',
    soltar: 'Soltala acá',
    formatos: 'PNG · JPG · WEBP · hasta 25 MB',
    elegir: 'Elegir una imagen',
    sacarFoto: 'Sacar una foto',
    galeria: 'Elegir de la galería',
    muestras: '¿No tenés una a mano? Probá con estas:',
    muestrasCorto: 'Probá con estas:',
    etiquetas: { logo: 'Logo', dibujo: 'Dibujo', silueta: 'Silueta' },
  },

  herramientas: {
    titulo: 'Las herramientas de la casa',
    bajada: 'Tres, y todas gratis. La misma cuenta te sirve para las tres.',
    lista: [
      {
        id: 'llaveros',
        nombre: 'Llaveros',
        texto: 'Tu logo o tu dibujo convertido en un llavero multicolor, listo para el AMS.',
        boton: 'Probar con mi imagen',
        figura: 'Un llavero hecho con esta herramienta',
      },
      {
        id: 'sellos',
        nombre: 'Sellos para gofrar',
        texto:
          'Dos placas con bisagra que se imprime armada. Lo cerrás como un libro y el dibujo queda marcado en el papel.',
        boton: 'Armar un sello',
        figura: 'Un sello abierto, con el relieve y su hueco',
      },
      {
        id: 'calculadora',
        nombre: 'Calculadora de costos',
        texto:
          'Cuánto te sale de verdad una impresión, contando filamento, luz, desgaste y fallas. Y a cuánto conviene venderla.',
        boton: 'Abrir la calculadora',
        figura: 'La calculadora con sus resultados',
      },
    ],
  },

  pasos: {
    titulo: 'Cómo funciona el de llaveros',
    lista: [
      {
        titulo: 'Subís tu imagen.',
        texto: 'PNG, JPG o WEBP. También una foto del dibujo.',
        figura: 'Así se ve al subir la imagen',
      },
      {
        titulo: 'Ajustás.',
        texto:
          'Fondo, colores, tamaño, argolla, grosor de las líneas. Lo ves en 3D mientras tocás.',
        figura: 'Los colores y la vista 3D, lado a lado',
      },
      {
        titulo: 'Descargás el ZIP.',
        texto: 'El .3mf para tu AMS, un .stl por color y los pasos escritos.',
        figura: 'La pantalla de descarga con todo lo que te llevás',
      },
    ],
  },

  resuelve: {
    titulo: 'Lo que resuelve',
    lista: [
      {
        titulo: 'Las líneas finas no desaparecen.',
        texto:
          'Un logo de trazo fino se borra al imprimirlo. Acá se engrosan hasta el mínimo que tu impresora puede hacer, y vos elegís cuánto.',
        figura: 'Una línea fina, antes y después',
      },
      {
        titulo: 'El fondo se va, aunque esté encerrado.',
        texto: 'Un logo dentro de un círculo o sobre un degradé también sale.',
        figura: 'Un logo dentro de un círculo, antes y después',
      },
      {
        titulo: 'Colores de verdad.',
        texto:
          'Cada color, su filamento. Y si tenés una sola boquilla, te digo en qué capa cambiarlo.',
        figura: 'La pieza con los colores separados',
      },
      {
        titulo: 'Te aviso antes de imprimir.',
        texto: 'Partes frágiles, texto ilegible, más colores que lugares en el AMS.',
        figura: 'Los avisos marcados sobre la pieza',
      },
    ],
  },

  compatibilidad: {
    titulo: 'Funciona con',
    lista: ['Bambu Lab A1 · P1S · X1C con AMS', 'OrcaSlicer', 'PrusaSlicer', 'Creality'],
    nota: 'Si tu programa abre .3mf o .stl, te sirve.',
  },

  privacidad: {
    titulo: 'Tu imagen no se sube a ningún lado.',
    texto:
      'La conversión pasa entera en tu navegador, incluso sin internet una vez cargada la página.',
  },

  cuenta: {
    titulo: 'Creá tu cuenta y no perdés nada de lo que hiciste',
    beneficios: [
      'Guardás tus diseños',
      'Los volvés a abrir desde cualquier equipo',
      'Te enterás de lo que viene',
    ],
    google: 'Seguir con Google',
    correo: 'Crear cuenta con correo',
    honesta: 'Te escribimos solo cuando hay algo nuevo. Podés borrar tu cuenta cuando quieras.',
    correoEtiqueta: 'Tu correo',
    correoEjemplo: 'vos@correo.com',
    mandar: 'Mandame el enlace',
    mandando: 'Mandando…',
    enviado: (correo: string) =>
      `Te mandé un enlace a ${correo}. Abrilo desde este mismo aparato y ya estás adentro.`,
    fallo: 'No pude mandar el enlace. Fijate que el correo esté bien escrito y probá de nuevo.',
    sinCuentas:
      'Las cuentas todavía no están prendidas acá. Igual podés usar todo sin registrarte.',
    // El boton de Google llega cuando haya credenciales propias
    pronto: 'Muy pronto',
    aclaracion: 'Guardamos el llavero, no tu imagen: esa nunca sale de tu computadora.',
  },

  preguntas: {
    titulo: 'Preguntas',
    lista: [
      { p: '¿Es gratis?', r: 'Sí, y las descargas no tienen límite.' },
      {
        p: '¿Usa IA?',
        r: 'No. Es un proceso de imagen, así que el resultado se parece a tu imagen, no a una versión inventada.',
      },
      { p: '¿Sirve para mi impresora?', r: 'Si tu slicer abre .3mf o .stl, sí.' },
      {
        p: '¿Y si no tengo AMS?',
        r: 'Te da la misma pieza con las pausas y la lista de capas para cambiar el filamento.',
      },
      {
        p: '¿Qué tan chico puede salir el detalle?',
        r: 'Lo más fino que se imprime bien ronda 0,8 mm; la app engrosa o avisa.',
      },
      {
        p: '¿Puedo usar cualquier imagen?',
        r: 'Solo imágenes tuyas o con permiso. Convertirlas no te da derechos sobre logos o personajes de otros.',
      },
      {
        p: '¿Qué archivos me llevo?',
        r: 'Un .3mf multicolor, un .stl por color, la pieza entera y las instrucciones.',
      },
    ],
  },

  pie: {
    descripcion: 'Herramientas para imprimir en 3D: llaveros, sellos y costos.',
    enlaces: ['Privacidad', 'Términos', 'Contacto', 'Instagram'],
    lugar: 'Hecho en Argentina',
  },
}
