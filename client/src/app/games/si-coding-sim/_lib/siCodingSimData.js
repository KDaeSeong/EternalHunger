import taskPackStepU from '../_data/task-pack-stepU.json';
import taskPackStepV from '../_data/task-pack-stepV.json';
import taskPackStepW from '../_data/task-pack-stepW.json';
import taskPackStepX from '../_data/task-pack-stepX.json';
import taskPackStepY from '../_data/task-pack-stepY.json';
import taskPackStepZ from '../_data/task-pack-stepZ.json';
import taskPackStepAAAB from '../_data/task-pack-stepAA_AB.json';
import taskPackStepACAD from '../_data/task-pack-stepAC_AD.json';
import taskPackStepAEAF from '../_data/task-pack-stepAE_AF.json';
import taskPackStepAGAH from '../_data/task-pack-stepAG_AH.json';
import taskPackStepAIAJ from '../_data/task-pack-stepAI_AJ.json';
import taskPackStepAKAL from '../_data/task-pack-stepAK_AL.json';
import taskPackStepAMAN from '../_data/task-pack-stepAM_AN.json';
import taskPackStepAOAP from '../_data/task-pack-stepAO_AP.json';
import taskPack from '../_data/task-pack-stepAQ_AR.json';
import judgeRules from '../_data/judge-rules.json';

export const GAME_SLUG = 'si-coding-sim';
export const QUICK_SAVE_SLOT = 'si-coding-sim-main';
export const SAVE_VERSION = 'si-coding-sim-v1';

export const DEFAULT_TASK_PACK_ID = 'stepAQ_AR';

export const TASK_PACKS = [
  { id: 'stepU', label: 'Step U', pack: taskPackStepU },
  { id: 'stepV', label: 'Step V', pack: taskPackStepV },
  { id: 'stepW', label: 'Step W', pack: taskPackStepW },
  { id: 'stepX', label: 'Step X', pack: taskPackStepX },
  { id: 'stepY', label: 'Step Y', pack: taskPackStepY },
  { id: 'stepZ', label: 'Step Z', pack: taskPackStepZ },
  { id: 'stepAA_AB', label: 'Step AA/AB', pack: taskPackStepAAAB },
  { id: 'stepAC_AD', label: 'Step AC/AD', pack: taskPackStepACAD },
  { id: 'stepAE_AF', label: 'Step AE/AF', pack: taskPackStepAEAF },
  { id: 'stepAG_AH', label: 'Step AG/AH', pack: taskPackStepAGAH },
  { id: 'stepAI_AJ', label: 'Step AI/AJ', pack: taskPackStepAIAJ },
  { id: 'stepAK_AL', label: 'Step AK/AL', pack: taskPackStepAKAL },
  { id: 'stepAM_AN', label: 'Step AM/AN', pack: taskPackStepAMAN },
  { id: 'stepAO_AP', label: 'Step AO/AP', pack: taskPackStepAOAP },
  { id: DEFAULT_TASK_PACK_ID, label: 'Step AQ/AR', pack: taskPack },
].map((entry) => ({
  ...entry,
  title: entry.pack?.meta?.title || `SI Coding Sim Prototype ${entry.label}`,
  summary: `${entry.label} task pack`,
  version: entry.pack?.meta?.version || '',
  tasks: Array.isArray(entry.pack?.tasks) ? entry.pack.tasks : [],
  rewardScore: Number(entry.pack?.meta?.contractRewardScore || 0),
}));

export const DEFAULT_TASK_PACK = TASK_PACKS.find((entry) => entry.id === DEFAULT_TASK_PACK_ID) || TASK_PACKS[TASK_PACKS.length - 1];

export const TASKS = DEFAULT_TASK_PACK.tasks;

export function taskPackById(packId) {
  const key = String(packId || '').trim();
  return TASK_PACKS.find((entry) => entry.id === key) || DEFAULT_TASK_PACK;
}

export const BASE_RESOURCES = {
  stamina: 100,
  mentality: 100,
  clientTrust: 50,
  techDebt: 25,
};

export const DIFFICULTY_WEIGHT = {
  Easy: 1,
  Normal: 1.25,
  Hard: 1.6,
};

export const SUPPORT_ACTIONS = judgeRules.companySupport?.actions || {};

export const SUPPORT_ACTION_LABELS = {
  hint: {
    title: '사내 지식베이스 매칭',
    detail: '힌트 비용 1회를 예비비로 보전합니다.',
  },
  risk: {
    title: 'QA 지원 인력 투입',
    detail: '제출 후 열린 리스크 1단계를 줄이고 자원 정산을 되돌립니다.',
  },
};

