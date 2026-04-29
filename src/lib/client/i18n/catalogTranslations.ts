import type { DefenseSpec, WeaponSpec } from '@/lib/client/services/factoryService';
import type { ResearchDef } from '@/lib/client/services/researchService';

const FACTORY_ITEM_TYPE_LABELS = {
  en: {
    weapon: 'Weapon',
    defense: 'Defense',
    projectile: 'Projectile',
    energy: 'Energy',
    weak: 'Weak',
    medium: 'Medium',
    strong: 'Strong',
    iron: 'Iron',
  },
  de: {
    weapon: 'Waffe',
    defense: 'Verteidigung',
    projectile: 'Projektil',
    energy: 'Energie',
    weak: 'Schwach',
    medium: 'Mittel',
    strong: 'Stark',
    iron: 'Eisen',
  },
} as const;

const FACTORY_WEAPON_TEXT_DE: Record<string, { advantage: string; disadvantage: string }> = {
  auto_turret: {
    advantage: 'Guenstig, schnelle Nachladezeit; voller Schaden gegen Schilde',
    disadvantage: 'Reduzierter Schaden gegen kinetische Ruestung',
  },
  pulse_laser: {
    advantage: 'Hohe Genauigkeit; voller Schaden gegen Ruestung',
    disadvantage: 'Reduzierter Schaden gegen Energieschilde; niedriger Grundschaden',
  },
  gauss_rifle: {
    advantage: 'Durchdringt mit hoeherer Projektilforschung zunehmend Schilde; voller Schaden gegen Schilde',
    disadvantage: 'Reduzierter Schaden gegen kinetische Ruestung',
  },
  plasma_lance: {
    advantage: 'Hohe Genauigkeit umgeht einen Teil der Ruestung - je genauer, desto mehr Ruestung wird ignoriert',
    disadvantage: 'Reduzierter Schaden gegen Energieschilde',
  },
  rocket_launcher: {
    advantage: 'Gelenkt; trifft immer, ausser ein ECM-Jammer ist aktiv; voller Schaden gegen Schilde',
    disadvantage: 'Reduzierter Schaden gegen kinetische Ruestung; anfaellig fuer ECM-Jammer',
  },
  photon_torpedo: {
    advantage: 'Hoher Ruestungs- und Rumpfschaden; voller Schaden gegen Ruestung',
    disadvantage: 'Reduzierter Schaden gegen Energieschilde; leicht anfaellig fuer ECM-Jammer',
  },
};

const FACTORY_DEFENSE_TEXT_DE: Record<string, { name: string; description: string }> = {
  ship_hull: {
    name: 'Schiffsrumpf',
    description: 'Die Grundstruktur des Schiffs mit minimalem Schutz gegen alle Schadensarten. Schuetzt den Antrieb mit demselben Wert wie den Rumpf.',
  },
  kinetic_armor: {
    name: 'Kinetische Ruestung',
    description: 'Verstaerkte Panzerung, die Schaden durch physische und projektilbasierte Waffen absorbiert. Ideal gegen Geschuetztuerme, Railguns und Raketen.',
  },
  energy_shield: {
    name: 'Energieschild',
    description: 'Ein schuetzendes Energiefeld, das energiebasierte Angriffe wie Laser und Plasmawaffen absorbiert oder ablenkt. Laedt sich mit der Zeit langsam wieder auf.',
  },
  missile_jammer: {
    name: 'Raketenstoersender',
    description: 'Elektronisches Gegenmassnahmensystem, das gegnerische Zielsysteme stoert. Beeintraechtigt gelenkte Waffen wie Raketen und Torpedos.',
  },
};

const RESEARCH_CATEGORY_LABELS = {
  'projectile-weapons': { en: 'Projectile Weapons', de: 'Projektilwaffen' },
  'energy-weapons': { en: 'Energy Weapons', de: 'Energiewaffen' },
  defense: { en: 'Defense', de: 'Verteidigung' },
  ship: { en: 'Ship', de: 'Schiff' },
  spies: { en: 'Spies', de: 'Spione' },
} as const;

