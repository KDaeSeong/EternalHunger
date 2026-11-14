import { STUDENT_BY_ID } from './autochessData.js';

// Original vector motifs and synthesized timbres; no additional image or audio downloads.
const SIGILS = {
  cat: 'M8 14L8 5L16 11L24 7L32 11L40 5L40 29L32 39L16 39L8 29ZM17 22L20 22M28 22L31 22M21 30L27 30',
  supply: 'M9 13L24 5L39 13L39 35L24 43L9 35ZM9 13L24 21L39 13M24 21V43M19 29H29M24 24V34',
  cartridges: 'M8 35V16L12 8L16 16V35ZM20 39V12L24 4L28 12V39ZM32 35V16L36 8L40 16V35Z',
  sight: 'M24 3V12M24 36V45M3 24H12M36 24H45M24 10A14 14 0 1 0 24 38A14 14 0 1 0 24 10M20 24H28M24 20V28',
  dawn: 'M6 35A18 18 0 0 1 42 35M4 36H44M24 3V10M7 12L12 17M41 12L36 17M16 35V28L24 21L32 28V35',
  thorns: 'M24 3L36 12L42 26L32 41L24 45L16 41L6 26L12 12ZM12 12L24 29L36 12M6 26L24 29L42 26M24 29V45',
  bombs: 'M7 26A8 8 0 1 0 23 26A8 8 0 1 0 7 26M25 31A8 8 0 1 0 41 31A8 8 0 1 0 25 31M15 18L19 10L23 13M33 23L37 14L41 17M26 3L28 10M34 5L31 11',
  arrows: 'M5 16H31L23 8M31 16L23 24M11 27H42L34 19M42 27L34 35M7 38H29L21 30M29 38L21 46',
  laurels: 'M22 42C6 37 4 17 14 6M12 29L5 22M13 21L8 13M16 14L14 5M26 42C42 37 44 17 34 6M36 29L43 22M35 21L40 13M32 14L34 5M19 23L24 17L29 23L24 29Z',
  wings: 'M24 24L5 8L9 25L20 32L7 29L14 40L24 35L34 40L41 29L28 32L39 25L43 8ZM24 24V44',
  hex: 'M24 3L42 13V35L24 45L6 35V13ZM24 12L34 18V30L24 36L14 30V18ZM14 18L24 25L34 18M24 25V36',
  pixels: 'M5 7H15V17H5ZM23 3H33V13H23ZM33 21H43V31H33ZM17 19H27V29H17ZM5 33H15V43H5ZM25 35H35V45H25Z',
  medic: 'M18 4H30V17H43V29H30V43H18V29H5V17H18ZM10 9H13M35 38H40',
  script: 'M10 5H34V12H40V41H10ZM15 17H34M15 24H29M15 31H25M27 34L33 28L39 34L33 40Z',
  rail: 'M5 14H43M5 34H43M12 7V41M36 7V41M19 24L24 9L29 24L24 39ZM1 24H12M36 24H47',
  petals: 'M24 24C3 5 8 39 24 24C43 3 9 8 24 24C45 43 40 9 24 24C5 45 39 40 24 24M24 35V45',
  ribbon: 'M24 22C5 0 5 29 24 22C43 0 43 29 24 22M24 22L13 43L24 37L35 43ZM18 30H30',
  crystal: 'M24 3L40 15L33 37L24 45L15 37L8 15ZM8 15H40M15 37L24 15L33 37M24 3V15',
  claws: 'M7 4L16 22L11 43M20 3L28 22L23 45M33 5L41 22L35 42',
  halo: 'M24 2L29 17L45 18L32 28L37 44L24 34L11 44L16 28L3 18L19 17ZM8 24A16 10 0 1 0 40 24',
  chains: 'M18 25L12 31A7 7 0 0 0 22 41L29 34M30 23L36 17A7 7 0 0 0 26 7L19 14M16 32L32 16',
  orbit: 'M24 5A19 19 0 1 0 24 43A19 19 0 1 0 24 5M7 34C0 12 35 1 41 15C48 36 13 47 7 34M18 24L24 18L30 24L24 30Z',
  mark: 'M5 15V5H15M33 5H43V15M43 33V43H33M15 43H5V33M24 12L36 24L24 36L12 24ZM24 18V30M18 24H30',
  shells: 'M7 40L13 8L20 4L25 12L21 42ZM25 40L31 8L38 4L43 12L39 42M8 31L22 33M26 31L40 33',
  cut: 'M4 39L34 5L27 25L44 9L14 44L23 24ZM5 11L13 19M35 34L43 42',
  storm: 'M27 2L8 27H23L18 46L41 18H26ZM4 14L11 17M37 35L44 39',
  lightning: 'M30 2L11 22H25L17 46L39 20H26ZM7 7L10 15M39 36L44 44M5 34L12 31',
  dandelion: 'M24 44V20M24 20L11 8M24 20L24 3M24 20L37 8M24 20L43 19M24 20L5 19M24 20L12 31M24 20L36 31M7 5L15 5M20 3H28M33 5H41',
  jade: 'M24 3L36 15L24 27L12 15ZM8 25L18 35L8 45L1 35ZM40 25L47 35L40 45L30 35ZM24 31L31 39L24 47L17 39Z',
  phoenix: 'M24 40C9 33 3 13 5 5L22 21L24 8L26 21L43 5C45 13 39 33 24 40ZM24 22L14 13M24 22L34 13M24 30V45',
  starfall: 'M24 3L29 17L44 18L32 28L37 43L24 34L11 43L16 28L4 18L19 17ZM4 6L12 14M36 34L44 42M5 39L12 32',
  pillars: 'M6 42V17L14 9L22 17V42ZM27 42V9L35 1L43 9V42ZM6 24H22M27 17H43M1 44H47',
};
const ROWS = [
  ['serika','#ff8f87','rounds',3,8,'cat',261,'rifle','붉은 점사'],
  ['ayane','#7af2ba','arc',2,14,'supply',392,'chime','보급 신호'],
  ['nonomi','#ffe180','rounds',5,4,'cartridges',147,'heavy','황금 탄막'],
  ['shiroko','#b0efff','ray',1,2,'sight',330,'rifle','정밀 탄도'],
  ['hoshino','#ffbf83','spread',4,17,'dawn',131,'scatter','부채꼴 산탄'],
  ['haruka','#ff97be','spread',3,23,'thorns',110,'scatter','가시 산탄'],
  ['mutsuki','#ffb568','arc',3,25,'bombs',165,'blast','유탄 곡사'],
  ['iori','#a6bdff','ray',3,9,'arrows',349,'rifle','삼중 관통선'],
  ['ako','#91e4dc','arc',2,18,'laurels',440,'chime','지원 광구'],
  ['hina','#ceafff','spread',5,11,'wings',98,'heavy','보랏빛 제압탄'],
  ['yuuka','#88cfff','rounds',2,12,'hex',294,'laser','육각 탄환'],
  ['momoi','#ffb294','pixels',4,8,'pixels',523,'digital','주황 픽셀탄'],
  ['midori','#99edbc','pixels',3,13,'medic',587,'digital','초록 픽셀탄'],
  ['noa','#c7ebff','ray',2,6,'script',494,'chime','기록 광선'],
  ['aris','#8feaff','ray',1,5,'rail',196,'laser','청색 에너지포'],
  ['hanako','#ffb9dd','arc',3,20,'petals',659,'chime','꽃잎 광구'],
  ['koharu','#ff92cf','arc',1,31,'ribbon',554,'chime','리본 투사체'],
  ['azusa','#eee0ff','ray',2,10,'crystal',370,'rifle','결정 탄도'],
  ['tsurugi','#f698a3','slash',3,27,'claws',123,'blade','붉은 발톱'],
  ['mika','#ffd6f2','gems',4,16,'halo',466,'chime','별빛 파편'],
  ['nte-fadia','#f3a0bb','arc',2,28,'chains',185,'stone','고통의 사슬'],
  ['nte-sakiri','#c9b7ff','arc',3,19,'orbit',415,'digital','제어 고리'],
  ['nte-jiuyuan','#ffab92','ray',1,7,'mark',311,'rifle','표적 직격탄'],
  ['nte-hathor','#ffd184','spread',4,21,'shells',87,'heavy','중화기 탄막'],
  ['nte-daffodil','#99e9ef','slash',2,29,'cut',277,'blade','이상 참격'],
  ['nte-nanally','#d7a8ff','zigzag',4,15,'storm',622,'electric','연쇄 뇌광'],
  ['gi-lisa','#d3a1ff','zigzag',3,22,'lightning',740,'electric','보랏빛 전격'],
  ['gi-jean','#a5f2cd','gust',3,24,'dandelion',698,'wind','민들레 바람'],
  ['gi-ningguang','#ffe69b','gems',3,26,'jade',830,'stone','옥석 파편'],
  ['gi-diluc','#ff9a68','slash',1,34,'phoenix',155,'blast','불꽃 참격'],
  ['gi-keqing','#c3a3ff','zigzag',2,30,'starfall',784,'blade','번개 검흔'],
  ['gi-zhongli','#edc47b','gems',2,32,'pillars',103,'stone','암주 파동'],
];