export const CORE_STAT_DEFS = [
  { key: 'analysis', label: '분석력', summary: '요구사항과 관련 파일의 우선순위를 더 빨리 좁힙니다.' },
  { key: 'implementation', label: '구현력', summary: '과제 해결 안정성과 제출 보상을 높입니다.' },
  { key: 'debugging', label: '디버깅', summary: '실패 원인과 위험 지점을 더 잘 짚습니다.' },
  { key: 'refactoring', label: '정리력', summary: '기술부채 증가를 줄이고 재작업 위험을 낮춥니다.' },
  { key: 'testing', label: '테스트 감각', summary: '테스트 관점과 완전 통과 보상을 강화합니다.' },
  { key: 'communication', label: '문서화', summary: '보고 부담을 줄이고 고객 신뢰 손실을 완화합니다.' },
  { key: 'focus', label: '집중력', summary: '긴급 과제와 힌트 사용 부담을 줄입니다.' },
];

export const DOMAIN_SKILL_DEFS = [
  { key: 'backend', label: '백엔드' },
  { key: 'database', label: 'DB' },
  { key: 'legacy', label: '레거시' },
  { key: 'algorithm', label: '알고리즘' },
];

export const TRAIT_DEFS = {
  requirementDetective: {
    label: '요구사항 탐정',
    description: '문서 체크와 추천 파일 힌트가 더 선명해집니다.',
  },
  hawkEye: {
    label: '매의 눈',
    description: '실패한 파일과 조건을 더 쉽게 추적합니다.',
  },
  testMind: {
    label: '테스트 마인드',
    description: '완전 통과 과제에서 성장과 신뢰 보상이 좋아집니다.',
  },
  legacyArchaeologist: {
    label: '레거시 고고학자',
    description: '레거시/참고 파일이 있는 과제에서 시작 판단이 좋아집니다.',
  },
  hotfixConstitution: {
    label: '핫픽스 체질',
    description: '긴급 수정 과제의 피로와 리스크 부담을 줄입니다.',
  },
  codeSmellHunter: {
    label: '코드 스멜 추적자',
    description: '좋은 제출 이후 기술부채 증가를 조금 더 억제합니다.',
  },
};

