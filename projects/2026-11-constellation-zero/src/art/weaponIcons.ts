import type { WeaponId } from "../engine/types";

/**
 * Crisp Yoji Shinkawa–style tactical silhouettes for HUD weapon readouts,
 * Armory cards, and world weapon drops.
 */
export const WEAPON_SVGS: Record<WeaponId, string> = {
  silenced_rail: `<svg viewBox="0 0 96 36" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M8 14L14 10H54L56 13H88V19H56L52 21H36L31 32H19L23 21H12L8 14Z" fill="#DCE8F2" stroke="#05070B" stroke-width="2.2" stroke-linejoin="round"/>
    <path d="M14 10H54L55 15H12L14 10Z" fill="#F4F9FD"/>
    <path d="M56 13H88V19H56V13Z" fill="#233244" stroke="#05070B" stroke-width="1.8"/>
    <rect x="34" y="19" width="16" height="5" rx="1" fill="#182330" stroke="#05070B" stroke-width="1.4"/>
    <rect x="40" y="21" width="7" height="1.8" fill="#57C7FF"/>
    <line x1="63" y1="14" x2="63" y2="18" stroke="#8FB2CC" stroke-width="1.4"/>
    <line x1="71" y1="14" x2="71" y2="18" stroke="#8FB2CC" stroke-width="1.4"/>
    <line x1="79" y1="14" x2="79" y2="18" stroke="#8FB2CC" stroke-width="1.4"/>
  </svg>`,

  pulse_carbine: `<svg viewBox="0 0 96 36" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M4 13L16 11H28L32 8H50L54 11H76L88 13V18H74L70 21H58L62 32H52L47 21H34L30 31H21L24 21H6L4 13Z" fill="#DCE8F2" stroke="#05070B" stroke-width="2.2" stroke-linejoin="round"/>
    <path d="M32 8H50L52 13H30L32 8Z" fill="#16212E" stroke="#05070B" stroke-width="1.6"/>
    <rect x="56" y="14" width="18" height="3.2" fill="#57C7FF"/>
    <path d="M54 21H61L64 31H55L54 21Z" fill="#1C2A3A"/>
    <rect x="36" y="9.5" width="10" height="2" fill="#57C7FF"/>
  </svg>`,

  mag_shotgun: `<svg viewBox="0 0 96 36" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M4 16L18 11H84L90 13V19H84L76 23H42L36 22L26 31H15L22 21H6L4 16Z" fill="#DCE8F2" stroke="#05070B" stroke-width="2.2" stroke-linejoin="round"/>
    <rect x="46" y="18" width="28" height="5.5" fill="#233244" stroke="#05070B" stroke-width="1.6"/>
    <rect x="49" y="19.5" width="20" height="2.4" fill="#FF9500"/>
    <line x1="26" y1="12" x2="78" y2="12" stroke="#FFFFFF" stroke-width="2"/>
  </svg>`,

  piercing_rail: `<svg viewBox="0 0 96 36" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M3 16L14 12H36L40 8H56L59 12H92V16H64V18H92V21H54L46 24H30L25 32H15L19 22H5L3 16Z" fill="#E6F0F8" stroke="#05070B" stroke-width="2.1" stroke-linejoin="round"/>
    <rect x="54" y="15.2" width="36" height="2.6" fill="#FF3B2F"/>
    <rect x="39" y="8" width="18" height="4.5" fill="#141E2B" stroke="#05070B" stroke-width="1.5"/>
    <circle cx="54" cy="10.2" r="1.4" fill="#FF3B2F"/>
    <rect x="26" y="14" width="22" height="5" fill="#1C2938"/>
  </svg>`,

  micro_missiles: `<svg viewBox="0 0 96 36" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M8 9H78L88 12V24L78 27H8L4 22V14L8 9Z" fill="#223040" stroke="#05070B" stroke-width="2.4" stroke-linejoin="round"/>
    <rect x="12" y="11" width="62" height="6" fill="#DCE8F2" stroke="#05070B" stroke-width="1.5"/>
    <rect x="12" y="19" width="62" height="6" fill="#B6C8D9" stroke="#05070B" stroke-width="1.5"/>
    <path d="M78 12H86V17H78V12Z" fill="#FF9500"/>
    <path d="M78 19H86V24H78V19Z" fill="#FF3B2F"/>
    <path d="M28 27H40L36 34H25L28 27Z" fill="#141E2B" stroke="#05070B" stroke-width="1.6"/>
  </svg>`,
};
