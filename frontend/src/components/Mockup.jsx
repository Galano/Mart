/*
  Mockups em camadas (SVG): silhueta na cor da variante + sombreamento + dobras.
  Leves e sem 3D. Cada area de estampa tem um retangulo no viewBox 400x460,
  proporcional as medidas reais (A4 21x29,7; A3 29,7x42; manga 10x10; gola 7x5...).
*/
const VB = { w: 400, h: 460 }

export const GEO = {
  camiseta: {
    frente: { view: 'tee_front', r: [145, 112, 110, 155.6] },
    costas_a4: { view: 'tee_back', r: [145, 104, 110, 155.6] },
    costas_a3: { view: 'tee_back', r: [125, 96, 150, 212] },
    manga_esq: { view: 'manga', r: [150, 175, 100, 100] },
    manga_dir: { view: 'manga', r: [150, 175, 100, 100], flip: true },
    etiqueta: { view: 'gola', r: [144, 158, 112, 80] },
  },
  moletom: {
    frente: { view: 'hoodie_front', r: [145, 120, 110, 155.6] },
    costas_a4: { view: 'hoodie_back', r: [145, 110, 110, 155.6] },
    costas_a3: { view: 'hoodie_back', r: [125, 100, 150, 212] },
    manga_esq: { view: 'manga', r: [150, 175, 100, 100] },
    manga_dir: { view: 'manga', r: [150, 175, 100, 100], flip: true },
    etiqueta: { view: 'gola', r: [144, 158, 112, 80] },
  },
  caneca: { estampa: { view: 'caneca', r: [84, 192, 212, 95.4] } },
  copo: { frente: { view: 'copo', r: [142, 236, 116, 58] }, atras: { view: 'copo', r: [142, 236, 116, 58], verso: true } },
  almofada: { frente: { view: 'almofada', r: [80, 100, 240, 240] } },
}

export function geoDe(mockup, area) {
  const g = GEO[mockup] || GEO.camiseta
  return g[area] || Object.values(g)[0]
}

const pct = (r) => ({ left: `${(r[0] / VB.w) * 100}%`, top: `${(r[1] / VB.h) * 100}%`, width: `${(r[2] / VB.w) * 100}%`, height: `${(r[3] / VB.h) * 100}%` })

function luminancia(hex) {
  const n = parseInt((hex || '#ffffff').slice(1), 16)
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255
}

const SHAPES = {
  tee_front: 'M128 38 Q200 88 272 38 L336 64 Q360 74 372 96 L392 150 L338 176 L314 142 L316 420 Q316 432 304 433 Q200 442 96 433 Q84 432 84 420 L86 142 L62 176 L8 150 L28 96 Q40 74 64 64 Z',
  tee_back: 'M134 36 Q200 54 266 36 L336 64 Q360 74 372 96 L392 150 L338 176 L314 142 L316 420 Q316 432 304 433 Q200 442 96 433 Q84 432 84 420 L86 142 L62 176 L8 150 L28 96 Q40 74 64 64 Z',
  hoodie_front: 'M126 50 Q200 96 274 50 L338 72 Q362 82 370 112 L396 332 L352 344 L326 176 L322 420 Q322 432 310 433 Q200 442 90 433 Q78 432 78 420 L74 176 L48 344 L4 332 L30 112 Q38 82 62 72 Z',
  hoodie_back: 'M126 50 Q200 70 274 50 L338 72 Q362 82 370 112 L396 332 L352 344 L326 176 L322 420 Q322 432 310 433 Q200 442 90 433 Q78 432 78 420 L74 176 L48 344 L4 332 L30 112 Q38 82 62 72 Z',
  manga: 'M92 88 L308 70 Q330 69 334 90 L354 378 Q355 396 338 397 L70 402 Q54 402 55 386 L74 106 Q76 90 92 88 Z',
  gola: 'M30 130 Q200 54 370 130 L370 446 L30 446 Z',
  caneca: 'M70 118 Q70 108 80 108 L300 108 Q310 108 310 118 L310 372 Q310 392 290 392 L90 392 Q70 392 70 372 Z',
  copo: 'M110 124 L290 124 L270 422 Q268 434 256 434 L144 434 Q132 434 130 422 Z',
  almofada: 'M58 86 Q200 64 342 86 Q366 230 342 374 Q200 396 58 374 Q34 230 58 86 Z',
}