export const PROJECT_SEED_GROUPS = [
  {
    id: 'recovery',
    label: '복구/핫픽스',
    templates: [
      {
        id: 'SEED-REC-001',
        title: '운영장애 야간 핫픽스',
        client: 'Haneul Steel',
        projectName: 'Legacy Login Recovery Sprint',
        module: '로그인/권한',
        modeLabel: '백엔드+프론트 패치',
        difficulty: 'Hard',
        durationWeeks: 1,
        summary: '배포 직후 장애가 난 로그인/세션 구간을 긴급 수습하는 단기 재투입입니다.',
        primaryDocs: ['장애 원인보고서', '긴급 배포 계획서', '운영 체크리스트'],
        seedDelta: { stamina: -8, mentality: -6, clientTrust: -2, techDebt: 5 },
        riskBias: 'high',
        tags: ['핫픽스', '야간배포', '운영장애'],
      },
      {
        id: 'SEED-REC-002',
        title: '배치 실패 재처리 투입',
        client: 'Cheongram Retail',
        projectName: 'Settlement Batch Rescue',
        module: '정산 배치/모니터링',
        modeLabel: 'SQL+배치 패치',
        difficulty: 'Hard',
        durationWeeks: 2,
        summary: '배치 누락과 재처리를 동시에 잡아야 하는 안정화 중심 재투입입니다.',
        primaryDocs: ['배치 장애보고서', '재처리 절차서', '검증 결과서'],
        seedDelta: { stamina: -7, mentality: -5, clientTrust: -1, techDebt: 4 },
        riskBias: 'high',
        tags: ['배치', '재처리', '장애수습'],
      },
    ],
  },
  {
    id: 'warranty',
    label: '하자보수/안정화',
    templates: [
      {
        id: 'SEED-WAR-001',
        title: 'QA 반려 잔건 정리',
        client: 'Kivotos Academy Office',
        projectName: 'Notice QA Stabilization',
        module: '공지/첨부 팝업',
        modeLabel: '프론트+문서 대응',
        difficulty: 'Normal',
        durationWeeks: 2,
        summary: '남은 QA 반려와 증적 미비를 정리해 납품 후폭풍을 줄이는 안정화 현장입니다.',
        primaryDocs: ['QA 재검수표', '테스트 증적서', '주간보고'],
        seedDelta: { stamina: -5, mentality: -3, clientTrust: 1, techDebt: 2 },
        riskBias: 'mid',
        tags: ['QA', '증적', '안정화'],
      },
      {
        id: 'SEED-WAR-002',
        title: '운영 문의 집중 대응',
        client: 'Haneul Steel',
        projectName: 'Helpdesk Warranty Extension',
        module: '문의 대응/수정 패치',
        modeLabel: '운영지원',
        difficulty: 'Normal',
        durationWeeks: 3,
        summary: '크리티컬 이슈는 줄었지만 잔여 문의가 많아 매뉴얼과 소규모 패치를 병행합니다.',
        primaryDocs: ['문의 대응 로그', '수정 이력서', '운영 매뉴얼'],
        seedDelta: { stamina: -4, mentality: -2, clientTrust: 2, techDebt: 1 },
        riskBias: 'mid',
        tags: ['운영지원', '문의대응', '매뉴얼'],
      },
    ],
  },
  {
    id: 'maintenance',
    label: '유지보수/운영지원',
    templates: [
      {
        id: 'SEED-MNT-001',
        title: '월간 유지보수 전환',
        client: 'Cheongram Retail',
        projectName: 'Partner Admin Maintenance Window',
        module: '거래처 관리/권한',
        modeLabel: 'SQL+관리화면 개선',
        difficulty: 'Normal',
        durationWeeks: 4,
        summary: '질문 대응과 소규모 개선이 혼합된 전형적인 유지보수 현장입니다.',
        primaryDocs: ['월간 점검 보고서', '개선 요청 목록', '릴리즈 노트'],
        seedDelta: { stamina: -3, mentality: -1, clientTrust: 3, techDebt: 1 },
        riskBias: 'low',
        tags: ['유지보수', '월간점검', '소규모개선'],
      },
      {
        id: 'SEED-MNT-002',
        title: '정기점검+소규모 개선',
        client: 'Kivotos Academy Office',
        projectName: 'Notice Operations Support',
        module: '공지/배너/통계',
        modeLabel: '백엔드+리포트',
        difficulty: 'Normal',
        durationWeeks: 4,
        summary: '치명 장애는 적지만 운영 편의성 개선 요청이 꾸준히 들어오는 관리형 현장입니다.',
        primaryDocs: ['정기점검표', '고객 요청서', '릴리즈 확인서'],
        seedDelta: { stamina: -2, mentality: -1, clientTrust: 4, techDebt: 0 },
        riskBias: 'low',
        tags: ['운영지원', '정기점검', '리포트'],
      },
    ],
  },
  {
    id: 'upgrade',
    label: '고도화/추가개발',
    templates: [
      {
        id: 'SEED-UPG-001',
        title: '추가 화면 고도화',
        client: 'Cheongram Retail',
        projectName: 'Partner Workflow Upgrade',
        module: '거래처 승인/검색 고도화',
        modeLabel: '프론트+백엔드 기능추가',
        difficulty: 'Hard',
        durationWeeks: 6,
        summary: '기존 현장을 기반으로 신규 화면과 조회 조건이 늘어나는 전형적 고도화 프로젝트입니다.',
        primaryDocs: ['요구사항 정의서', '상세설계서', '통합 테스트 시나리오'],
        seedDelta: { stamina: -5, mentality: -2, clientTrust: 6, techDebt: 1 },
        riskBias: 'mid',
        tags: ['고도화', '신규화면', '요구사항확장'],
      },
      {
        id: 'SEED-UPG-002',
        title: '배치/성능 개선 2차',
        client: 'Haneul Steel',
        projectName: 'Groupware Performance Upgrade',
        module: '배치/검색 성능',
        modeLabel: 'SQL 튜닝+백엔드 개선',
        difficulty: 'Hard',
        durationWeeks: 5,
        summary: '기존 안정화가 끝난 뒤 성능과 편의성을 함께 끌어올리는 2차 개선 현장입니다.',
        primaryDocs: ['성능 분석서', '튜닝 결과서', '배포 계획서'],
        seedDelta: { stamina: -4, mentality: -2, clientTrust: 5, techDebt: -1 },
        riskBias: 'mid',
        tags: ['성능개선', 'SQL튜닝', '2차개선'],
      },
    ],
  },
  {
    id: 'strategic',
    label: '확장수주/리드투입',
    templates: [
      {
        id: 'SEED-STR-001',
        title: '계열사 표준안 확산',
        client: 'Kivotos Group',
        projectName: 'Shared Portal Standard Rollout',
        module: '표준 공지/첨부/권한',
        modeLabel: '리드+표준화 설계',
        difficulty: 'Hard',
        durationWeeks: 8,
        summary: '기존 성공 사례를 들고 다른 조직에 표준안을 이식하는 확장 수주형 프로젝트입니다.',
        primaryDocs: ['차기 제안서', '표준 설계서', '온보딩 가이드'],
        seedDelta: { stamina: -4, mentality: -1, clientTrust: 8, techDebt: -2 },
        riskBias: 'mid',
        tags: ['확장수주', '표준화', '리드투입'],
      },
      {
        id: 'SEED-STR-002',
        title: '신규 고객사 PoC 제안',
        client: 'Blue Archive Media',
        projectName: 'Content Admin Pilot',
        module: '콘텐츠 관리/다운로드',
        modeLabel: '제안+PoC 개발',
        difficulty: 'Hard',
        durationWeeks: 7,
        summary: '이번 현장 성과를 레퍼런스로 삼아 신규 고객사를 따내는 파일럿 프로젝트입니다.',
        primaryDocs: ['PoC 제안서', '데모 시나리오', '견적 초안'],
        seedDelta: { stamina: -3, mentality: 0, clientTrust: 10, techDebt: -1 },
        riskBias: 'mid',
        tags: ['신규수주', 'PoC', '제안'],
      },
    ],
  },
];
