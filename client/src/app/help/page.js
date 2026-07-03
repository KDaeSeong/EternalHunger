'use client';

import Link from 'next/link';
import SiteHeader from '../../components/SiteHeader';
import '../../styles/ERHelp.css';

const flowCards = [
  {
    title: '1일차 낮',
    tag: '루트 파밍',
    body: '실험체들은 지정된 루트를 따라 이동하며 영웅 장비 5부위를 맞추는 것을 최우선으로 합니다.',
  },
  {
    title: '1일차 밤',
    tag: '야생동물 준비',
    body: '늑대와 곰을 사냥하고 오브젝트 시야를 잡으며 2일차 교전을 준비합니다.',
  },
  {
    title: '2일차 이후',
    tag: '본격 교전',
    body: '운석, 생명의 나무, 알파, 오메가 같은 오브젝트를 두고 팀 간 충돌이 늘어납니다.',
  },
  {
    title: '후반',
    tag: '안전지대',
    body: '금지구역이 좁아지고 임시 안전지대와 최종 안전지대를 중심으로 마지막 교전이 벌어집니다.',
  },
];

const termGroups = [
  {
    title: '캐릭터 설정',
    items: [
      ['장비 목표', 'AI는 초반 영웅 장비를 거쳐 최종적으로 초월 장비를 지향합니다.'],
      ['전술 스킬', '블링크처럼 전투나 도주에 쓰는 공용 스킬입니다. 실험체별 개성을 보완하는 도구라고 보면 됩니다.'],
      ['사용 무기', '실험체가 사용하는 무기 종류입니다. 무기 종류에 따라 숙련도와 무기 스킬, 전투 방식이 달라집니다.'],
      ['ER 프리셋', '이터널 리턴 실험체의 실제 무기와 성향을 참고해 캐릭터 설정을 자동으로 채우는 값입니다.'],
    ],
  },
  {
    title: '장비와 아이템',
    items: [
      ['장비', '무기, 머리, 옷, 팔, 다리처럼 착용하는 아이템입니다. 전투력에 가장 직접적으로 영향을 줍니다.'],
      ['영웅/전설/초월', '아이템 등급입니다. 영웅은 초반 기반, 전설은 중간 성장, 초월은 최종 장비 목표입니다.'],
      ['운석/생명의 나무/미스릴/포스 코어', '전설 장비 제작에 필요한 주요 재료입니다. 특정 시간, 지역, 야생동물, 보스에서 얻습니다.'],
      ['VF 혈액 샘플', '초월 장비 제작에 필요한 최고 등급 재료입니다. 위클라인 처치 보상으로 얻습니다.'],
    ],
  },
  {
    title: '시뮬레이션 로그',
    items: [
      ['파밍', '상자와 지역 자원에서 장비 재료나 음식 재료를 확보하는 행동입니다.'],
      ['숙련도', '행동을 통해 오르는 전투 경험입니다. 무기, 방어, 사냥, 제작, 탐색, 이동 숙련도가 성장에 영향을 줍니다.'],
      ['오브젝트', '운석, 생명의 나무, 알파, 오메가, 위클라인처럼 팀들이 싸울 만한 중요한 목표입니다.'],
      ['금지구역', '시간이 지나며 닫히는 위험 지역입니다. 오래 머물면 사망하거나 큰 손해를 봅니다.'],
    ],
  },
  {
    title: '진단과 저장',
    items: [
      ['Seed', '같은 설정으로 비슷한 흐름을 재현하기 위한 난수 기준값입니다. 밸런스 비교에 사용합니다.'],
      ['runEvents', '시뮬레이션 내부 이벤트 기록입니다. 사망, 전투, 파밍, 이동을 구조화해서 분석할 수 있습니다.'],
      ['MD/JSON 로그', '게임 시작부터 종료까지 쌓인 로그를 파일로 저장하는 기능입니다. 공유와 디버깅에 씁니다.'],
      ['밸런스 진단', '중반 사망률, 장비 완성률, 추격 성공률 같은 수치를 확인해 조정 방향을 잡는 기능입니다.'],
    ],
  },
];

const quickStarts = [
  '캐릭터 설정에서 이름, 무기, 전술 스킬을 먼저 확인합니다.',
  '장비 목표는 초월로 고정되어 있으므로 초월 장비 세팅과 로그 흐름을 함께 봅니다.',
  '시뮬레이션을 실행한 뒤 장비 완성률, 중반 사망률, 오브젝트 교전 빈도를 확인합니다.',
  '비교가 필요하면 seed를 고정하고 MD 또는 JSON 로그를 저장해 같은 조건으로 다시 돌립니다.',
];

export default function HelpPage() {
  return (
    <main className="help-page-shell">
      <SiteHeader />
      <section className="help-page">
        <section className="help-hero">
          <p className="help-kicker">BEGINNER GUIDE</p>
          <h1>처음 보는 사람도 따라갈 수 있는 도움말</h1>
          <p>
            Eternal Hunger에서 자주 나오는 목표, 전술, 장비, 숙련도, 오브젝트 용어를
            실제 플레이 흐름에 맞춰 정리했습니다.
          </p>
        </section>

        <section className="help-section">
          <div className="help-section-title">
            <span>01</span>
            <h2>게임 흐름</h2>
          </div>
          <div className="flow-grid">
            {flowCards.map((card) => (
              <article className="flow-card" key={card.title}>
                <div className="flow-tag">{card.tag}</div>
                <h3>{card.title}</h3>
                <p>{card.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="help-section">
          <div className="help-section-title">
            <span>02</span>
            <h2>자주 보이는 용어</h2>
          </div>
          <div className="term-grid">
            {termGroups.map((group) => (
              <article className="term-card" key={group.title}>
                <h3>{group.title}</h3>
                <dl>
                  {group.items.map(([term, desc]) => (
                    <div key={term}>
                      <dt>{term}</dt>
                      <dd>{desc}</dd>
                    </div>
                  ))}
                </dl>
              </article>
            ))}
          </div>
        </section>

        <section className="help-section help-quickstart">
          <div className="help-section-title">
            <span>03</span>
            <h2>처음 실행할 때</h2>
          </div>
          <ol>
            {quickStarts.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ol>
          <div className="help-actions">
            <Link href="/characters">캐릭터 설정</Link>
            <Link href="/simulation">시뮬레이션 보기</Link>
          </div>
        </section>
      </section>
    </main>
  );
}
