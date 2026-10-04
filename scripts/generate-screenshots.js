import sharp from 'sharp';
import path from 'path';

const publicDir = path.resolve('public');

async function createScreenshots() {
  // 1. Desktop Screenshot (1280x720)
  const desktopSvg = `
  <svg width="1280" height="720" viewBox="0 0 1280 720" xmlns="http://www.w3.org/2000/svg">
    <rect width="1280" height="720" fill="#F9F8F5"/>
    <!-- Topbar -->
    <rect width="1280" height="64" fill="#FFFFFF" stroke="#EBE6DF" stroke-width="1"/>
    <text x="40" y="38" font-family="serif" font-size="20" font-weight="bold" fill="#1C1917">Lumina Books</text>
    <rect x="240" y="16" width="400" height="32" rx="8" fill="#F4EFEA" stroke="#E5E0D8"/>
    <text x="260" y="37" font-family="sans-serif" font-size="12" fill="#78716C">Buscar título, autor ou gênero...</text>

    <!-- Sidebar -->
    <rect x="0" y="64" width="240" height="656" fill="#F9F8F5" stroke="#EBE6DF" stroke-width="1"/>
    <rect x="16" y="88" width="208" height="40" rx="8" fill="#EFECE6"/>
    <text x="40" y="112" font-family="sans-serif" font-size="13" font-weight="600" fill="#1C1917">Minha Biblioteca</text>
    <text x="40" y="152" font-family="sans-serif" font-size="13" fill="#57534E">Explorar</text>
    <text x="40" y="192" font-family="sans-serif" font-size="13" fill="#57534E">Leitor Imersivo</text>

    <!-- Main Content -->
    <text x="280" y="110" font-family="serif" font-size="28" font-weight="bold" fill="#1C1917">Minha Biblioteca</text>
    <text x="280" y="135" font-family="sans-serif" font-size="13" fill="#78716C">Seu acervo literário com leitor de duas páginas e audiolivro sincronizado</text>

    <!-- Book Cards -->
    <g transform="translate(280, 160)">
      <!-- Card 1 -->
      <rect x="0" y="0" width="180" height="260" rx="12" fill="#1C1917"/>
      <rect x="0" y="0" width="180" height="260" rx="12" fill="none" stroke="#D97706" stroke-width="2" stroke-opacity="0.4"/>
      <text x="90" y="120" font-family="serif" font-size="16" font-weight="bold" fill="#FDE68A" text-anchor="middle">Cem Anos de Solidão</text>
      <text x="90" y="145" font-family="sans-serif" font-size="12" fill="#A8A29E" text-anchor="middle">G. García Márquez</text>
      <rect x="20" y="225" width="140" height="6" rx="3" fill="#44403C"/>
      <rect x="20" y="225" width="70" height="6" rx="3" fill="#D97706"/>

      <!-- Card 2 -->
      <g transform="translate(210, 0)">
        <rect x="0" y="0" width="180" height="260" rx="12" fill="#78350F"/>
        <text x="90" y="120" font-family="serif" font-size="16" font-weight="bold" fill="#FEF3C7" text-anchor="middle">Duna</text>
        <text x="90" y="145" font-family="sans-serif" font-size="12" fill="#D6D3D1" text-anchor="middle">Frank Herbert</text>
        <rect x="20" y="225" width="140" height="6" rx="3" fill="#44403C"/>
        <rect x="20" y="225" width="110" height="6" rx="3" fill="#F59E0B"/>
      </g>

      <!-- Card 3 -->
      <g transform="translate(420, 0)">
        <rect x="0" y="0" width="180" height="260" rx="12" fill="#064E3B"/>
        <text x="90" y="120" font-family="serif" font-size="16" font-weight="bold" fill="#A7F3D0" text-anchor="middle">Orgulho e Preconceito</text>
        <text x="90" y="145" font-family="sans-serif" font-size="12" fill="#D1FAE5" text-anchor="middle">Jane Austen</text>
        <rect x="20" y="225" width="140" height="6" rx="3" fill="#44403C"/>
        <rect x="20" y="225" width="45" height="6" rx="3" fill="#10B981"/>
      </g>
    </g>
  </svg>`;

  await sharp(Buffer.from(desktopSvg))
    .png()
    .toFile(path.join(publicDir, 'screenshot-desktop.png'));
  console.log('Generated screenshot-desktop.png');

  // 2. Mobile Screenshot (750x1334)
  const mobileSvg = `
  <svg width="750" height="1334" viewBox="0 0 750 1334" xmlns="http://www.w3.org/2000/svg">
    <rect width="750" height="1334" fill="#F9F8F5"/>
    <!-- Topbar -->
    <rect width="750" height="120" fill="#FFFFFF" stroke="#EBE6DF" stroke-width="1"/>
    <text x="40" y="75" font-family="serif" font-size="34" font-weight="bold" fill="#1C1917">Lumina Books</text>
    <rect x="40" y="150" width="670" height="70" rx="14" fill="#F4EFEA" stroke="#E5E0D8"/>
    <text x="80" y="195" font-family="sans-serif" font-size="22" fill="#78716C">Buscar livros...</text>

    <!-- Main Title -->
    <text x="40" y="280" font-family="serif" font-size="44" font-weight="bold" fill="#1C1917">Continuar Lendo</text>
    
    <!-- Hero Book Card -->
    <g transform="translate(40, 320)">
      <rect width="670" height="380" rx="20" fill="#1C1917"/>
      <rect width="670" height="380" rx="20" fill="none" stroke="#D97706" stroke-width="3" stroke-opacity="0.5"/>
      <text x="40" y="90" font-family="serif" font-size="36" font-weight="bold" fill="#FDE68A">Cem Anos de Solidão</text>
      <text x="40" y="140" font-family="sans-serif" font-size="24" fill="#A8A29E">Gabriel García Márquez</text>
      <text x="40" y="220" font-family="sans-serif" font-size="22" fill="#E7E5E4">Capítulo 4 • 48% lido</text>
      <rect x="40" y="260" width="590" height="14" rx="7" fill="#44403C"/>
      <rect x="40" y="260" width="280" height="14" rx="7" fill="#D97706"/>
      <rect x="40" y="300" width="220" height="50" rx="12" fill="#D97706"/>
      <text x="150" y="333" font-family="sans-serif" font-size="20" font-weight="bold" fill="#FFFFFF" text-anchor="middle">Ler Agora</text>
    </g>

    <!-- Bottom Navigation Bar -->
    <rect y="1214" width="750" height="120" fill="#FFFFFF" stroke="#EBE6DF" stroke-width="2"/>
    <text x="125" y="1285" font-family="sans-serif" font-size="22" font-weight="bold" fill="#D97706" text-anchor="middle">Biblioteca</text>
    <text x="375" y="1285" font-family="sans-serif" font-size="22" fill="#78716C" text-anchor="middle">Explorar</text>
    <text x="625" y="1285" font-family="sans-serif" font-size="22" fill="#78716C" text-anchor="middle">Leitor</text>
  </svg>`;

  await sharp(Buffer.from(mobileSvg))
    .png()
    .toFile(path.join(publicDir, 'screenshot-mobile.png'));
  console.log('Generated screenshot-mobile.png');
}

createScreenshots().catch(err => {
  console.error(err);
  process.exit(1);
});
