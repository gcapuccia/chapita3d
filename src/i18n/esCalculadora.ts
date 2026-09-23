// Todo el texto visible de la Calculadora 3D. Español rioplatense, de vos.

export const esCalculadora = {
  nombre: 'Calculadora 3D',
  bajada: 'Calculá el costo real de tus impresiones y el precio sugerido de venta.',

  perfil: {
    titulo: 'Perfil',
    nuevo: '— Nuevo perfil —',
    botonNuevo: 'Nuevo',
    guardar: 'Guardar perfil',
    borrar: 'Borrar perfil',
    comoSeLlama: '¿Cómo querés llamar a este perfil?',
    moneda: 'Moneda',
    ayuda: 'Un perfil guarda tus gastos fijos y la moneda, para no cargarlos de nuevo.',
  },

  gastos: {
    titulo: 'Gastos fijos',
    precioKg: (s: string) => `Precio del filamento (${s}/kg)`,
    precioKwh: (s: string) => `Precio del kWh (${s})`,
    modelo: 'Modelo de impresora',
    modeloAyuda:
      'Elegí tu modelo y te completo el consumo. Si no está en la lista, dejá «Otro / Personalizado».',
    watts: 'Consumo de la impresora (W)',
    wattsAyuda:
      'Lo que consume en promedio mientras imprime, no el pico. Si no sabés, 100 W anda bien.',
    vidaUtil: 'Vida útil de la máquina (horas)',
    vidaUtilAyuda: 'Cuántas horas esperás que dure antes de cambiarle las partes que se gastan.',
    repuestos: (s: string) => `Costo de repuestos (${s})`,
    error: 'Margen de error (%)',
    errorAyuda: 'Lo que se pierde en piezas falladas, purga y pruebas.',
  },

  pieza: {
    titulo: 'Pieza',
    horas: 'Horas de impresión',
    minutos: 'Minutos adicionales',
    gramos: 'Gramos de filamento',
    insumos: (s: string) => `Insumos extra (${s})`,
    insumosAyuda: 'Argollas, imanes, cajas: lo que le sumás a la pieza.',
  },

  margen: {
    titulo: 'Margen de ganancia',
    personalizado: 'Otro',
    personalizadoAyuda: 'Si necesitás otro valor, escribilo acá. Por ejemplo 2,8.',
    referencias: 'Ver referencias',
    ocultar: 'Ocultar referencias',
  },

  resultados: {
    titulo: 'Resultados',
    material: 'Precio material',
    luz: 'Precio luz',
    desgaste: 'Desgaste máquina',
    error: 'Margen de error',
    costoTotal: 'Costo total (sin insumos)',
    insumos: 'Insumos (+30 %)',
    total: 'Total a cobrar',
    ml: 'Precio MercadoLibre',
    mlAyuda: 'Ya tiene sumado lo que se lleva MercadoLibre.',
    copiar: 'Copiar el total',
    copiado: 'Copiado ✓',
    guardarProducto: 'Guardar como producto',
    comoSeLlamaProducto: '¿Cómo querés llamar a este producto?',
  },

  productos: {
    titulo: 'Mis productos',
    vacio: 'Todavía no guardaste ninguno. Calculá una pieza y tocá «Guardar como producto».',
    nombre: 'Producto',
    fecha: 'Fecha',
    gramos: 'Gramos',
    tiempo: 'Tiempo',
    costo: 'Costo',
    total: 'A cobrar',
    ml: 'MercadoLibre',
    cargar: 'Cargar',
    borrar: 'Borrar',
    exportarJson: 'Bajar todo (JSON)',
    importarJson: 'Traer un JSON',
    exportarCsv: 'Bajar planilla (CSV)',
    importados: (perfiles: number, productos: number) =>
      `Entraron ${perfiles} perfiles y ${productos} productos.`,
    noEntro: 'Ese archivo no es una copia de la calculadora.',
  },

  guardadoAca: 'Todo esto queda guardado en este navegador, en tu máquina.',
}