const RESEARCH_TEXT_DE: Record<string, { name: string; description: string; unit?: string }> = {
  IronHarvesting: {
    name: 'Eisenabbau',
    description: 'Bestimmt, wie viel Eisen pro Sekunde gesammelt wird.',
    unit: 'Eisen/Sek.',
  },
  shipSpeed: {
    name: 'Schiffsgeschwindigkeit',
    description: 'Bestimmt, wie schnell sich dein Schiff bewegt.',
    unit: 'Einheiten',
  },
  Afterburner: {
    name: 'Nachbrenner',
    description: 'Veralteter Nachbrenner-Forschungseintrag fuer Rueckwaertskompatibilitaet.',
    unit: '%',
  },
  projectileDamage: {
    name: 'Projektilschaden',
    description: 'Erhoeht den Schadensausstoss von Projektilwaffen.',
    unit: 'Schaden',
  },
  projectileReloadRate: {
    name: 'Projektil-Nachladerate',
    description: 'Verringert die Nachladezeit von Projektilwaffen.',
    unit: '%',
  },
  projectileAccuracy: {
    name: 'Projektilgenauigkeit',
    description: 'Verbessert die Genauigkeit von Projektilwaffen.',
    unit: '%',
  },
  projectileWeaponTier: {
    name: 'Projektilwaffen-Stufe',
    description: 'Schaltet hoehere Projektilwaffen-Stufen frei.',
    unit: 'Stufe',
  },
  energyDamage: {
    name: 'Energieschaden',
    description: 'Erhoeht den Schadensausstoss von Energiewaffen.',
    unit: 'Schaden',
  },
  energyRechargeRate: {
    name: 'Energie-Nachladerate',
    description: 'Erhoeht die Aufladerate von Energiewaffen.',
    unit: '%',
  },
  energyAccuracy: {
    name: 'Energiegenauigkeit',
    description: 'Verbessert die Genauigkeit von Energiewaffen.',
    unit: '%',
  },
  energyWeaponTier: {
    name: 'Energiewaffen-Stufe',
    description: 'Schaltet hoehere Energiewaffen-Stufen frei.',
    unit: 'Stufe',
  },
  hullStrength: {
    name: 'Rumpfstaerke',
    description: 'Erhoeht die Rumpfstaerke deines Schiffs fuer jede installierte Rumpfplatte.',
    unit: '%',
  },
  repairSpeed: {
    name: 'Reparaturgeschwindigkeit',
    description: 'Erhoeht die Reparaturgeschwindigkeit fuer Rumpf, Ruestung und Antrieb. Reparaturen finden nicht waehrend des Kampfes statt.',
    unit: 'HP/Sek.',
  },
  armorEffectiveness: {
    name: 'Ruestungseffektivitaet',
    description: 'Erhoeht den zusaetzlichen Ruestungswert pro Ruestungsplatte.',
    unit: '%',
  },
  shieldEffectiveness: {
    name: 'Schildeffektivitaet',
    description: 'Erhoeht den zusaetzlichen Schildwert pro installiertem Schild.',
    unit: '%',
  },
  shieldRechargeRate: {
    name: 'Schild-Aufladerate',
    description: 'Erhoeht die Schildregeneration. Schilde regenerieren pro Sekunde und auch waehrend des Kampfes.',
    unit: 'HP/Sek.',
  },
  afterburnerSpeedIncrease: {
    name: 'Nachbrenner-Geschwindigkeit',
    description: 'Erhoeht den Geschwindigkeitsbonus, solange der Nachbrenner aktiv ist.',
    unit: '%',
  },
  afterburnerDuration: {
    name: 'Nachbrenner-Dauer',
    description: 'Schaltet den Nachbrenner frei, erhoeht seine Brenndauer bei vollem Treibstoff und ermoeglicht die Aktivierung ab mindestens 33 % Treibstoff.',
    unit: 'Sekunden',
  },
  afterburnerCooldown: {
    name: 'Nachbrenner-Abklingzeit',
    description: 'Beschleunigt die Aufladung des Nachbrenner-Treibstoffs, waehrend der Nachbrenner deaktiviert ist.',
    unit: 'Sekunden',
  },
  teleport: {
    name: 'Teleport',
    description: 'Schaltet Teleport frei und fuegt pro Stufe eine Ladung hinzu. Die Ladungskosten skalieren mit der Sprungdistanz.',
    unit: 'Ladungen',
  },
  teleportRechargeSpeed: {
    name: 'Teleport-Aufladegeschwindigkeit',
    description: 'Verringert die Aufladezeit einer Teleport-Ladung pro Stufe um 10 %.',
    unit: 'Sekunden',
  },
  ironCapacity: {
    name: 'Eisenkapazitaet',
    description: 'Erhoeht die Eisenlagerkapazitaet.',
    unit: 'Eisen',
  },
  inventorySlots: {
    name: 'Inventarplaetze',
    description: 'Erhoeht die Anzahl verfuegbarer Inventarplaetze (+8 pro Stufe).',
    unit: 'Plaetze',
  },
  bridgeSlots: {
    name: 'Brueckenplaetze',
    description: 'Schaltet Bruecken-Crewplaetze frei und erhoeht sie (+4 pro Stufe). Kommandeure koennen der Bruecke zugewiesen werden.',
    unit: 'Plaetze',
  },
  constructionSpeed: {
    name: 'Baugeschwindigkeit',
    description: 'Verringert die Bauzeit fuer Gebaeude und Schiffe.',
    unit: '%',
  },
  artificialIntelligence: {
    name: 'Kuenstliche Intelligenz',
    description: 'Reduziert die benoetigte Zeit fuer Forschungen.',
    unit: '%',
  },
  spyChance: {
    name: 'Spionagechance',
    description: 'Erhoeht die Chance auf erfolgreiche Spionagemissionen.',
    unit: '%',
  },
  spySpeed: {
    name: 'Spionagegeschwindigkeit',
    description: 'Verringert die benoetigte Zeit fuer Spionagemissionen.',
    unit: 'Sekunden',
  },
  spySabotageDamage: {
    name: 'Sabotageschaden',
    description: 'Erhoeht den durch Sabotagemissionen verursachten Schaden.',
    unit: 'Schaden',
  },
  counterintelligence: {
    name: 'Gegenspionage',
    description: 'Verringert die Erfolgschance feindlicher Spione.',
    unit: '%',
  },
  stealIron: {
    name: 'Eisen stehlen',
    description: 'Erhoeht die von Spionen gestohlene Eisenmenge.',
    unit: 'Eisen',
  },
};

