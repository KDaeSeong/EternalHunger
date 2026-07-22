function renderedTrack(folder, file, options = {}) {
  return Object.freeze({
    src: `/audio/${folder}/${file}.wav`,
    gain: 1.2,
    loop: true,
    loopStartSeconds: 0.85,
    renderer: 'physical-model-v1',
    ...options,
  });
}

const eternalHungerTrack = (file, options = {}) => renderedTrack('eternal-hunger', file, {
  renderer: 'physical-model-v2-orchestra',
  ...options,
});
const primitiveArchiveTrack = (file, options) => renderedTrack('primitive-archive', file, options);
const baVanguardTrack = (file, options = {}) => renderedTrack('ba-vanguard', file, {
  renderer: 'physical-model-v2-orchestra',
  ...options,
});
const baSrpgTrack = (file, options = {}) => renderedTrack('ba-srpg', file, {
  renderer: 'physical-model-v2-orchestra',
  ...options,
});
const dualAcademyTrack = (file, options = {}) => renderedTrack('dual-academy-tcg', file, {
  renderer: 'physical-model-v2-orchestra',
  ...options,
});
const tonkatsuTeacherTrack = (file, options = {}) => renderedTrack('tonkatsu-teacher', file, {
  renderer: 'physical-model-v2-orchestra',
  ...options,
});
const schaleIdleTrack = (file, options = {}) => renderedTrack('schale-idle-rpg', file, {
  renderer: 'physical-model-v2-orchestra',
  ...options,
});
const schoolSimulatorTrack = (file, options = {}) => renderedTrack('school-simulator', file, {
  renderer: 'physical-model-v2-orchestra',
  ...options,
});
const siCodingTrack = (file, options = {}) => renderedTrack('si-coding-sim', file, {
  renderer: 'physical-model-v2-orchestra',
  ...options,
});
const companyReportTrack = (file, options = {}) => renderedTrack('company-report', file, {
  renderer: 'physical-model-v2-orchestra',
  ...options,
});

