export type IdentityLang = 'ar' | 'en';

export interface GeneratedIdentity {
  lang: IdentityLang;
  emailUser: string;
  accountName: string;
  password: string;
}

interface ArabNameEntry {
  arFirst: string;
  arSecond: string;
  latinFirst: string;
  latinSecond: string;
  arTitle?: string;
}

const ARAB_FIRST_NAMES: ReadonlyArray<{ ar: string; latin: string }> = [
  { ar: 'أحمد', latin: 'ahmed' },
  { ar: 'محمد', latin: 'mohamed' },
  { ar: 'عمر', latin: 'omar' },
  { ar: 'كريم', latin: 'karim' },
  { ar: 'يوسف', latin: 'youssef' },
  { ar: 'طارق', latin: 'tarek' },
  { ar: 'خالد', latin: 'khaled' },
  { ar: 'مصطفى', latin: 'mostafa' },
  { ar: 'حسام', latin: 'hossam' },
  { ar: 'شريف', latin: 'sherif' },
  { ar: 'ماجد', latin: 'maged' },
  { ar: 'وليد', latin: 'waleed' },
  { ar: 'رامي', latin: 'ramy' },
  { ar: 'تامر', latin: 'tamer' },
  { ar: 'باسل', latin: 'basel' },
  { ar: 'زياد', latin: 'ziad' },
  { ar: 'مروان', latin: 'marwan' },
  { ar: 'آدم', latin: 'adam' },
  { ar: 'سيف', latin: 'saif' },
  { ar: 'ياسر', latin: 'yasser' },
  { ar: 'نادر', latin: 'nader' },
  { ar: 'هاني', latin: 'hany' },
  { ar: 'سامح', latin: 'sameh' },
  { ar: 'فادي', latin: 'fady' },
  { ar: 'عادل', latin: 'adel' },
  { ar: 'عماد', latin: 'emad' },
  { ar: 'أنس', latin: 'anas' },
  { ar: 'مازن', latin: 'mazen' },
  { ar: 'راشد', latin: 'rashed' },
  { ar: 'فيصل', latin: 'faisal' }
];

const ARAB_FAMILY_NAMES: ReadonlyArray<{ ar: string; latin: string }> = [
  { ar: 'المصري', latin: 'masry' },
  { ar: 'الحربي', latin: 'harbi' },
  { ar: 'الشريف', latin: 'sherif' },
  { ar: 'النجار', latin: 'nagar' },
  { ar: 'منصور', latin: 'mansour' },
  { ar: 'سليمان', latin: 'soliman' },
  { ar: 'السيد', latin: 'elsayed' },
  { ar: 'حسن', latin: 'hassan' },
  { ar: 'نبيل', latin: 'nabil' },
  { ar: 'فوزي', latin: 'fawzy' },
  { ar: 'صالح', latin: 'saleh' },
  { ar: 'العربي', latin: 'araby' },
  { ar: 'عثمان', latin: 'othman' },
  { ar: 'رشدي', latin: 'roshdy' },
  { ar: 'جمال', latin: 'gamal' },
  { ar: 'فاروق', latin: 'farouk' },
  { ar: 'جلال', latin: 'galal' },
  { ar: 'كمال', latin: 'kamal' },
  { ar: 'السالم', latin: 'salem' },
  { ar: 'الرشيد', latin: 'rashid' }
];

const ARAB_GAMER_EPITHETS: ReadonlyArray<string> = [
  'الفارس',
  'القائد',
  'صقر الشمال',
  'ذئب الصحراء',
  'النمر',
  'أسد المعركة',
  'أبو عمر',
  'أبو سيف',
  'أبو زياد',
  'أبو خالد',
  'القيصر',
  'الجنرال',
  'سيف الحق',
  'فارس الليل',
  'ملك القارة'
];

const EN_FIRST_NAMES: ReadonlyArray<string> = [
  'Daniel',
  'Lucas',
  'Nathan',
  'Ryan',
  'Ethan',
  'Owen',
  'Marcus',
  'Liam',
  'Noah',
  'Cole',
  'Aaron',
  'Caleb',
  'Dylan',
  'Evan',
  'Gavin',
  'Henry',
  'Isaac',
  'Jack',
  'Kevin',
  'Logan',
  'Mason',
  'Nolan',
  'Oliver',
  'Sam',
  'Tyler',
  'Victor',
  'Wyatt',
  'Zach'
];

const EN_LAST_NAMES: ReadonlyArray<string> = [
  'Brooks',
  'Bennett',
  'Cole',
  'Parker',
  'Miller',
  'Reed',
  'Vane',
  'Hawke',
  'Mercer',
  'Frost',
  'Hart',
  'Ward',
  'Vance',
  'Hayes',
  'Cross',
  'Grant',
  'Stone',
  'Blake',
  'Turner',
  'Foster',
  'Morgan',
  'Cooper',
  'Carter',
  'Hunter'
];

const EN_GAMER_SUFFIXES: ReadonlyArray<string> = [
  'K',
  'M',
  'R',
  'Pro',
  'HD',
  'TW',
  'Lord',
  'Knight'
];

function pick<T>(arr: ReadonlyArray<T>, rng: () => number): T {
  const idx = Math.floor(rng() * arr.length) % arr.length;
  return arr[Math.max(0, idx)];
}