function Detalhes({ view, escuro }) {
  const linha = escuro ? 'rgba(255,255,255,.14)' : 'rgba(15,27,45,.12)'
  const forte = escuro ? 'rgba(255,255,255,.22)' : 'rgba(15,27,45,.2)'
  switch (view) {
    case 'tee_front':
      return <>
        <path d="M140 38 Q200 64 260 38 Q200 76 140 38" fill="rgba(0,0,0,.18)" />
        <path d="M128 38 Q200 88 272 38" fill="none" stroke={forte} strokeWidth="7" />
        <path d="M86 142 Q80 120 64 64 M314 142 Q320 120 336 64" fill="none" stroke={linha} strokeWidth="2" />
        <path d="M150 300 Q170 360 150 420 M262 310 Q244 360 258 420" fill="none" stroke={linha} strokeWidth="2.5" />
      </>
    case 'tee_back':
      return <>
        <path d="M134 36 Q200 54 266 36" fill="none" stroke={forte} strokeWidth="6" />
        <path d="M86 142 Q80 120 64 64 M314 142 Q320 120 336 64" fill="none" stroke={linha} strokeWidth="2" />
        <path d="M160 330 Q176 380 162 424 M246 320 Q232 380 244 424" fill="none" stroke={linha} strokeWidth="2.5" />
      </>
    case 'hoodie_front':
      return <>
        <path d="M120 54 Q200 0 280 54 Q260 96 200 104 Q140 96 120 54 Z" fill="rgba(0,0,0,.22)" />
        <path d="M184 104 L180 170 M216 104 L220 170" stroke={forte} strokeWidth="2.5" />
        <path d="M120 300 L280 300 L304 392 L96 392 Z" fill="none" stroke={forte} strokeWidth="3" />
        <path d="M78 406 L322 406 M48 336 L74 330 M352 336 L326 330" stroke={forte} strokeWidth="4" />
      </>
    case 'hoodie_back':
      return <>
        <path d="M120 54 Q200 30 280 54 Q270 140 200 150 Q130 140 120 54 Z" fill="rgba(0,0,0,.12)" stroke={linha} strokeWidth="2" />
        <path d="M78 406 L322 406 M48 336 L74 330 M352 336 L326 330" stroke={forte} strokeWidth="4" />
      </>
    case 'manga':
      return <>
        <path d="M70 360 L352 352" stroke={forte} strokeWidth="5" />
        <path d="M120 120 Q130 240 116 360 M286 110 Q280 240 292 350" fill="none" stroke={linha} strokeWidth="2.5" />
      </>
    case 'gola':
      return <>
        <path d="M30 130 Q200 54 370 130 L370 168 Q200 94 30 168 Z" fill="rgba(0,0,0,.16)" stroke={forte} strokeWidth="2" />
        <path d="M30 200 Q200 140 370 200" fill="none" stroke={linha} strokeWidth="2" strokeDasharray="5 6" />
      </>
    case 'caneca':
      return <>
        <ellipse cx="190" cy="110" rx="120" ry="12" fill="rgba(0,0,0,.25)" />
        <path d="M310 172 C386 172 392 316 310 316" fill="none" stroke="var(--mk)" strokeWidth="26" strokeLinecap="round" />
        <path d="M310 172 C386 172 392 316 310 316" fill="none" stroke="rgba(0,0,0,.15)" strokeWidth="26" strokeLinecap="round" />
      </>
    case 'copo':
      return <>
        <rect x="102" y="86" width="196" height="42" rx="12" fill="#2a2d33" />
        <rect x="160" y="92" width="80" height="10" rx="5" fill="#4a4e57" />
        <path d="M110 124 L290 124" stroke="rgba(0,0,0,.25)" strokeWidth="4" />
      </>
    case 'almofada':
      return <path d="M58 86 Q200 64 342 86 Q366 230 342 374 Q200 396 58 374 Q34 230 58 86 Z" fill="none" stroke={forte} strokeWidth="3" strokeDasharray="2 5" />
    default:
      return null
  }
}

/** Mockup com overlay opcional. children recebem posicao da area de estampa. */
export default function Mockup({ mockup = 'camiseta', area, cor = '#f8f8f6', arteSrc, children, className = '' }) {
  const g = geoDe(mockup, area)
  const escuro = luminancia(cor) < 0.45
  const shape = SHAPES[g.view]
  const gid = `g-${g.view}`
  return (
    <div className={`relative w-full ${className}`} style={{ aspectRatio: `${VB.w} / ${VB.h}`, '--mk': cor }}>
      <svg viewBox={`0 0 ${VB.w} ${VB.h}`} className="absolute inset-0 h-full w-full" style={g.flip ? { transform: 'scaleX(-1)' } : undefined} aria-hidden="true">
        <defs>
          <linearGradient id={`${gid}-l`} x1="0" x2="1">
            <stop offset="0" stopColor="#000" stopOpacity=".22" />
            <stop offset=".28" stopColor="#fff" stopOpacity=".16" />
            <stop offset=".6" stopColor="#fff" stopOpacity="0" />
            <stop offset="1" stopColor="#000" stopOpacity=".26" />
          </linearGradient>
          <linearGradient id={`${gid}-v`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fff" stopOpacity=".08" />
            <stop offset="1" stopColor="#000" stopOpacity=".12" />
          </linearGradient>
          <filter id={`${gid}-s`} x="-10%" y="-10%" width="120%" height="125%">
            <feDropShadow dx="0" dy="10" stdDeviation="10" floodOpacity=".18" />
          </filter>
        </defs>
        {g.view === 'caneca' && <Detalhes view="caneca" escuro={escuro} />}
        <path d={shape} fill={g.view === 'copo' && cor === '#c9ccd1' ? 'url(#inox)' : cor} filter={`url(#${gid}-s)`} />
        <path d={shape} fill={`url(#${gid}-l)`} />
        <path d={shape} fill={`url(#${gid}-v)`} />
        {g.view !== 'caneca' && <Detalhes view={g.view} escuro={escuro} />}
        {g.view === 'caneca' && <ellipse cx="190" cy="110" rx="120" ry="12" fill="none" stroke="rgba(255,255,255,.35)" strokeWidth="2" />}
        <defs>
          <linearGradient id="inox" x1="0" x2="1">
            <stop offset="0" stopColor="#8d939b" /><stop offset=".3" stopColor="#eef0f2" />
            <stop offset=".55" stopColor="#b9bec5" /><stop offset="1" stopColor="#7d838b" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute" style={pct(g.r)}>
        {arteSrc && <img src={arteSrc} alt="" className="absolute inset-0 h-full w-full object-contain pointer-events-none" />}
        {children}
      </div>
    </div>
  )
}
