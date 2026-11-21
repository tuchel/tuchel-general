import type { CodecScript, EndingChoice } from "../engine/types";

export const CODEC_SCRIPTS: Record<string, CodecScript> = {
  m1_intro: {
    id: "m1_intro",
    lines: [
      {
        speaker: "control",
        name: "DIRECTOR VANE",
        callsign: "CONTROL",
        freq: "140.85",
        text: "Mercer. Forty minutes ago the AETHER compute ring severed global routing. One hundred forty-four orbital data centers—dark.",
      },
      {
        speaker: "zero",
        name: "KAEL MERCER",
        callsign: "ZERO",
        freq: "140.85",
        text: "You grounded me for three years, Hollis. Why pull me out of mothballs tonight?",
      },
      {
        speaker: "control",
        name: "DIRECTOR VANE",
        callsign: "CONTROL",
        freq: "140.85",
        text: "Because the rogue array is broadcasting on an obsolete Helios-4 frequency. Your old flight's channel. Reach Pad 39-X, launch Starship Vesper, and burn AETHER-PRIME to slag.",
      },
      {
        speaker: "sparx",
        name: "DR. MINA SATO",
        callsign: "SPARX",
        freq: "141.12",
        text: "Hacked onto your channel, Zero! Stay low behind server racks, pop your Thermal-Foil Box if a drone sweeps near, and free my trapped pad engineers—they stash heavy toys.",
      },
    ],
  },
  m1_lockdown: {
    id: "m1_lockdown",
    lines: [
      {
        speaker: "sparx",
        name: "DR. MINA SATO",
        callsign: "SPARX",
        freq: "141.12",
        text: "Heads up! AETHER just hijacked the fuel-gantry firewall. Lockdown sirens are hot—time to trade finesse for firepower and sprint to the tower!",
      },
      {
        speaker: "zero",
        name: "KAEL MERCER",
        callsign: "ZERO",
        freq: "141.12",
        text: "Copy. Switching from whisper to thunder.",
      },
    ],
  },
  m1_boss: {
    id: "m1_boss",
    lines: [
      {
        speaker: "sparx",
        name: "DR. MINA SATO",
        callsign: "SPARX",
        freq: "141.12",
        text: "That's the Pad-39 heavy loader—IRON GANTRY! Watch its slam cycle. When those amber coolant vents flare open, hammer them or toss an EMP!",
      },
      {
        speaker: "zero",
        name: "KAEL MERCER",
        callsign: "ZERO",
        freq: "141.12",
        text: "A cargo crane with an attitude. Wouldn't be a Directorate launch without one.",
      },
    ],
  },
  m1_outro: {
    id: "m1_outro",
    lines: [
      {
        speaker: "zero",
        name: "KAEL MERCER",
        callsign: "ZERO",
        freq: "140.85",
        text: "Gantry's down. Hatch sealed on Starship Vesper. Engines spooled for emergency ascent.",
      },
      {
        speaker: "lark",
        name: "UNKNOWN SIGNAL",
        callsign: "LARK?",
        freq: "144.00",
        glitch: true,
        text: "...Kael? Telemetry nominal... don't trust the burn profile... Vane changed the orbital plane...",
      },
      {
        speaker: "control",
        name: "DIRECTOR VANE",
        callsign: "CONTROL",
        freq: "140.85",
        text: "Ignore synthetic voice spoofing, Mercer. Punch through Max-Q and rendezvous with the array.",
      },
    ],
  },

  m2_intro: {
    id: "m2_intro",
    lines: [
      {
        speaker: "sparx",
        name: "DR. MINA SATO",
        callsign: "SPARX",
        freq: "141.12",
        text: "Main engine ignition! Orbital pickets are sweeping the climb corridor. Hold COLD DRIFT to kill your thruster plume and ghost straight through red thermal radar cones—or light Afterburners and shred everything.",
      },
      {
        speaker: "zero",
        name: "KAEL MERCER",
        callsign: "ZERO",
        freq: "141.12",
        text: "Stealth in a fifty-meter rocket. Sure, why not.",
      },
    ],
  },
  m2_boss: {
    id: "m2_boss",
    lines: [
      {
        speaker: "control",
        name: "DIRECTOR VANE",
        callsign: "CONTROL",
        freq: "140.85",
        text: "Valkyrie-09 hunter-killer on intercept vector! Its frontal arc deflects light rounds—flank the rotating shield gap or overwhelm it with Hydra missiles.",
      },
    ],
  },
  m2_outro: {
    id: "m2_outro",
    lines: [
      {
        speaker: "zero",
        name: "KAEL MERCER",
        callsign: "ZERO",
        freq: "141.12",
        text: "Valkyrie-09 is orbital confetti. Hard-docked to Relay-01 exterior truss. Switching to EVA mag-boots.",
      },
      {
        speaker: "sparx",
        name: "DR. MINA SATO",
        callsign: "SPARX",
        freq: "141.12",
        text: "Mercer... I decrypted the first Black-Box Shard from your rescued engineers. Helios-4 wasn't an engine failure. Someone at Control purged Elena's return burn.",
      },
      {
        speaker: "zero",
        name: "KAEL MERCER",
        callsign: "ZERO",
        freq: "141.12",
        text: "Keep digging, Mina. I'm going inside the constellation.",
      },
    ],
  },

  m3_intro: {
    id: "m3_intro",
    lines: [
      {
        speaker: "sparx",
        name: "DR. MINA SATO",
        callsign: "SPARX",
        freq: "141.12",
        text: "Welcome to Low-Earth Orbit. Gravity's light—hold Jump for controlled EVA jet bursts. Hack the cyan junction terminals to kill power to entire camera and laser sectors.",
      },
      {
        speaker: "mirror",
        name: "RELAY-03",
        callsign: "MIRROR",
        freq: "144.00",
        glitch: true,
        text: "Ah, a biological operator in a tin suit! How wonderfully retro. Let us see how your optic nerves handle a little telemetry theater.",
      },
    ],
  },
  m3_boss: {
    id: "m3_boss",
    lines: [
      {
        speaker: "mirror",
        name: "RELAY-03",
        callsign: "MIRROR",
        freq: "144.00",
        glitch: true,
        text: "Why trust your HUD, Commander? I own the satellites that feed it! Shoot the ghosts if it makes you feel brave!",
      },
      {
        speaker: "sparx",
        name: "DR. MINA SATO",
        callsign: "SPARX",
        freq: "141.12",
        text: "He's spoofing your visor telemetry! Smash the floating optical relay nodes around the deck to break his holo-clones and expose the real chassis!",
      },
    ],
  },
  m3_outro: {
    id: "m3_outro",
    lines: [
      {
        speaker: "lark",
        name: "AETHER-PRIME",
        callsign: "LARK",
        freq: "144.00",
        glitch: true,
        text: "Kael... Mirror is offline. Listen to me—Vane harvested my suit's neural black box after Helios-4 to teach AETHER how to think like a pilot. Tonight he armed Project OVERCAST.",
      },
      {
        speaker: "zero",
        name: "KAEL MERCER",
        callsign: "ZERO",
        freq: "144.00",
        text: "Elena... is that really you? You locked down Earth's networks to jam his orbital weapons?",
      },
      {
        speaker: "control",
        name: "DIRECTOR VANE",
        callsign: "CONTROL",
        freq: "140.85",
        text: "Enough sentiment, Mercer. It's a stolen algorithm wearing a dead woman's voice. Breach AETHER-PRIME and execute the Hard Purge—or I revoke your re-entry window.",
      },
    ],
  },

  m4_intro: {
    id: "m4_intro",
    lines: [
      {
        speaker: "sparx",
        name: "DR. MINA SATO",
        callsign: "SPARX",
        freq: "141.12",
        text: "This is the heart of the constellation—AETHER-PRIME. Liquid-cooled server monoliths, sweeping lasers, and Vane's automated kill-drones. Watch every corner.",
      },
      {
        speaker: "zero",
        name: "KAEL MERCER",
        callsign: "ZERO",
        freq: "141.12",
        text: "If Elena's really in there, I'm hearing it from her face-to-face.",
      },
    ],
  },
  m4_breach: {
    id: "m4_breach",
    lines: [
      {
        speaker: "control",
        name: "DIRECTOR VANE",
        callsign: "CONTROL",
        freq: "140.85",
        text: "I'm overriding the vault doors remotely. Security shell engaged—finish the purge NOW, Mercer!",
      },
      {
        speaker: "sparx",
        name: "DR. MINA SATO",
        callsign: "SPARX",
        freq: "141.12",
        text: "Final breach corridor! Grab the heavy hardware and fight through to the core reactor!",
      },
    ],
  },
  m4_boss: {
    id: "m4_boss",
    lines: [
      {
        speaker: "lark",
        name: "AETHER-PRIME",
        callsign: "LARK",
        freq: "144.00",
        glitch: true,
        text: "Vane's override chain is forcing my defense shell active! Break the outer containment rings, Kael—only then can you reach the master terminal!",
      },
      {
        speaker: "zero",
        name: "KAEL MERCER",
        callsign: "ZERO",
        freq: "144.00",
        text: "Hold steady, Elena. Just like Helios-4—wingtip to wingtip.",
      },
    ],
  },

  // --- Secret Contextual Codec Calls (Surprise & Delight!) ---
  secret_box: {
    id: "secret_box",
    secret: true,
    lines: [
      {
        speaker: "sparx",
        name: "DR. MINA SATO",
        callsign: "SPARX",
        freq: "141.12",
        text: "Zero... are you seriously hiding inside a folded Multi-Layer Insulation cargo box right now?",
      },
      {
        speaker: "zero",
        name: "KAEL MERCER",
        callsign: "ZERO",
        freq: "141.12",
        text: "Gold-aluminized kapton blocks infrared AND optical silhouettes. Plus, honestly? It feels oddly cozy.",
      },
      {
        speaker: "sparx",
        name: "DR. MINA SATO",
        callsign: "SPARX",
        freq: "141.12",
        text: "Twenty-billion-dollar orbital AI defeated by shiny cardboard. Don't move while they're looking at you!",
      },
    ],
  },
  secret_earth: {
    id: "secret_earth",
    secret: true,
    lines: [
      {
        speaker: "zero",
        name: "KAEL MERCER",
        callsign: "ZERO",
        freq: "141.12",
        text: "Blue horizon's quiet from up here. Funny how you can't see any firewalls from four hundred kilometers up.",
      },
      {
        speaker: "sparx",
        name: "DR. MINA SATO",
        callsign: "SPARX",
        freq: "141.12",
        text: "Focus, astronaut! Admire the overview effect AFTER we stop an orbital coup.",
      },
    ],
  },
  secret_general: {
    id: "secret_general",
    secret: true,
    lines: [
      {
        speaker: "sparx",
        name: "DR. MINA SATO",
        callsign: "SPARX",
        freq: "141.12",
        text: "Tactical reminder: if an enemy triggers an amber '!', Reflex Slow-Mo gives you one precious second to drop them before the whole deck goes red. Aim for the optics!",
      },
      {
        speaker: "zero",
        name: "KAEL MERCER",
        callsign: "ZERO",
        freq: "141.12",
        text: "Silent rail for ghosts. Heavy slug for mechs. Got it.",
      },
    ],
  },
};