export const CHARACTER_EFFECTS = Object.freeze(Object.fromEntries(ROWS.map(([id, accent, trail, count, spread, motif, pitch, timbre, attackLabel]) => [id, Object.freeze({
  id, accent, pitch, timbre, attackLabel,
  attack: Object.freeze({ motif, trail, count, spread, sigil: SIGILS[motif], accent, size: 30, glyph: '·' }),
  skill: Object.freeze({ motif, trail, count: Math.min(5, count + 1), spread: spread * 1.35, sigil: SIGILS[motif], accent, size: 64, glyph: ['heal','shield','rally'].includes(STUDENT_BY_ID[id]?.skill) ? '◇' : '✦' }),
})])));

export function characterEffectFor(studentId, kind) {
  const profile = CHARACTER_EFFECTS[studentId] || CHARACTER_EFFECTS.serika;
  if (kind === 'shield' && STUDENT_BY_ID[studentId]?.skill !== 'shield')
    return { ...profile.skill, motif: 'passive-ward', sigil: SIGILS.chains, count: 2, accent: '#b5c9ff', size: 54 };
  return kind === 'attack' ? profile.attack : profile.skill;
}

export function characterTrails(fx) {
  if (!fx.link || !fx.profile) return [];
  const { x1, y1, x2, y2 } = fx.link, dx = x2 - x1, dy = y2 - y1;
  const length = Math.hypot(dx, dy) || 1, nx = -dy / length, ny = dx / length;
  const { trail, count, spread } = fx.profile;
  return Array.from({ length: count }, (_, i) => {
    const offset = (i - (count - 1) / 2) * spread, sx = x1 + nx * offset, sy = y1 + ny * offset;
    const ex = x2 + nx * offset * .2, ey = y2 + ny * offset * .2;
    let d = 'M' + sx + ' ' + sy;
    if (trail === 'arc' || trail === 'gust') {
      const bend = offset + spread * (trail === 'gust' ? 2.4 : 1.5);
      d += 'Q' + ((x1+x2)/2+nx*bend) + ' ' + ((y1+y2)/2+ny*bend) + ' ' + ex + ' ' + ey;
    } else if (trail === 'zigzag') {
      for (let step = 1; step <= 5; step++) {
        const t = step / 5, wobble = step === 5 ? 0 : (step % 2 ? 1 : -1) * spread;
        d += 'L' + (sx+(ex-sx)*t+nx*wobble) + ' ' + (sy+(ey-sy)*t+ny*wobble);
      }
    } else if (trail === 'slash') {
      d += 'Q' + (x2+nx*(spread+offset)) + ' ' + (y1+ny*(spread+offset)) + ' ' + ex + ' ' + ey;
    } else d += 'L' + ex + ' ' + ey;
    return { d, delay: i * .035, dashed: trail === 'rounds' || trail === 'pixels' || trail === 'gems',
      width: trail === 'ray' ? (fx.kind === 'attack' ? 3 : 5) : trail === 'slash' ? 3.5 : 2 };
  });
}
