// Paleta para elegir el color de un filamento (plan §9.6: el catalogo real con marcas llega despues).
// Son colores de PLA comunes; el hex es el que va al 3MF y a la vista 3D.

export type ColorDeFilamento = { nombre: string; hex: string }

export const PALETA: ColorDeFilamento[] = [
  { nombre: 'Blanco', hex: '#FFFFFF' },
  { nombre: 'Hueso', hex: '#F2ECDC' },
  { nombre: 'Gris claro', hex: '#C8C8C8' },
  { nombre: 'Gris', hex: '#808080' },
  { nombre: 'Negro', hex: '#1A1A1A' },
  { nombre: 'Rojo', hex: '#D62828' },
  { nombre: 'Bordó', hex: '#7A1F2B' },
  { nombre: 'Naranja', hex: '#F28C28' },
  { nombre: 'Amarillo', hex: '#F5C518' },
  { nombre: 'Dorado', hex: '#C9A227' },
  { nombre: 'Verde claro', hex: '#8BC34A' },
  { nombre: 'Verde', hex: '#2E9E5B' },
  { nombre: 'Verde oscuro', hex: '#1B5E20' },
  { nombre: 'Cian', hex: '#27C3D8' },
  { nombre: 'Celeste', hex: '#7EC8F2' },
  { nombre: 'Azul', hex: '#1E4FD8' },
  { nombre: 'Azul marino', hex: '#1D3A8A' },
  { nombre: 'Violeta', hex: '#7B3FB5' },
  { nombre: 'Rosa', hex: '#EC6FA9' },
  { nombre: 'Fucsia', hex: '#C2185B' },
  { nombre: 'Marrón', hex: '#6D4C41' },
  { nombre: 'Beige', hex: '#E3D5B8' },
  { nombre: 'Plateado', hex: '#B8BDC4' },
  { nombre: 'Cobre', hex: '#B06A3B' },
]
