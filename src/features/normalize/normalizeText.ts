interface NormalizationRule {
  pattern: RegExp;
  replacement: string;
}

const normalizationRules: NormalizationRule[] = [
  { pattern: /사레레|사례를|사레/g, replacement: '사이드 레터럴 레이즈' },
  { pattern: /데드\s*버그|데드북/g, replacement: '데드버그' },
  { pattern: /천국의\s*계단/g, replacement: '스텝밀' },
  { pattern: /랫\s*풀다운|랫풀/g, replacement: '랫풀다운' },
  { pattern: /푸쉬업|팔굽혀/g, replacement: '푸시업' },
  { pattern: /플랭크/g, replacement: '플랭크' },
  { pattern: /사이드\s*플랭크|사플/g, replacement: '사이드플랭크' },
  { pattern: /카프(\s*레이즈)?/g, replacement: '카프레이즈' },
  { pattern: /로우|로잉/g, replacement: '로우' },
  { pattern: /런닝|러닝/g, replacement: '러닝' },
];

export const normalizeText = (text: string): string => {
  let normalized = text.trim();

  for (const rule of normalizationRules) {
    normalized = normalized.replace(rule.pattern, rule.replacement);
  }

  return normalized;
};

export const getKnownExercises = (): string[] => {
  return [
    '사이드 레터럴 레이즈',
    '데드버그',
    '스텝밀',
    '랫풀다운',
    '푸시업',
    '플랭크',
    '사이드플랭크',
    '카프레이즈',
    '로우',
    '러닝',
    '벤치프레스',
    '스쿼트',
    '데드리프트',
    '풀업',
    '친업',
    '덤벨컬',
    '트라이셉스',
    '레그프레스',
    '레그컬',
    '레그익스텐션',
    '숄더프레스',
    '버피',
    '마운틴클라이머',
    '점핑잭',
  ];
};
