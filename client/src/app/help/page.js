'use client';

import Link from 'next/link';
import '../../styles/ERHelp.css';

const flowCards = [
  {
    title: '1일차 낮',
    tag: '파밍',
    body: '각 캐릭터가 구역을 돌며 재료를 모으고 영웅 등급 장비 5부위를 맞추는 준비 시간입니다.',
  },
  {
    title: '1일차 밤',
    tag: '야생동물',
    body: '늑대와 곰 같은 야생동물을 잡아 크레딧, 숙련도, 특수 재료 기회를 얻습니다.',
  },
  {
    title: '2일차 이후',
    tag: '교전',
    body: '오브젝트, 키오스크, 야생동물을 두고 팀끼리 부딪히며 본격적으로 탈락이 발생합니다.',
  },
  {
    title: '후반',
    tag: '안전지대',
    body: '금지구역이 늘어나고 남은 팀이 좁은 구역에서 마지막 교전을 벌입니다.',
  },
];

const termGroups = [
  {
    title: '캐릭터 설정에서 보이는 말',
    items: [
      ['목표', 'AI가 이번 판에서 우선 맞추려고 하는 장비 등급입니다. 초월 목표면 더 높은 장비를 노리지만, 그만큼 재료와 크레딧이 더 필요합니다.'],
      ['전술 스킬', '전투 중 한 번씩 큰 도움을 주는 공용 스킬입니다. 블링크는 위험할 때 빠져나가는 이동기라고 생각하시면 됩니다.'],
      ['사용 무기', '캐릭터가 주로 쓰는 무기 종류입니다. 무기 종류에 따라 전투 방식과 무기 스킬이 달라집니다.'],
      ['ER 프리셋', '이터널 리턴 실험체 느낌에 맞춰 무기, 성향, 능력치를 자동으로 잡아주는 추천값입니다.'],
    ],
  },
  {
    title: '장비와 아이템',
    items: [
      ['장비', '무기, 옷, 머리, 팔, 다리처럼 몸에 착용하는 아이템입니다. 전투력에 가장 크게 영향을 줍니다.'],
      ['영웅/전설/초월', '아이템 등급입니다. 보통 영웅은 초반 완성 목표, 전설과 초월은 중후반 성장 목표입니다.'],
      ['운석/생명의 나무/미스릴/포스 코어', '전설 장비 제작에 쓰이는 핵심 재료입니다. 특정 시간, 구역, 야생동물, 보스에서 나옵니다.'],
      ['VF 혈액 샘플', '초월 장비 제작에 쓰이는 최상위 재료입니다. 주로 위클라인 처치 보상입니다.'],
    ],
  },
  {
    title: '시뮬레이션 로그',
    items: [
      ['파밍', '구역을 돌며 재료와 음식, 상자를 찾는 행동입니다.'],
      ['오브젝트', '운석, 생명의 나무, 알파, 오메가, 위클라인처럼 팀들이 싸울 가치가 큰 목표입니다.'],
      ['키오스크', '크레딧으로 재료나 부활 등을 주문하는 장치입니다. 2일차부터 중요해집니다.'],
      ['금지구역', '시간이 지나면 닫히는 위험 지역입니다. 오래 머무르면 폭발 타이머 때문에 사망할 수 있습니다.'],
    ],
  },
];

const quickStarts = [
  '처음에는 목표 장비 등급을 영웅 또는 전설로 두면 로그를 이해하기 쉽습니다.',
  '전술 스킬을 모르겠다면 블링크가 가장 무난합니다. 위험할 때 도주하는 성향입니다.',
  '캐릭터가 너무 빨리 죽으면 목표를 낮추거나 전투 보정치를 낮춰 관전 템포를 확인해보세요.',
  '로그에서 “목표 이동”은 AI가 지금 무엇을 하러 가는지 보여주는 단서입니다.',
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
          <Link href="/details">상세설정</Link>
          <Link href="/simulation">▶ 게임 시작</Link>
        </nav>
      </header>

      <section className="help-hero">
        <p className="help-kicker">BEGINNER GUIDE</p>
        <h1>이터널 리턴을 몰라도 읽히는 도움말</h1>
        <p>
          이 페이지는 원작 용어를 전부 외우기보다, Eternal Hunger에서 설정값과 로그가
          무엇을 뜻하는지 빠르게 이해하기 위한 안내입니다.
        </p>
      </section>

      <section className="help-section">
        <div className="help-section-title">
          <span>01</span>
          <h2>한 판의 큰 흐름</h2>
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
          <h2>처음 플레이할 때 추천</h2>
        </div>
        <ol>
          {quickStarts.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ol>
        <div className="help-actions">
          <Link href="/characters">캐릭터 목표 설정하기</Link>
          <Link href="/simulation">시뮬레이션 보기</Link>
        </div>
      </section>
    </main>
  );
}
