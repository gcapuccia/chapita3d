// Una imagen de la landing. Mientras la captura no exista en public/marca/, muestra un recuadro
// con lo que va ahi: la pagina se puede publicar igual y la foto entra sola cuando se agrega.

import { useState } from 'react'

export default function Figura({
  src,
  texto,
  className = '',
  contain = false,
}: {
  src: string
  /** Que muestra la imagen: tambien es el texto alternativo. */
  texto: string
  className?: string
  contain?: boolean
}) {
  const [falla, setFalla] = useState(false)
  if (falla) {
    return (
      <div
        className={`grid place-items-center rounded-2xl border border-dashed border-borde-fuerte bg-carbon px-4 text-center text-sm text-tenue ${className}`}
      >
        {texto}
      </div>
    )
  }
  return (
    <img
      src={src}
      alt={texto}
      loading="lazy"
      onError={() => setFalla(true)}
      className={`rounded-2xl bg-carbon ${contain ? 'object-contain' : 'object-cover'} ${className}`}
    />
  )
}
