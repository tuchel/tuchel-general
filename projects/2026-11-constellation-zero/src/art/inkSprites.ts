/**
 * High-Resolution 4x Supersampled Yoji Shinkawa Orbital Ink Sprite Bank.
 * Every actor, enemy, boss, item, POW pod, and cover monolith is authored as crisp
 * calligraphic SVG artwork (tapered sumi-e contours, crosshatch ink washes, ceramic highlights,
 * glowing optics, hoses, and armor plates) and rasterized to GPU-cached HTMLImageElements at boot.
 */

export type SpriteKey =
  | "mercer_stand"
  | "mercer_run_a"
  | "mercer_run_b"
  | "mercer_crouch"
  | "mercer_eva"
  | "mli_box"
  | "starship"
  | "trooper_a"
  | "trooper_b"
  | "drone"
  | "heavy"
  | "interceptor"
  | "pow_pod"
  | "item_medgel"
  | "item_emp"
  | "item_weapon"
  | "hack_terminal"
  | "hack_terminal_dark"
  | "cover_rack"
  | "cover_rack_core"
  | "boss_iron_gantry"
  | "boss_iron_gantry_vent"
  | "boss_valkyrie"
  | "boss_mirror"
  | "boss_lark";

function svgToImage(svg: string): HTMLImageElement {
  const img = new Image();
  img.decoding = "async";
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg.trim())}`;
  return img;
}

const DEFS = `
  <defs>
    <linearGradient id="ceramic" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#F7FAFD"/>
      <stop offset="52%" stop-color="#C8D7E4"/>
      <stop offset="58%" stop-color="#223041"/>
      <stop offset="100%" stop-color="#090D14"/>
    </linearGradient>
    <linearGradient id="steel" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#7B93AA"/>
      <stop offset="45%" stop-color="#2C3C4E"/>
      <stop offset="100%" stop-color="#0B1018"/>
    </linearGradient>
    <linearGradient id="goldFoil" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#FFF2B8"/>
      <stop offset="38%" stop-color="#D4A642"/>
      <stop offset="72%" stop-color="#8C641C"/>
      <stop offset="100%" stop-color="#4A320C"/>
    </linearGradient>
    <linearGradient id="cyanGlow" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#C8F5FF"/>
      <stop offset="100%" stop-color="#3096D6"/>
    </linearGradient>
    <linearGradient id="redGlow" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#FFF0EE"/>
      <stop offset="45%" stop-color="#FF3B2F"/>
      <stop offset="100%" stop-color="#8F0E0A"/>
    </linearGradient>
    <linearGradient id="amberGlow" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#FFF4C8"/>
      <stop offset="50%" stop-color="#FF9500"/>
      <stop offset="100%" stop-color="#A83800"/>
    </linearGradient>
    <linearGradient id="greenGlow" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#D6FFE8"/>
      <stop offset="100%" stop-color="#28C26E"/>
    </linearGradient>
  </defs>
