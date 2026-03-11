const ADJECTIVES = [
  'Swift', 'Bold', 'Clever', 'Daring', 'Fierce', 'Grand', 'Lucky', 'Mighty',
  'Noble', 'Proud', 'Royal', 'Savage', 'Silent', 'Storm', 'Thunder', 'Valiant',
  'Wild', 'Blazing', 'Crystal', 'Dark', 'Elder', 'Frozen', 'Golden', 'Hollow',
  'Iron', 'Jade', 'Keen', 'Lunar', 'Mystic', 'Neon', 'Obsidian', 'Phantom'
];

const ANIMALS = [
  'Wolf', 'Eagle', 'Tiger', 'Bear', 'Hawk', 'Lion', 'Shark', 'Viper',
  'Fox', 'Raven', 'Dragon', 'Phoenix', 'Panther', 'Falcon', 'Cobra', 'Jaguar',
  'Lynx', 'Orca', 'Puma', 'Scorpion', 'Stallion', 'Raptor', 'Mantis', 'Rhino',
  'Bison', 'Crane', 'Gecko', 'Hornet', 'Ibex', 'Jackal', 'Krait', 'Leopard'
];

function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function getFancyName(matchId: string, seatIndex: number): string {
  const seed = simpleHash(`${matchId}_seat_${seatIndex}`);
  const adj = ADJECTIVES[(seed) % ADJECTIVES.length];
  const animal = ANIMALS[(seed * 7 + seatIndex * 13) % ANIMALS.length];
  return `${adj} ${animal}`;
}

export function getMatchFancyNames(matchId: string): string[] {
  return [0, 1, 2, 3].map(i => getFancyName(matchId, i));
}