function isGerman(locale: string): boolean {
  return locale.toLowerCase().startsWith('de');
}

export function formatIronCost(amount: number, locale: string): string {
  const language = isGerman(locale) ? FACTORY_ITEM_TYPE_LABELS.de : FACTORY_ITEM_TYPE_LABELS.en;
  return `${amount.toLocaleString(locale)} ${language.iron}`;
}

export function localizeFactoryItemType(itemType: 'weapon' | 'defense', locale: string): string {
  const language = isGerman(locale) ? FACTORY_ITEM_TYPE_LABELS.de : FACTORY_ITEM_TYPE_LABELS.en;
  return language[itemType];
}

export function localizeFactorySubtype(subtype: WeaponSpec['subtype'], locale: string): string {
  const language = isGerman(locale) ? FACTORY_ITEM_TYPE_LABELS.de : FACTORY_ITEM_TYPE_LABELS.en;
  return subtype === 'Projectile' ? language.projectile : language.energy;
}

export function localizeFactoryStrength(strength: WeaponSpec['strength'], locale: string): string {
  const language = isGerman(locale) ? FACTORY_ITEM_TYPE_LABELS.de : FACTORY_ITEM_TYPE_LABELS.en;

  switch (strength) {
    case 'Weak':
      return language.weak;
    case 'Medium':
      return language.medium;
    case 'Strong':
      return language.strong;
    default:
      return strength;
  }
}

export function localizeFactoryWeapon(key: string, weapon: WeaponSpec, locale: string): WeaponSpec {
  if (!isGerman(locale)) {
    return weapon;
  }

  const translation = FACTORY_WEAPON_TEXT_DE[key];
  if (!translation) {
    return weapon;
  }

  return {
    ...weapon,
    advantage: translation.advantage,
    disadvantage: translation.disadvantage,
  };
}

export function localizeFactoryDefense(key: string, defense: DefenseSpec, locale: string): DefenseSpec {
  if (!isGerman(locale)) {
    return defense;
  }

  const translation = FACTORY_DEFENSE_TEXT_DE[key];
  if (!translation) {
    return defense;
  }

  return {
    ...defense,
    name: translation.name,
    description: translation.description,
  };
}

export function localizeResearchCategory(categoryId: string, locale: string): string {
  const translation = RESEARCH_CATEGORY_LABELS[categoryId as keyof typeof RESEARCH_CATEGORY_LABELS];
  if (!translation) {
    return categoryId;
  }

  return isGerman(locale) ? translation.de : translation.en;
}

export function localizeResearchDefinition(research: ResearchDef, locale: string): ResearchDef {
  if (!isGerman(locale)) {
    return research;
  }

  const translation = RESEARCH_TEXT_DE[research.type];
  if (!translation) {
    return research;
  }

  return {
    ...research,
    name: translation.name,
    description: translation.description,
    unit: translation.unit ?? research.unit,
  };
}