`;

function makeMercerSvg(pose: "stand" | "run_a" | "run_b" | "crouch" | "eva"): string {
  if (pose === "crouch") {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180">${DEFS}
      <!-- Dynamic sumi-e ink shadow splatter behind boots -->
      <path d="M22 162 Q65 142 132 164 L104 172 Q52 172 16 168 Z" fill="#06080D" opacity="0.72"/>
      <!-- EVA Pack & Braided O2 Hose -->
      <path d="M28 66 L54 58 L58 118 L34 114 Z" fill="url(#steel)" stroke="#05070B" stroke-width="5.5" stroke-linejoin="round"/>
      <rect x="35" y="72" width="12" height="6" fill="#57C7FF"/>
      <path d="M40 108 Q16 128 32 142" fill="none" stroke="#080C12" stroke-width="6" stroke-linecap="round"/>
      <!-- Back Knee Tucked -->
      <path d="M56 122 L88 120 L78 164 L40 164 L46 144 Z" fill="#172230" stroke="#05070B" stroke-width="5.5" stroke-linejoin="round"/>
      <!-- Front Knee Bent Tactical Pose -->
      <path d="M74 118 L128 124 L120 164 L96 164 L98 140 L72 136 Z" fill="url(#ceramic)" stroke="#05070B" stroke-width="5.5" stroke-linejoin="round"/>
      <path d="M108 122 L129 125 L125 140 L105 136 Z" fill="#0C131D"/>
      <path d="M94 152 L128 152 L132 166 L92 166 Z" fill="#0B1018" stroke="#05070B" stroke-width="4.5"/>
      <!-- Armored Torso + Diagonal Rig + Tactical Pouches -->
      <path d="M50 64 L106 58 L112 122 L56 124 Z" fill="url(#ceramic)" stroke="#05070B" stroke-width="5.5" stroke-linejoin="round"/>
      <path d="M50 64 L78 61 L74 123 L56 124 Z" fill="#121C29"/>
      <path d="M56 70 L108 110" stroke="#06080D" stroke-width="8"/>
      <rect x="64" y="102" width="18" height="15" rx="2" fill="#233345" stroke="#05070B" stroke-width="3.5"/>
      <rect x="86" y="102" width="18" height="15" rx="2" fill="#233345" stroke="#05070B" stroke-width="3.5"/>
      <!-- Sculpted Shoulder Pauldron -->
      <ellipse cx="78" cy="70" rx="22" ry="13" transform="rotate(-12 78 70)" fill="#EDF4FA" stroke="#05070B" stroke-width="5"/>
      <!-- Contoured Aerospace Helmet + Signature Shinkawa Crimson Visor Brush Slash -->
      <circle cx="94" cy="40" r="26" fill="#F4F8FC" stroke="#05070B" stroke-width="5.5"/>
      <path d="M72 24 A25 25 0 0 0 82 62 L92 40 Z" fill="#192534"/>
      <ellipse cx="106" cy="42" rx="15" ry="13" fill="#070B11" stroke="#05070B" stroke-width="3.5"/>
      <path d="M94 46 L128 31 L118 44 Z" fill="url(#redGlow)"/>
      <path d="M100 35 L112 32" stroke="#FFFFFF" stroke-width="2.5" stroke-linecap="round" opacity="0.7"/>
    </svg>`;
  }

  const legPaths =
    pose === "run_a"
      ? {
          back: "M68 112 L90 112 L52 162 L32 154 Z",
          front: "M76 112 L102 112 L134 156 L112 164 Z",
          lean: "rotate(7 88 100)",
        }
      : pose === "run_b"
      ? {
          back: "M70 112 L94 112 L114 162 L94 166 Z",
          front: "M74 112 L96 112 L68 164 L48 160 Z",
          lean: "rotate(5 88 100)",
        }
      : pose === "eva"
      ? {
          back: "M66 110 L88 110 L62 158 L46 150 Z",
          front: "M78 110 L102 110 L104 156 L84 160 Z",
          lean: "rotate(-6 88 100)",
        }
      : {
          back: "M66 110 L88 110 L82 166 L60 166 Z",
          front: "M82 110 L104 110 L114 166 L90 166 Z",
          lean: "",
        };

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180">${DEFS}
    <g transform="${legPaths.lean}">
      <!-- Flowing EVA Tether Ribbon -->
      <path d="M44 90 Q12 104 20 132 Q26 144 12 152" fill="none" stroke="#080D14" stroke-width="5.5" stroke-linecap="round"/>
      <!-- Sculpted EVA Jetpack with dual nozzles & cyan telemetry bar -->
      <path d="M32 54 L60 48 L62 108 L36 104 Z" fill="url(#steel)" stroke="#05070B" stroke-width="5" stroke-linejoin="round"/>
      <rect x="39" y="62" width="12" height="5" fill="#57C7FF"/>
      <path d="M38 104 L48 104 L46 115 L36 115 Z" fill="#111822" stroke="#05070B" stroke-width="3.5"/>
      <!-- Back Articulated Leg -->
      <path d="${legPaths.back}" fill="#1C2938" stroke="#05070B" stroke-width="5.2" stroke-linejoin="round"/>
      <!-- Front Articulated Armored Leg -->
      <path d="${legPaths.front}" fill="url(#ceramic)" stroke="#05070B" stroke-width="5.2" stroke-linejoin="round"/>
      <!-- Knee Guard Detail -->
      <path d="M84 134 L106 134 L108 144 L86 144 Z" fill="#0E1520"/>
      <!-- Tapered Armored Torso + Tactical Rig -->
      <path d="M56 52 L110 48 L104 114 L62 114 Z" fill="url(#ceramic)" stroke="#05070B" stroke-width="5.2" stroke-linejoin="round"/>
      <path d="M56 52 L82 50 L78 114 L62 114 Z" fill="#131D2B"/>
      <path d="M62 58 L104 98" stroke="#06080D" stroke-width="7"/>
      <rect x="64" y="96" width="16" height="14" rx="2" fill="#233345" stroke="#05070B" stroke-width="3.5"/>
      <rect x="84" y="96" width="16" height="14" rx="2" fill="#233345" stroke="#05070B" stroke-width="3.5"/>
      <line x1="60" y1="110" x2="106" y2="110" stroke="#05070B" stroke-width="8"/>
      <!-- Sculpted Shoulder Pauldron -->
      <ellipse cx="78" cy="58" rx="22" ry="12" transform="rotate(-14 78 58)" fill="#EFF6FC" stroke="#05070B" stroke-width="4.8"/>
      <!-- Aerospace Helmet + Crimson Shinkawa Visor Slash -->
      <circle cx="88" cy="30" r="24" fill="#F4F8FC" stroke="#05070B" stroke-width="5.2"/>
      <path d="M67 16 A24 24 0 0 0 77 51 L86 30 Z" fill="#182433"/>
      <ellipse cx="99" cy="31" rx="14" ry="12" fill="#070B11" stroke="#05070B" stroke-width="3.5"/>
      <path d="M88 35 L122 20 L111 33 Z" fill="url(#redGlow)"/>
      <path d="M93 25 L105 22" stroke="#FFFFFF" stroke-width="2.4" stroke-linecap="round" opacity="0.72"/>
    </g>
  </svg>`;
}

const RAW_SPRITES: Record<SpriteKey, string> = {
  mercer_stand: makeMercerSvg("stand"),
  mercer_run_a: makeMercerSvg("run_a"),
  mercer_run_b: makeMercerSvg("run_b"),
  mercer_crouch: makeMercerSvg("crouch"),
  mercer_eva: makeMercerSvg("eva"),

  mli_box: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160">${DEFS}
    <path d="M18 32 L138 28 L146 144 L14 146 Z" fill="url(#goldFoil)" stroke="#05070B" stroke-width="6.5" stroke-linejoin="round"/>
    <!-- Crinkled metallic kapton foil facets -->
    <polygon points="22,35 94,32 62,88 18,74" fill="#FFF9DE" opacity="0.45"/>
    <polygon points="94,32 136,31 142,102 62,88" fill="#593E12" opacity="0.34"/>
    <polygon points="18,74 62,88 46,142 16,142" fill="#3D290A" opacity="0.28"/>
    <path d="M18 35 L62 88 L142 102 M94 32 L62 88 L46 142" stroke="#080B10" stroke-width="2.2" opacity="0.45"/>
    <!-- Corner reinforcement tape & tactical stencil -->
    <rect x="24" y="40" width="24" height="8" fill="#18222F"/>
    <rect x="112" y="38" width="20" height="8" fill="#18222F"/>
    <rect x="34" y="96" width="92" height="32" fill="#0A0E14" opacity="0.82"/>
    <text x="80" y="114" fill="#F6DF96" font-family="monospace" font-weight="900" font-size="16" text-anchor="middle">MLI-09</text>
    <text x="80" y="124" fill="#8EA6BC" font-family="monospace" font-weight="700" font-size="8" text-anchor="middle">THERMAL SHROUD</text>
  </svg>`,

  starship: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 120">${DEFS}
    <!-- Upper & Lower Swept Delta Wings -->
    <path d="M226 60 L150 34 L34 12 L58 46 L26 60 L58 74 L34 108 L150 86 Z" fill="url(#ceramic)" stroke="#05070B" stroke-width="5.5" stroke-linejoin="round"/>
    <!-- Ventral Dark Ceramic Heat-Shield Tiles -->
    <path d="M226 60 L150 86 L34 108 L58 74 L26 60 Z" fill="#141E2B"/>
    <path d="M226 60 L150 86 L34 108" fill="none" stroke="#05070B" stroke-width="5"/>
    <!-- Fuselage Spine & Squadron Crimson Markings -->
    <path d="M44 24 L132 42 L120 48 L48 34 Z" fill="#FF3B2F"/>
    <line x1="68" y1="60" x2="196" y2="60" stroke="#05070B" stroke-width="3"/>
    <line x1="94" y1="42" x2="94" y2="78" stroke="#05070B" stroke-width="2.5" opacity="0.65"/>
    <line x1="138" y1="44" x2="138" y2="76" stroke="#05070B" stroke-width="2.5" opacity="0.65"/>
    <!-- Twin Rear Engine Bells -->
    <rect x="20" y="42" width="18" height="14" rx="2" fill="#1A2534" stroke="#05070B" stroke-width="4"/>
    <rect x="20" y="64" width="18" height="14" rx="2" fill="#1A2534" stroke="#05070B" stroke-width="4"/>
    <!-- Sleek Aerospace Cockpit Canopy -->
    <path d="M132 46 Q164 40 184 54 Q162 60 132 56 Z" fill="#080C12" stroke="#05070B" stroke-width="3"/>
    <path d="M138 48 Q162 44 178 53" fill="none" stroke="#FF3B2F" stroke-width="4" stroke-linecap="round"/>
    <circle cx="44" cy="18" r="4" fill="#57C7FF"/>
  </svg>`,

  trooper_a: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180">${DEFS}
    <path d="M62 110 L84 110 L54 164 L36 160 Z" fill="#151F2B" stroke="#05070B" stroke-width="5.2" stroke-linejoin="round"/>
    <path d="M80 110 L104 110 L124 164 L102 166 Z" fill="url(#steel)" stroke="#05070B" stroke-width="5.2" stroke-linejoin="round"/>
    <path d="M56 54 L108 50 L104 112 L60 112 Z" fill="url(#steel)" stroke="#05070B" stroke-width="5.2" stroke-linejoin="round"/>
    <path d="M56 54 L80 52 L76 112 L60 112 Z" fill="#0E1520"/>
    <path d="M62 56 L106 54 L102 74 L62 76 Z" fill="#D2E0EC" stroke="#05070B" stroke-width="4"/>
    <!-- Angular Ballistic Android Helmet -->
    <path d="M66 20 L104 18 L114 34 L104 48 L66 48 L60 32 Z" fill="url(#ceramic)" stroke="#05070B" stroke-width="5" stroke-linejoin="round"/>
    <path d="M84 28 L113 28 L110 38 L82 38 Z" fill="#070A0F"/>
    <rect x="86" y="30" width="24" height="5.5" fill="url(#redGlow)"/>
    <!-- Heavy Security Carbine -->
    <path d="M82 76 L156 72 L162 82 L144 88 L116 88 L110 100 L96 100 L98 88 L82 88 Z" fill="#101722" stroke="#05070B" stroke-width="4.5" stroke-linejoin="round"/>
    <rect x="122" y="76" width="28" height="3.5" fill="#FF3B2F"/>
  </svg>`,

  trooper_b: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180">${DEFS}
    <path d="M74 110 L96 110 L114 164 L96 166 Z" fill="#151F2B" stroke="#05070B" stroke-width="5.2" stroke-linejoin="round"/>
    <path d="M66 110 L90 110 L68 164 L48 162 Z" fill="url(#steel)" stroke="#05070B" stroke-width="5.2" stroke-linejoin="round"/>
    <path d="M56 54 L108 50 L104 112 L60 112 Z" fill="url(#steel)" stroke="#05070B" stroke-width="5.2" stroke-linejoin="round"/>
    <path d="M56 54 L80 52 L76 112 L60 112 Z" fill="#0E1520"/>
    <path d="M62 56 L106 54 L102 74 L62 76 Z" fill="#D2E0EC" stroke="#05070B" stroke-width="4"/>
    <path d="M66 20 L104 18 L114 34 L104 48 L66 48 L60 32 Z" fill="url(#ceramic)" stroke="#05070B" stroke-width="5" stroke-linejoin="round"/>
    <path d="M84 28 L113 28 L110 38 L82 38 Z" fill="#070A0F"/>
    <rect x="86" y="30" width="24" height="5.5" fill="url(#redGlow)"/>
    <path d="M82 76 L156 72 L162 82 L144 88 L116 88 L110 100 L96 100 L98 88 L82 88 Z" fill="#101722" stroke="#05070B" stroke-width="4.5" stroke-linejoin="round"/>
    <rect x="122" y="76" width="28" height="3.5" fill="#FF3B2F"/>
  </svg>`,

  drone: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 140">${DEFS}
    <!-- Menacing Shinkawa Ink Swept Orbital Blades (echoing Style A concept!) -->
    <path d="M18 28 L108 42 L124 22 L152 38 L104 60 L28 52 Z" fill="#0D141E" stroke="#04060A" stroke-width="5" stroke-linejoin="round"/>
    <path d="M12 108 L98 82 L120 112 L146 94 L102 74 L24 88 Z" fill="#0D141E" stroke="#04060A" stroke-width="5" stroke-linejoin="round"/>
    <!-- Central Armored Chassis -->
    <path d="M60 44 L144 38 L178 68 L142 102 L58 92 L42 68 Z" fill="url(#ceramic)" stroke="#04060A" stroke-width="5.5" stroke-linejoin="round"/>
    <path d="M60 44 L112 41 L104 98 L58 92 L42 68 Z" fill="#15202E"/>
    <!-- Recessed Glowing Optical Sensor Housing -->
    <ellipse cx="146" cy="70" rx="20" ry="22" fill="#070A0F" stroke="#04060A" stroke-width="4"/>
    <circle cx="148" cy="70" r="13" fill="url(#amberGlow)"/>
    <circle cx="151" cy="68" r="5.5" fill="#FFFFFF"/>
    <!-- Ink Wing Rim Highlights -->
    <path d="M36 33 L106 44 M68 48 L138 43" stroke="#EEF5FB" stroke-width="3" stroke-linecap="round"/>
  </svg>`,

  heavy: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 220">${DEFS}
    <!-- Reverse-Jointed Heavy Hydraulic Legs -->
    <path d="M64 134 L94 134 L72 174 L86 206 L52 206 L44 170 Z" fill="#121A24" stroke="#04060A" stroke-width="5.5" stroke-linejoin="round"/>
    <path d="M108 134 L142 134 L126 174 L148 206 L110 206 L96 172 Z" fill="url(#steel)" stroke="#04060A" stroke-width="5.5" stroke-linejoin="round"/>
    <!-- Shoulder Missile Rack -->
    <rect x="34" y="24" width="46" height="36" rx="4" fill="#1A2634" stroke="#04060A" stroke-width="5"/>
    <circle cx="48" cy="36" r="5" fill="#FF9500"/><circle cx="64" cy="36" r="5" fill="#FF9500"/>
    <circle cx="48" cy="50" r="5" fill="#FF3B2F"/><circle cx="64" cy="50" r="5" fill="#FF3B2F"/>
    <!-- Hulking Bolted Ceramic Carapace -->
    <path d="M40 54 L148 44 L172 78 L162 142 L48 142 L34 94 Z" fill="url(#ceramic)" stroke="#04060A" stroke-width="6" stroke-linejoin="round"/>
    <path d="M40 54 L96 49 L92 142 L48 142 L34 94 Z" fill="#172332"/>
    <!-- Glowing Crimson Optic Visor Bar -->
    <path d="M112 68 L166 68 L162 84 L110 84 Z" fill="#06080D" stroke="#04060A" stroke-width="4"/>
    <rect x="116" y="72" width="44" height="8" fill="url(#redGlow)"/>
    <!-- Heavy Twin Rotary Arm Cannon -->
    <rect x="118" y="100" width="76" height="22" rx="3" fill="#0E1520" stroke="#04060A" stroke-width="5"/>
    <line x1="126" y1="106" x2="188" y2="106" stroke="#8CA8C2" stroke-width="2.5"/>
    <line x1="126" y1="115" x2="188" y2="115" stroke="#8CA8C2" stroke-width="2.5"/>
  </svg>`,

  interceptor: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 120">${DEFS}
    <path d="M18 60 L82 22 L182 14 L154 50 L182 60 L154 70 L182 106 L82 98 Z" fill="url(#ceramic)" stroke="#04060A" stroke-width="5.5" stroke-linejoin="round"/>
    <path d="M18 60 L82 98 L182 106 L154 70 L182 60 Z" fill="#121B28"/>
    <path d="M42 60 L92 48 L112 60 L92 72 Z" fill="#070B11"/>
    <circle cx="78" cy="60" r="10" fill="url(#amberGlow)"/>
    <circle cx="75" cy="60" r="4" fill="#FFFFFF"/>
  </svg>`,

  pow_pod: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 140 190">${DEFS}
    <!-- Armored Emergency Cryo-Pod Frame -->
    <rect x="22" y="14" width="96" height="162" rx="14" fill="#0F1C2A" stroke="#04060A" stroke-width="6"/>
    <rect x="30" y="24" width="80" height="122" rx="8" fill="#153249" stroke="#57C7FF" stroke-width="3.5"/>
    <!-- Expressive Trapped Orbital Engineer Inside Glass -->
    <circle cx="68" cy="62" r="17" fill="#EFF6FC" stroke="#05070B" stroke-width="4"/>
    <rect x="58" y="56" width="22" height="11" rx="4" fill="#FF9500" stroke="#05070B" stroke-width="2.5"/>
    <path d="M48 82 L88 82 L84 142 L52 142 Z" fill="url(#ceramic)" stroke="#05070B" stroke-width="4.5" stroke-linejoin="round"/>
    <!-- Waving Hand Pressed to Glass -->
    <path d="M84 90 L102 60" stroke="#F4F9FD" stroke-width="11" stroke-linecap="round"/>
    <path d="M84 90 L102 60" stroke="#05070B" stroke-width="3" stroke-linecap="round"/>
    <!-- Diagonal Glass Reflection & Base Console -->
    <polygon points="34,28 74,28 34,94" fill="#FFFFFF" opacity="0.18"/>
    <rect x="16" y="146" width="108" height="32" rx="4" fill="url(#steel)" stroke="#04060A" stroke-width="5"/>
    <rect x="36" y="156" width="44" height="10" fill="#57C7FF"/>
    <circle cx="98" cy="161" r="5" fill="#FF3B2F"/>
  </svg>`,

  item_medgel: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">${DEFS}
    <!-- Pressurized Bio-Med-Gel Cryo Injector -->
    <rect x="24" y="14" width="72" height="92" rx="12" fill="#111C28" stroke="#04060A" stroke-width="6"/>
    <rect x="34" y="28" width="52" height="64" rx="6" fill="url(#greenGlow)" stroke="#04060A" stroke-width="4"/>
    <rect x="40" y="34" width="12" height="50" rx="4" fill="#FFFFFF" opacity="0.45"/>
    <!-- Medical Cross Emblem -->
    <path d="M54 44 H66 V54 H76 V66 H66 V76 H54 V66 H44 V54 H54 Z" fill="#071810"/>
    <!-- Titanium Top/Bottom Caps -->
    <rect x="34" y="10" width="52" height="16" rx="4" fill="#DCE8F2" stroke="#04060A" stroke-width="4.5"/>
    <rect x="34" y="94" width="52" height="16" rx="4" fill="#2A3A4C" stroke="#04060A" stroke-width="4.5"/>
  </svg>`,

  item_emp: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">${DEFS}
    <!-- Finned Electromagnetic Arc Grenade -->
    <ellipse cx="60" cy="62" rx="34" ry="44" fill="url(#steel)" stroke="#04060A" stroke-width="6"/>
    <rect x="26" y="42" width="68" height="14" fill="url(#cyanGlow)" stroke="#04060A" stroke-width="4"/>
    <rect x="26" y="66" width="68" height="14" fill="url(#cyanGlow)" stroke="#04060A" stroke-width="4"/>
    <rect x="42" y="10" width="36" height="18" rx="4" fill="#E8F2FA" stroke="#04060A" stroke-width="4.5"/>
    <!-- Electric Bolt Emblem -->
    <polygon points="64,34 48,62 60,62 54,88 74,56 61,56" fill="#06121C" stroke="#FFFFFF" stroke-width="2"/>
  </svg>`,

  item_weapon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 140 110">${DEFS}
    <!-- Heavy Titanium Munitions Case -->
    <path d="M12 28 L128 28 L134 94 L6 94 Z" fill="url(#steel)" stroke="#04060A" stroke-width="6" stroke-linejoin="round"/>
    <rect x="20" y="38" width="100" height="46" fill="#0A1018" stroke="#FF9500" stroke-width="3.5"/>
    <path d="M32 60 L44 52 H96 L108 56 V66 H94 L84 72 H64 L58 80 H46 L50 68 H34 Z" fill="#FF9500"/>
    <rect x="46" y="16" width="48" height="14" rx="4" fill="#DCE8F2" stroke="#04060A" stroke-width="4.5"/>
  </svg>`,

  hack_terminal: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 140 160">${DEFS}
    <!-- Antenna & Signal Beacon -->
    <line x1="96" y1="10" x2="96" y2="44" stroke="#DCE8F2" stroke-width="5"/>
    <circle cx="96" cy="12" r="7" fill="#FF9500"/>
    <!-- Angled Server Security Terminal -->
    <path d="M22 44 L118 44 L126 148 L14 148 Z" fill="url(#steel)" stroke="#04060A" stroke-width="6" stroke-linejoin="round"/>
    <rect x="30" y="56" width="80" height="48" rx="4" fill="#070B11" stroke="#FF9500" stroke-width="4"/>
    <path d="M38 82 L52 70 L64 88 L78 66 L94 82 L102 76" fill="none" stroke="#FF9500" stroke-width="4" stroke-linecap="round"/>
    <rect x="32" y="114" width="76" height="22" fill="#0E1620" stroke="#04060A" stroke-width="3.5"/>
    <rect x="40" y="121" width="24" height="8" fill="#57C7FF"/>
  </svg>`,

  hack_terminal_dark: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 140 160">${DEFS}
    <line x1="96" y1="10" x2="96" y2="44" stroke="#57C7FF" stroke-width="5"/>
    <circle cx="96" cy="12" r="7" fill="#57C7FF"/>
    <path d="M22 44 L118 44 L126 148 L14 148 Z" fill="url(#steel)" stroke="#04060A" stroke-width="6" stroke-linejoin="round"/>
    <rect x="30" y="56" width="80" height="48" rx="4" fill="#07131E" stroke="#57C7FF" stroke-width="4"/>
    <path d="M48 80 L64 94 L94 64" fill="none" stroke="#57C7FF" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
    <rect x="32" y="114" width="76" height="22" fill="#0E1620" stroke="#04060A" stroke-width="3.5"/>
  </svg>`,

  cover_rack: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 140">${DEFS}
    <!-- Beveled Brushed-Steel Orbital Server Cover Monolith (Style A signature!) -->
    <path d="M14 16 L156 12 L168 24 L168 130 L12 130 L12 24 Z" fill="url(#steel)" stroke="#04060A" stroke-width="6" stroke-linejoin="round"/>
    <!-- Stark White Cel Top-Left Bevel -->
    <path d="M16 18 L154 15 L154 26 L22 28 L22 124 L16 124 Z" fill="#E8F2FA"/>
    <!-- Deep Recessed Server Blade Bay -->
    <rect x="28" y="34" width="96" height="86" fill="#070B11" stroke="#04060A" stroke-width="4"/>
    <rect x="36" y="44" width="80" height="10" fill="#1E3042"/><rect x="40" y="47" width="46" height="4" fill="#57C7FF"/>
    <rect x="36" y="62" width="80" height="10" fill="#1E3042"/><rect x="40" y="65" width="62" height="4" fill="#57C7FF"/>
    <rect x="36" y="80" width="80" height="10" fill="#1E3042"/><rect x="40" y="83" width="32" height="4" fill="#FF9500"/>
    <rect x="36" y="98" width="80" height="10" fill="#1E3042"/><rect x="40" y="101" width="54" height="4" fill="#57C7FF"/>
    <!-- Right Shadow Face + Glowing Liquid-Coolant Pipe -->
    <rect x="132" y="28" width="30" height="96" fill="#0D141F"/>
    <rect x="142" y="40" width="10" height="72" rx="4" fill="url(#cyanGlow)" stroke="#04060A" stroke-width="3"/>
  </svg>`,

  cover_rack_core: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 140">${DEFS}
    <path d="M14 16 L156 12 L168 24 L168 130 L12 130 L12 24 Z" fill="url(#steel)" stroke="#04060A" stroke-width="6" stroke-linejoin="round"/>
    <path d="M16 18 L154 15 L154 26 L22 28 L22 124 L16 124 Z" fill="#E8F2FA"/>
    <rect x="28" y="34" width="96" height="86" fill="#070B11" stroke="#04060A" stroke-width="4"/>
    <rect x="36" y="44" width="80" height="10" fill="#2A161A"/><rect x="40" y="47" width="56" height="4" fill="#FF3B2F"/>
    <rect x="36" y="62" width="80" height="10" fill="#1E3042"/><rect x="40" y="65" width="62" height="4" fill="#57C7FF"/>
    <rect x="36" y="80" width="80" height="10" fill="#2A161A"/><rect x="40" y="83" width="44" height="4" fill="#FF3B2F"/>
    <rect x="36" y="98" width="80" height="10" fill="#1E3042"/><rect x="40" y="101" width="54" height="4" fill="#57C7FF"/>
    <rect x="132" y="28" width="30" height="96" fill="#0D141F"/>
    <rect x="142" y="40" width="10" height="72" rx="4" fill="url(#redGlow)" stroke="#04060A" stroke-width="3"/>
  </svg>`,

  boss_iron_gantry: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 280">${DEFS}
    <!-- Heavy Tank Treads & Armored Bogie Wheels -->
    <rect x="42" y="210" width="212" height="54" rx="16" fill="#0C121B" stroke="#04060A" stroke-width="7"/>
    <circle cx="76" cy="237" r="16" fill="#324356" stroke="#04060A" stroke-width="5"/>
    <circle cx="122" cy="237" r="16" fill="#324356" stroke="#04060A" stroke-width="5"/>
    <circle cx="168" cy="237" r="16" fill="#324356" stroke="#04060A" stroke-width="5"/>
    <circle cx="214" cy="237" r="16" fill="#324356" stroke="#04060A" stroke-width="5"/>
    <!-- Exhaust Smoke Stacks -->
    <rect x="216" y="16" width="20" height="56" fill="#1A2534" stroke="#04060A" stroke-width="5"/>
    <!-- Colossal Crane Loader Hull -->
    <path d="M58 58 L98 34 L238 42 L252 210 L54 210 Z" fill="url(#steel)" stroke="#04060A" stroke-width="7" stroke-linejoin="round"/>
    <!-- Ceramic Armored Cowl -->
    <path d="M64 56 L222 46 L212 96 L64 98 Z" fill="url(#ceramic)" stroke="#04060A" stroke-width="6" stroke-linejoin="round"/>
    <!-- Red Scanner Slit -->
    <rect x="74" y="66" width="66" height="14" fill="#06080D" stroke="#04060A" stroke-width="4"/>
    <rect x="78" y="69" width="54" height="8" fill="url(#redGlow)"/>
    <!-- Closed Coolant Louvers -->
    <rect x="106" y="118" width="96" height="56" fill="#2A1212" stroke="#04060A" stroke-width="5"/>
    <line x1="106" y1="136" x2="202" y2="136" stroke="#04060A" stroke-width="5"/>
    <line x1="106" y1="154" x2="202" y2="154" stroke="#04060A" stroke-width="5"/>
    <!-- Hydraulic Pincer Claw Arm -->
    <path d="M12 108 L44 90 L38 118 L86 118 L86 150 L38 150 L44 176 L12 158 L26 134 Z" fill="#DCE8F2" stroke="#04060A" stroke-width="6" stroke-linejoin="round"/>
  </svg>`,

  boss_iron_gantry_vent: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 280">${DEFS}
    <rect x="42" y="210" width="212" height="54" rx="16" fill="#0C121B" stroke="#04060A" stroke-width="7"/>
    <circle cx="76" cy="237" r="16" fill="#324356" stroke="#04060A" stroke-width="5"/>
    <circle cx="122" cy="237" r="16" fill="#324356" stroke="#04060A" stroke-width="5"/>
    <circle cx="168" cy="237" r="16" fill="#324356" stroke="#04060A" stroke-width="5"/>
    <circle cx="214" cy="237" r="16" fill="#324356" stroke="#04060A" stroke-width="5"/>
    <rect x="216" y="16" width="20" height="56" fill="#1A2534" stroke="#04060A" stroke-width="5"/>
    <path d="M58 58 L98 34 L238 42 L252 210 L54 210 Z" fill="url(#steel)" stroke="#04060A" stroke-width="7" stroke-linejoin="round"/>
    <path d="M64 56 L222 46 L212 96 L64 98 Z" fill="url(#ceramic)" stroke="#04060A" stroke-width="6" stroke-linejoin="round"/>
    <rect x="74" y="66" width="66" height="14" fill="#06080D" stroke="#04060A" stroke-width="4"/>
    <rect x="78" y="69" width="54" height="8" fill="#57C7FF"/>
    <!-- MOLTEN OPEN COOLANT CORE WEAKPOINT! -->
    <rect x="102" y="114" width="104" height="64" fill="url(#amberGlow)" stroke="#FFF5D4" stroke-width="5"/>
    <rect x="118" y="128" width="72" height="36" fill="#FFF7DF" opacity="0.75"/>
    <path d="M12 108 L44 90 L38 118 L86 118 L86 150 L38 150 L44 176 L12 158 L26 134 Z" fill="#DCE8F2" stroke="#04060A" stroke-width="6" stroke-linejoin="round"/>
  </svg>`,

  boss_valkyrie: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 190">${DEFS}
    <!-- Swept-Forward Stealth Orbital Gunship -->
    <path d="M12 95 L98 20 L256 36 L204 78 L256 95 L204 112 L256 154 L98 170 Z" fill="url(#ceramic)" stroke="#04060A" stroke-width="6.5" stroke-linejoin="round"/>
    <path d="M12 95 L98 170 L256 154 L204 112 L256 95 Z" fill="#131D2B"/>
    <path d="M68 58 L216 48 L194 64 L82 70 Z" fill="#FF3B2F"/>
    <!-- Glowing Crimson Sensor Core -->
    <ellipse cx="96" cy="95" rx="28" ry="20" fill="#070A0F" stroke="#04060A" stroke-width="5"/>
    <circle cx="92" cy="95" r="14" fill="url(#redGlow)"/>
    <circle cx="88" cy="92" r="5" fill="#FFFFFF"/>
  </svg>`,

  boss_mirror: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 220">${DEFS}
    <!-- Fractured Faceted Chrome Mask Monolith (matching portrait-mirror!) -->
    <polygon points="110,16 186,68 164,196 56,196 34,68" fill="url(#ceramic)" stroke="#04060A" stroke-width="7" stroke-linejoin="round"/>
    <polygon points="110,16 186,68 164,196 110,196" fill="#141F2D"/>
    <!-- Dramatic Vertical Sumi-e Crack Slash -->
    <path d="M126 12 L94 208" stroke="#04060A" stroke-width="11"/>
    <!-- Dual Amber & Crimson Scanner Irises -->
    <polygon points="56,92 98,98 92,126 60,122" fill="#070A0F" stroke="#04060A" stroke-width="4"/>
    <circle cx="78" cy="110" r="11" fill="url(#amberGlow)"/>
    <polygon points="164,92 122,98 128,126 160,122" fill="#070A0F" stroke="#04060A" stroke-width="4"/>
    <circle cx="142" cy="110" r="11" fill="url(#redGlow)"/>
    <!-- Angular Chin Vent -->
    <path d="M84 156 L110 166 L136 156 L128 178 L92 178 Z" fill="#0B111A" stroke="#DCE8F2" stroke-width="2.5"/>
  </svg>`,

  boss_lark: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 260 260">${DEFS}
    <!-- Armored Ceramic Containment Petals Encircling Neural Core -->
    <path d="M130 14 L172 52 L148 78 L112 78 L88 52 Z" fill="url(#ceramic)" stroke="#04060A" stroke-width="6"/>
    <path d="M130 246 L172 208 L148 182 L112 182 L88 208 Z" fill="url(#ceramic)" stroke="#04060A" stroke-width="6"/>
    <path d="M14 130 L52 88 L78 112 L78 148 L52 172 Z" fill="url(#ceramic)" stroke="#04060A" stroke-width="6"/>
    <path d="M246 130 L208 88 L182 112 L182 148 L208 172 Z" fill="url(#ceramic)" stroke="#04060A" stroke-width="6"/>
    <!-- Central Neural Sphere -->
    <circle cx="130" cy="130" r="64" fill="#0A121C" stroke="#04060A" stroke-width="7"/>
    <circle cx="130" cy="130" r="52" fill="url(#cyanGlow)" opacity="0.88"/>
    <circle cx="130" cy="130" r="34" fill="#08121E" stroke="#FFFFFF" stroke-width="3"/>
    <circle cx="130" cy="130" r="18" fill="url(#redGlow)"/>
    <circle cx="130" cy="130" r="7" fill="#FFFFFF"/>
  </svg>`,
};

export class InkSpriteBank {
  private map: Record<SpriteKey, HTMLImageElement>;

  constructor() {
    this.map = {} as Record<SpriteKey, HTMLImageElement>;
    for (const key of Object.keys(RAW_SPRITES) as SpriteKey[]) {
      this.map[key] = svgToImage(RAW_SPRITES[key]);
    }
  }

  public get(key: SpriteKey): HTMLImageElement | null {
    const img = this.map[key];
    return img && img.complete && img.naturalWidth > 0 ? img : null;
  }
}
