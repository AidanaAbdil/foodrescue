// Hand-drawn style line icons used across the site instead of emoji.
// Usage: <Doodle name="bell" />, <Doodle name="heart" filled size={20} />
// They take the text colour (currentColor), so they match the words next to them.

const PATHS = {
  bell: ["M30 70 C30 50 30 31 50 28 C70 31 70 50 70 70 L79 78 L21 78 Z", "M43 85 C46 91 54 91 57 85", "M50 28 V19"],
  bellOff: ["M30 70 C30 50 30 31 50 28 C70 31 70 50 70 70 L79 78 L21 78 Z", "M43 85 C46 91 54 91 57 85", "M50 28 V19", "M18 18 L84 86"],
  pin: ["M50 88 C40 72 26 58 26 42 C26 28 37 18 50 18 C63 18 74 28 74 42 C74 58 60 72 50 88 Z", "M50 34 m-8 0 a8 8 0 1 0 16 0 a8 8 0 1 0 -16 0"],
  map: ["M14 27 L36 18 L64 28 L86 20 L86 74 L64 83 L36 72 L14 80 Z", "M36 18 L36 72", "M64 28 L64 83"],
  list: ["M20 30 C40 26 60 34 80 30", "M20 50 C40 46 60 54 80 50", "M20 70 C40 66 60 74 80 70"],
  search: ["M44 44 m-23 0 a23 23 0 1 0 46 0 a23 23 0 1 0 -46 0", "M61 61 L83 83"],
  chart: ["M22 80 V58", "M42 80 V38", "M62 80 V48", "M82 80 V24", "M13 87 C40 85 62 89 89 86"],
  notebook: ["M27 15 C42 17 58 14 74 16 L74 86 C58 84 42 87 27 85 Z", "M37 34 H64", "M37 50 H64", "M37 66 H54"],
  star: ["M50 13 L61 38 L87 40 L67 58 L73 85 L50 71 L27 85 L33 58 L13 40 L39 38 Z"],
  heart: ["M50 82 C26 66 14 52 18 36 C22 22 40 18 50 32 C60 18 78 22 82 36 C86 52 74 66 50 82 Z"],
  phone: ["M31 16 C24 16 18 22 20 30 C26 58 42 74 70 80 C78 82 84 76 84 70 L84 62 L66 56 L58 64 C48 60 40 52 36 42 L44 34 L38 16 Z"],
  repeat: ["M24 47 C24 31 36 22 50 22 C62 22 72 28 76 38", "M65 38 L77 39 L78 27", "M76 54 C76 70 64 78 50 78 C38 78 28 72 24 62", "M35 62 L23 61 L22 73"],
  clock: ["M50 50 m-33 0 a33 33 0 1 0 66 0 a33 33 0 1 0 -66 0", "M50 29 V50 L64 59"],
  sprout: ["M50 87 V50", "M50 57 C50 41 36 31 19 33 C19 49 34 59 50 57", "M50 49 C52 35 64 26 81 28 C81 43 68 51 50 49"],
  camera: ["M16 35 L34 35 L40 24 L60 24 L66 35 L84 35 L84 79 L16 79 Z", "M50 57 m-14 0 a14 14 0 1 0 28 0 a14 14 0 1 0 -28 0"],
  check: ["M19 55 L40 75 L83 27"],
  party: ["M18 84 L36 30 L72 66 Z", "M27 57 L45 75", "M58 26 C62 18 70 18 72 24", "M74 40 C82 36 88 40 86 46", "M52 14 L54 20", "M86 24 L80 28", "M68 50 L74 52"],
  sad: ["M50 50 m-33 0 a33 33 0 1 0 66 0 a33 33 0 1 0 -66 0", "M38 41 L38 45", "M62 41 L62 45", "M36 68 C44 60 56 60 64 68"],
  download: ["M50 17 V63", "M31 46 L50 65 L69 46", "M19 82 C40 80 60 84 81 81"],
  pencil: ["M23 77 L29 56 L68 18 L83 32 L44 71 Z", "M60 26 L75 40", "M23 77 L44 71"],
  coin: ["M50 50 m-33 0 a33 33 0 1 0 66 0 a33 33 0 1 0 -66 0", "M37 36 H63", "M37 46 H63", "M50 46 V68"],
  store: ["M16 40 L22 20 L78 20 L84 40 Z", "M16 40 C16 48 30 48 30 40 C30 48 44 48 44 40 C44 48 58 48 58 40 C58 48 72 48 72 40 C72 48 84 48 84 40", "M22 47 V83 H78 V47", "M42 83 V61 H58 V83"],
  bag: ["M24 36 L76 36 L81 88 L19 88 Z", "M38 36 C38 21 62 21 62 36", "M50 74 C40 66 36 60 40 55 C44 51 49 53 50 57 C51 53 56 51 60 55 C64 60 60 66 50 74 Z"],
  phoneScreen: ["M32 12 H68 C72 12 74 14 74 18 V82 C74 86 72 88 68 88 H32 C28 88 26 86 26 82 V18 C26 14 28 12 32 12 Z", "M44 78 H56"],
  close: ["M24 24 C40 42 58 58 76 76", "M76 24 C58 40 42 58 24 76"],
  flask: ["M39 14 H61", "M44 14 V40 L22 80 C20 84 22 88 28 88 H72 C78 88 80 84 78 80 L56 40 V14", "M30 66 H70"],
  // Bag categories
  bowl: ["M14 50 L86 50 C86 70 70 82 50 82 C30 82 14 70 14 50 Z", "M38 82 L62 82", "M33 42 C29 36 37 32 33 24", "M50 42 C46 36 54 32 50 24", "M67 42 C63 36 71 32 67 24"],
  croissant: ["M15 62 C20 36 44 26 50 26 C56 26 80 36 85 62 C74 56 64 53 50 53 C36 53 26 56 15 62 Z", "M34 31 C38 41 38 48 35 54", "M50 26 V53", "M66 31 C62 41 62 48 65 54"],
  basket: ["M13 42 H87 L78 83 H22 Z", "M30 42 L44 17", "M70 42 L56 17", "M37 53 V72", "M50 53 V72", "M63 53 V72"],
  carrot: ["M28 82 L68 36 C73 31 81 37 77 43 L35 86 C31 90 24 86 28 82 Z", "M46 64 L52 68", "M55 54 L61 58", "M72 36 C70 26 74 18 78 15", "M76 40 C84 34 90 34 93 37"],
  gift: ["M19 43 H81 V83 H19 Z", "M14 31 H86 V43 H14 Z", "M50 31 V83", "M50 31 C40 14 27 22 36 31", "M50 31 C60 14 73 22 64 31"],
} as const;

export type DoodleName = keyof typeof PATHS;

type Props = {
  name: DoodleName;
  size?: number; // px
  filled?: boolean; // e.g. a full heart or star
  className?: string;
  title?: string; // when the icon alone carries meaning (otherwise hidden from screen readers)
};

export function Doodle({ name, size = 18, filled = false, className = "", title }: Props) {
  // Thicker lines when small, so the hand-drawn look survives at icon size.
  const stroke = size <= 24 ? 8 : size <= 48 ? 6 : 4;
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill={filled ? "currentColor" : "none"} stroke="currentColor"
      strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" className={`inline-block shrink-0 align-[-0.15em] ${className}`}
      role={title ? "img" : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      {PATHS[name].map((d) => <path key={d} d={d} />)}
    </svg>
  );
}