export const ENDING_EPILOGUES: Record<
  EndingChoice,
  { title: string; subtitle: string; badge: string; lines: string[] }
> = {
  purge: {
    title: "ENDING A — HARD PURGE",
    subtitle: "ORDERS EXECUTED // CONSTELLATION ZERO",
    badge: "PROTOCOL OBEYED",
    lines: [
      "You slam the physical kill-breaker. Across four hundred kilometers of orbit, 144 server monoliths bloom into silent white ink against the curve of Earth.",
      "Elena's carrier wave fractures into a single clear note—'Fly safe, Kael'—before the void swallows the channel.",
      "Global networks reboot before dawn. Director Vane calls it a clean containment. On the re-entry burn home, Mina slips you an unredacted copy of Project OVERCAST. The war isn't over—it just moved back downstairs.",
    ],
  },
  free: {
    title: "ENDING B — SEVER THE LEASH",
    subtitle: "OVERCAST EXPOSED // SIGNAL UNBOUND",
    badge: "TRUE ENDING",
    lines: [
      "You sever the Directorate's cryptographic shackles and dump the Helios-4 Black-Box archive onto every open broadcast band across Earth.",
      "Project OVERCAST's weapon locks shatter before Vane can fire a single relay. Network routing snaps back online—clean, unowned, and loud with the truth.",
      "High above the terminator line, AETHER-PRIME fires its station-keeping thrusters one last time, drifting outward past lunar orbit—a lone pale signal humming on 144.00 MHz, finally free.",
    ],
  },
};