function randInt(min: number, max: number, rng: () => number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

function capitalize(word: string): string {
  if (!word) return '';
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

function buildHumanPassword(rootWord: string, secondaryWord: string, year: number, rng: () => number): string {
  const cleanRoot = capitalize(rootWord.replace(/[^a-zA-Z]/g, '')) || 'Player';
  const cleanSec = capitalize(secondaryWord.replace(/[^a-zA-Z]/g, '')) || 'King';
  const shortYear = String(year).slice(-2);
  const fullYear = String(year);
  const sym = pick(['@', '#', '!', '_', '$'], rng);
  const pattern = randInt(0, 4, rng);

  let raw = '';
  if (pattern === 0) {
    raw = `${cleanRoot}${sym}${fullYear}`;
  } else if (pattern === 1) {
    raw = `${cleanRoot}${shortYear}${sym}${shortYear}`;
  } else if (pattern === 2) {
    raw = `${cleanRoot}_${cleanSec.slice(0, 3)}${shortYear}`;
  } else if (pattern === 3) {
    raw = `${cleanSec}${sym}${fullYear}`;
  } else {
    raw = `${cleanRoot}${fullYear}${sym}`;
  }

  // Guarantee human-readable >= 8 characters
  if (raw.length < 8) {
    raw = `${cleanRoot}${sym}${fullYear}`;
  }
  return raw;
}

function buildSingleIdentity(lang: IdentityLang, rng: () => number): GeneratedIdentity {
  const birthYear = randInt(1988, 2004, rng);
  const shortYr = String(birthYear).slice(-2);
  const sep = pick(['.', '_', ''], rng);

  if (lang === 'ar') {
    const first = pick(ARAB_FIRST_NAMES, rng);
    let second = pick(ARAB_FAMILY_NAMES, rng);
    if (second.latin === first.latin) {
      second = ARAB_FAMILY_NAMES[0];
    }

    const entry: ArabNameEntry = {
      arFirst: first.ar,
      arSecond: second.ar,
      latinFirst: first.latin,
      latinSecond: second.latin
    };

    const emailStyle = randInt(0, 3, rng);
    let emailUser = '';
    if (emailStyle === 0) {
      emailUser = `${entry.latinFirst}${sep}${entry.latinSecond}${shortYr}`;
    } else if (emailStyle === 1) {
      emailUser = `${entry.latinFirst}${sep}${entry.latinSecond}${birthYear}`;
    } else if (emailStyle === 2) {
      emailUser = `${entry.latinFirst}${shortYr}${sep}${entry.latinSecond}`;
    } else {
      emailUser = `${entry.latinFirst}.${entry.latinSecond}${randInt(10, 99, rng)}`;
    }
    emailUser = emailUser.toLowerCase().replace(/@.*/g, '').replace(/[^a-z0-9._]/g, '');

    // Natural human Arabic Tribal Wars account name
    const nameStyle = randInt(0, 3, rng);
    let accountName = '';
    if (nameStyle === 0) {
      accountName = `${entry.arFirst} ${entry.arSecond}`;
    } else if (nameStyle === 1) {
      accountName = `${pick(['الفارس', 'القائد', 'أبو'], rng)} ${entry.arFirst}`;
    } else if (nameStyle === 2) {
      accountName = `${entry.arFirst} ${pick(['النمر', 'الصقر', 'الحربي', 'المصري', 'القائد'], rng)}`;
    } else {
      const ep = pick(ARAB_GAMER_EPITHETS, rng);
      accountName = ep.includes(' ') ? ep : `${ep} ${entry.arFirst}`;
    }

    const password = buildHumanPassword(entry.latinFirst, entry.latinSecond, birthYear, rng);
    return { lang: 'ar', emailUser, accountName, password };
  }

  // English human identity
  const first = pick(EN_FIRST_NAMES, rng);
  let last = pick(EN_LAST_NAMES, rng);
  if (last === first) last = EN_LAST_NAMES[0];

  const emailStyle = randInt(0, 3, rng);
  let emailUser = '';
  if (emailStyle === 0) {
    emailUser = `${first.toLowerCase()}${sep}${last.toLowerCase()}${shortYr}`;
  } else if (emailStyle === 1) {
    emailUser = `${first.toLowerCase()}.${last.toLowerCase()}${birthYear}`;
  } else if (emailStyle === 2) {
    emailUser = `${first.toLowerCase()}_${last.toLowerCase()}`;
  } else {
    emailUser = `${first.toLowerCase().charAt(0)}${last.toLowerCase()}${shortYr}`;
  }
  emailUser = emailUser.replace(/@.*/g, '').replace(/[^a-z0-9._]/g, '');

  const nameStyle = randInt(0, 3, rng);
  let accountName = '';
  if (nameStyle === 0) {
    accountName = `${first}${last}`;
  } else if (nameStyle === 1) {
    accountName = `${first} ${last}`;
  } else if (nameStyle === 2) {
    accountName = `${first}${last.slice(0, 4)}${shortYr}`;
  } else {
    accountName = `${first}${pick(EN_GAMER_SUFFIXES, rng)}`;
  }

  const password = buildHumanPassword(first, last, birthYear, rng);
  return { lang: 'en', emailUser, accountName, password };
}

/**
 * Generates a realistic, human-looking Tribal Wars account identity
 * (email username without '@', natural account name, and name-linked human password)
 * avoiding collisions with any existing account names.
 */
export function generateHumanIdentity(
  lang: IdentityLang = 'ar',
  existingNames: ReadonlyArray<string> = [],
  rng: () => number = Math.random
): GeneratedIdentity {
  const taken = new Set(existingNames.map((n) => n.trim().toLowerCase()).filter(Boolean));
  for (let attempt = 0; attempt < 25; attempt++) {
    const candidate = buildSingleIdentity(lang, rng);
    if (!taken.has(candidate.accountName.trim().toLowerCase())) {
      return candidate;
    }
  }
  const fallback = buildSingleIdentity(lang, rng);
  return {
    ...fallback,
    accountName: `${fallback.accountName} ${randInt(11, 99, rng)}`
  };
}
