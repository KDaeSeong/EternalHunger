'use client';

import Link from 'next/link';
import '../../styles/ERHelp.css';

const flowCards = [
  {
    title: '1일차 낮',
    tag: '루트 파밍',
    body: '캐릭터들이 지역을 이동하며 재료를 모으고 영웅 등급 장비 5부위를 맞추는 준비 시간입니다.',
  },
  {
    title: '1일차 밤',
    tag: '야생동물',
    body: '늑대와 곰 같은 야생동물을 잡아 크레딧, 숙련도, 특수 재료 기회를 얻기 시작합니다.',
  },
  {
    title: '2일차 이후',
    tag: '본격 교전',
    body: '오브젝트, 키오스크, 차원의 틈, 야생동물을 두고 팀 간 충돌이 본격적으로 발생합니다.',
  },
  {
    title: '후반',
    tag: '안전지대',
    body: '금지구역이 늘어나고 남은 팀이 좁은 구역으로 몰리며 마지막 교전으로 이어집니다.',
  },
];

const termGroups = [
  {
    title: '캐릭터 설정',
    items: [
      ['목표', 'AI가 최종적으로 맞추려는 장비 등급입니다. 초월 목표는 강하지만 필요한 재료와 크레딧도 많습니다.'],
      ['전술 스킬', '교전이나 도주 중 사용하는 공용 스킬입니다. 블링크는 위험할 때 빠져나가는 이동기라고 생각하시면 됩니다.'],
      ['사용 무기', '캐릭터가 쓰는 무기 종류입니다. 무기 종류에 따라 무기 스킬과 전투 성향이 달라집니다.'],
      ['ER 프리셋', '이터널 리턴 실험체의 역할과 무기 성향을 참고해 능력치와 행동 성향을 자동으로 맞추는 추천값입니다.'],
    ],
  },
  {
    title: '장비와 아이템',
    items: [
      ['장비', '무기, 머리, 옷, 팔, 다리처럼 몸에 착용하는 아이템입니다. 전투력에 가장 직접적인 영향을 줍니다.'],
      ['영웅/전설/초월', '아이템 등급입니다. 영웅은 초반 완성 목표, 전설과 초월은 중후반 성장 목표입니다.'],
      ['운석/생명의 나무/미스릴/포스 코어', '전설 장비 제작에 쓰이는 핵심 특수 재료입니다. 특정 시간, 지역, 오브젝트, 야생동물에서 얻습니다.'],
      ['VF 혈액 샘플', '초월 장비 제작에 필요한 최상위 재료입니다. 주로 위클라인 처치 보상으로 얻습니다.'],
    ],
  },
  {
    title: '시뮬레이션 로그',
    items: [
      ['파밍', '지역을 돌며 재료, 음식, 상자를 찾는 행동입니다. 1일차 낮에는 파밍 완성률이 중요합니다.'],
      ['오브젝트', '운석, 생명의 나무, 알파, 오메가, 위클라인처럼 여러 팀이 노릴 만한 중요한 목표입니다.'],
      ['키오스크', '크레딧으로 재료를 주문하거나 부활, 보급을 처리하는 장치입니다. 2일차부터 중요해집니다.'],
      ['금지구역', '시간이 지나며 닫히는 위험 지역입니다. 오래 머무르면 폭발 타이머 때문에 사망할 수 있습니다.'],
    ],
  },
  {
    title: '진단과 저장',
    items: [
      ['Seed', '같은 seed와 같은 설정이면 비슷한 흐름을 재현하기 위한 값입니다. 밸런스 비교에 사용합니다.'],
      ['runEvents', '로그의 원본이 되는 구조화 이벤트입니다. 사망, 도주, 획득, 제작 같은 결과를 숫자로 분석할 수 있습니다.'],
      ['로그 MD/JSON', '게임 시작부터 종료까지 쌓인 로그를 파일로 저장합니다. JSON은 밸런스 진단과 재현 분석에 적합합니다.'],
      ['밸런스 진단', '중반 사망률, 후반 쏠림, 추격 성공률, 장비 완성률을 요약해 조정 방향을 보여줍니다.'],
    ],
  },
];

const quickStarts = [
  '처음에는 목표 장비를 영웅 또는 전설로 두면 로그를 이해하기 쉽습니다.',
  '전술 스킬을 모르겠다면 블링크가 가장 무난합니다. 위험할 때 빠져나가는 용도입니다.',
  '게임이 후반까지 너무 오래 가면 개발자 도구의 밸런스 진단에서 중반 사망과 추격 성공률을 먼저 확인하세요.',
  '결과 비교가 필요하면 seed를 고정하고 JSON 로그를 저장한 뒤 진단 스크립트로 비교하세요.',
];

export default function HelpPage() {
  return (
    <main className="help-page">
      <header className="help-topbar">
        <Link href="/" className="help-logo" aria-label="메인으로 이동">
          <span>ETERNAL</span>
          <strong>HUNGER</strong>
        </Link>
        <nav className="help-nav" aria-label="도움말 내비게이션">
          <Link href="/characters">캐릭터 설정</Link>
          <Link href="/details">상세 설정</Link>
          <Link href="/simulation">게임 시작</Link>
        </nav>
      </header>

      <section className="help-hero">
        <p className="help-kicker">BEGINNER GUIDE</p>
        <h1>이터널 리턴을 몰라도 읽히는 도움말</h1>
        <p>
          Eternal Hunger의 설정과 로그에서 자주 나오는 말을 빠르게 이해하기 위한 안내입니다.
          게임을 모르는 분도 목표, 전술, 장비, 오브젝트의 의미를 먼저 잡을 수 있게 정리했습니다.
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
          <h2>처음 플레이할 때</h2>
        </div>
        <ol>
          {quickStarts.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ol>
        <div className="help-actions">
          <Link href="/characters">캐릭터 목표 설정</Link>
          <Link href="/simulation">시뮬레이션 보기</Link>
        </div>
      </section>
    </main>
  );
}