export const GAME_BGM_RENDERED_TRACKS = Object.freeze({
  'eternal-ready': eternalHungerTrack('ready', { gain: 1.16 }),
  'eternal-day': eternalHungerTrack('day', { gain: 1.22 }),
  'eternal-night': eternalHungerTrack('night', { gain: 1.24 }),
  'eternal-combat': eternalHungerTrack('combat', { gain: 1.18 }),
  'eternal-rift': eternalHungerTrack('rift', { gain: 1.2 }),
  'eternal-boss': eternalHungerTrack('boss', { gain: 1.14 }),
  'eternal-final': eternalHungerTrack('final', { gain: 1.16 }),
  'eternal-result': eternalHungerTrack('result', { gain: 1.2 }),
  'eternal-defeat': eternalHungerTrack('defeat', { gain: 1.2 }),
  'archive-survival': primitiveArchiveTrack('survival', { gain: 1.22 }),
  'archive-frontier': primitiveArchiveTrack('frontier', { gain: 1.2 }),
  'archive-insight': primitiveArchiveTrack('insight', { gain: 1.2 }),
  'archive-settlement': primitiveArchiveTrack('settlement', { gain: 1.22 }),
  'archive-crisis': primitiveArchiveTrack('crisis', { gain: 1.16 }),
  'archive-era': primitiveArchiveTrack('era', { gain: 1.18 }),
  'archive-legacy': primitiveArchiveTrack('legacy', { gain: 1.2 }),
  'vanguard-ready': baVanguardTrack('ready', { gain: 1.18 }),
  'vanguard-ride': baVanguardTrack('ride', { gain: 1.2 }),
  'vanguard-battle': baVanguardTrack('battle', { gain: 1.16 }),
  'vanguard-guard': baVanguardTrack('guard', { gain: 1.18 }),
  'vanguard-trigger': baVanguardTrack('trigger', { gain: 1.16 }),
  'vanguard-victory': baVanguardTrack('victory', { gain: 1.2 }),
  'vanguard-defeat': baVanguardTrack('defeat', { gain: 1.2 }),
  'srpg-command': baSrpgTrack('command', { gain: 1.18 }),
  'srpg-deployment': baSrpgTrack('deployment', { gain: 1.2 }),
  'srpg-town': baSrpgTrack('town', { gain: 1.2 }),
  'srpg-battle': baSrpgTrack('battle', { gain: 1.16 }),
  'srpg-crisis': baSrpgTrack('crisis', { gain: 1.14 }),
  'srpg-victory': baSrpgTrack('victory', { gain: 1.2 }),
  'srpg-defeat': baSrpgTrack('defeat', { gain: 1.2 }),
  'academy-ready': dualAcademyTrack('ready', { gain: 1.18 }),
  'academy-main': dualAcademyTrack('main', { gain: 1.2 }),
  'academy-battle': dualAcademyTrack('battle', { gain: 1.16 }),
  'academy-chain': dualAcademyTrack('chain', { gain: 1.18 }),
  'academy-danger': dualAcademyTrack('danger', { gain: 1.14 }),
  'academy-mika': dualAcademyTrack('mika', { gain: 1.18 }),
  'academy-hina': dualAcademyTrack('hina', { gain: 1.16 }),
  'academy-yuuka': dualAcademyTrack('yuuka', { gain: 1.2 }),
  'academy-victory': dualAcademyTrack('victory', { gain: 1.2 }),
  'academy-defeat': dualAcademyTrack('defeat', { gain: 1.2 }),
  'tonkatsu-opening': tonkatsuTeacherTrack('opening', { gain: 1.2 }),
  'tonkatsu-kitchen': tonkatsuTeacherTrack('kitchen', { gain: 1.2 }),
  'tonkatsu-service': tonkatsuTeacherTrack('service', { gain: 1.2 }),
  'tonkatsu-growth': tonkatsuTeacherTrack('growth', { gain: 1.2 }),
  'tonkatsu-contest': tonkatsuTeacherTrack('contest', { gain: 1.16 }),
  'tonkatsu-judge': tonkatsuTeacherTrack('judge', { gain: 1.18 }),
  'tonkatsu-celebration': tonkatsuTeacherTrack('celebration', { gain: 1.2 }),
  'tonkatsu-setback': tonkatsuTeacherTrack('setback', { gain: 1.2 }),
  'idle-briefing': schaleIdleTrack('briefing', { gain: 1.2 }),
  'idle-patrol': schaleIdleTrack('patrol', { gain: 1.2 }),
  'idle-workshop': schaleIdleTrack('workshop', { gain: 1.2 }),
  'idle-tower': schaleIdleTrack('tower', { gain: 1.14 }),
  'idle-breakthrough': schaleIdleTrack('breakthrough', { gain: 1.18 }),
  'idle-reward': schaleIdleTrack('reward', { gain: 1.2 }),
  'idle-setback': schaleIdleTrack('setback', { gain: 1.18 }),
  'school-morning': schoolSimulatorTrack('morning', { gain: 1.2 }),
  'school-classroom': schoolSimulatorTrack('classroom', { gain: 1.2 }),
  'school-counseling-room': schoolSimulatorTrack('counseling', { gain: 1.22 }),
  'school-campus': schoolSimulatorTrack('campus', { gain: 1.2 }),
  'school-festival': schoolSimulatorTrack('festival', { gain: 1.16 }),
  'school-incident-alert': schoolSimulatorTrack('incident', { gain: 1.14 }),
  'school-semester-finale': schoolSimulatorTrack('semester', { gain: 1.2 }),
  'school-afterschool': schoolSimulatorTrack('afterschool', { gain: 1.22 }),
  'coding-focus': siCodingTrack('focus', { gain: 1.2 }),
  'coding-docs': siCodingTrack('docs', { gain: 1.22 }),
  'coding-execution': siCodingTrack('execution', { gain: 1.18 }),
  'coding-audit': siCodingTrack('audit', { gain: 1.2 }),
  'coding-risk': siCodingTrack('risk', { gain: 1.14 }),
  'coding-success': siCodingTrack('success', { gain: 1.2 }),
  'coding-delivery': siCodingTrack('delivery', { gain: 1.18 }),
  'company-board': companyReportTrack('board', { gain: 1.2 }),
  'company-trade': companyReportTrack('trade', { gain: 1.2 }),
  'company-closing': companyReportTrack('closing', { gain: 1.22 }),
  'company-global': companyReportTrack('global', { gain: 1.18 }),
  'company-capital': companyReportTrack('capital', { gain: 1.16 }),
  'company-audit': companyReportTrack('audit', { gain: 1.22 }),
  'company-crisis': companyReportTrack('crisis', { gain: 1.14 }),
});

export function gameBgmRenderedTrack(theme) {
  return GAME_BGM_RENDERED_TRACKS[String(theme || '').trim().toLowerCase()] || null;
}
