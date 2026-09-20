// Isotipo de Chapita3d: una chapita con el agujero de la argolla arriba a la izquierda y CH3d en
// dos lineas (diseño en docs/marca/diseno/Chapita3d.dc.html, medidas en docs/marca/copy-landing.md).
//
// Las letras van en relieve, en un segundo filamento: no hay islas ni puentes, asi que el logo se
// imprime tal cual como llavero de 32 mm. A 16 px se empastan, asi que ahi va sin letras.

import { useId } from 'react'

type Variante = 'lima' | 'tiza' | 'oscuro'

const CHAPA: Record<Variante, string> = { lima: '#C6F24E', tiza: '#F5F6F8', oscuro: '#14161A' }
const LETRA: Record<Variante, string> = { lima: '#14161A', tiza: '#14161A', oscuro: '#C6F24E' }

export default function Isotipo({
  tam = 34,
  variante = 'lima',
  conLetras = true,
  caladas = false,
  titulo,
}: {
  tam?: number
  variante?: Variante
  /** false: solo la chapa con su agujero (favicon chico). */
  conLetras?: boolean
  /** true: las letras se calan en la chapa (version de un solo filamento). */
  caladas?: boolean
  titulo?: string
}) {
  const id = `chapita-${useId()}`
  const letras = (
    <>
      <text
        x="63"
        y="56"
        fontFamily="'Lilita One', sans-serif"
        fontSize="40"
        textAnchor="middle"
        fill={caladas ? '#000' : LETRA[variante]}
      >
        CH
      </text>
      <text
        x="61.6"
        y="92"
        fontFamily="'Lilita One', sans-serif"
        fontSize="40"
        letterSpacing="-2"
        textAnchor="middle"
        fill={caladas ? '#000' : LETRA[variante]}
      >
        3d
      </text>
    </>
  )
  return (
    <svg
      viewBox="0 0 120 120"
      width={tam}
      height={tam}
      role={titulo ? 'img' : undefined}
      aria-label={titulo}
      aria-hidden={titulo ? undefined : true}
    >
      <mask id={id}>
        <rect width="120" height="120" fill="#fff" />
        <circle cx="28" cy="27" r="9" fill="#000" />
        {conLetras && caladas && letras}
      </mask>
      <rect
        x="6"
        y="6"
        width="108"
        height="108"
        rx="30"
        fill={CHAPA[variante]}
        mask={`url(#${id})`}
      />
      {conLetras && !caladas && letras}
    </svg>
  )
}

/** El isotipo con el nombre al lado, para la barra de arriba y el pie. */
export function Marca({
  tam = 34,
  texto = 'text-[21px]',
  variante = 'lima',
}: {
  tam?: number
  texto?: string
  variante?: Variante
}) {
  return (
    <span className="flex items-center gap-2.5">
      <Isotipo tam={tam} variante={variante} titulo="Chapita3d" />
      <span className={`${texto} font-black tracking-[-0.03em]`}>
        Chapita<span className="text-lima">3d</span>
      </span>
    </span>
  )
}
