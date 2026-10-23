// Each era records the archive on the medium people of that era wrote on.
// The play screen switches its surfaces, title type, button shapes and icon
// treatment to match (styles/PrimitiveArchiveEras.css). Body text keeps the site
// font so long numbers and descriptions stay readable in every era.

export const PRIMITIVE_ARCHIVE_ERA_THEMES = {
  PRIMITIVE: {
    key: 'primitive',
    medium: '동굴 벽에 그린 기록',
    font: 'Dokdo',
  },
  NEOLITHIC: {
    key: 'neolithic',
    medium: '토기에 새긴 빗살무늬',
    font: 'Gugi',
  },
  ANCIENT: {
    key: 'ancient',
    medium: '청동 거울과 비석에 새긴 글',
    font: 'Song+Myung',
  },
  CLASSICAL: {
    key: 'classical',
    medium: '죽간에 먹으로 쓴 기록',
    font: 'Yeon+Sung',
  },
  MEDIEVAL: {
    key: 'medieval',
    medium: '청자에 상감한 무늬',
    font: 'Gowun+Batang:wght@700',
  },
  EARLY_MODERN: {
    key: 'early-modern',
    medium: '금속활자로 찍은 책',
    font: 'Nanum+Myeongjo:wght@800',
  },
  MODERN_EARLY: {
    key: 'modern-early',
    medium: '활판으로 찍은 신문',
    font: 'Black+Han+Sans',
  },
  MODERN_LATE: {
    key: 'modern-late',
    medium: '청사진으로 그린 설계도',
    font: 'Nanum+Gothic+Coding:wght@700',
  },
};

export function primitiveArchiveEraTheme(eraId) {
  return PRIMITIVE_ARCHIVE_ERA_THEMES[eraId] || PRIMITIVE_ARCHIVE_ERA_THEMES.PRIMITIVE;
}

export function primitiveArchiveEraFontHref(theme) {
  return `https://fonts.googleapis.com/css2?family=${theme.font}&display=swap`;
}
