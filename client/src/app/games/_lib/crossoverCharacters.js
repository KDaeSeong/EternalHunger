export const CHARACTER_ORIGINS = {
  'blue-archive': { name: '블루 아카이브', color: '#5aaabf' },
  nte: { name: '이환', color: '#e59787' },
  genshin: { name: '원신', color: '#bca164' },
};

export const CROSSOVER_CHARACTERS = [
  {
    "id": "nte-nanally",
    "name": "나나리",
    "origin": "nte"
  },
  {
    "id": "nte-sakiri",
    "name": "사키리",
    "origin": "nte"
  },
  {
    "id": "nte-hathor",
    "name": "하토르",
    "origin": "nte"
  },
  {
    "id": "nte-fadia",
    "name": "파디아",
    "origin": "nte"
  },
  {
    "id": "nte-daffodil",
    "name": "다포딜",
    "origin": "nte"
  },
  {
    "id": "nte-jiuyuan",
    "name": "구원",
    "origin": "nte"
  },
  {
    "id": "gi-lisa",
    "name": "리사",
    "origin": "genshin"
  },
  {
    "id": "gi-jean",
    "name": "진",
    "origin": "genshin"
  },
  {
    "id": "gi-diluc",
    "name": "다이루크",
    "origin": "genshin"
  },
  {
    "id": "gi-ningguang",
    "name": "응광",
    "origin": "genshin"
  },
  {
    "id": "gi-keqing",
    "name": "각청",
    "origin": "genshin"
  },
  {
    "id": "gi-zhongli",
    "name": "종려",
    "origin": "genshin"
  }
];
export const CROSSOVER_BY_ID = Object.assign(Object.create(null), Object.fromEntries(CROSSOVER_CHARACTERS.map(character => [character.id, character])));
