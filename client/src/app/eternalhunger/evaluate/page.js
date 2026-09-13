import SimulationPage from '../../simulation/page';

export const metadata = {
  title: '이터널 헝거 · 5분 평가',
  description: '로그인과 계정 보상 없이 진행하는 이터널 헝거 전용 인간 평가',
};

const EVALUATION_CODE = 'EH-G5.3-20260913-A';
const EVALUATION_SEED = '1789192220412';

export default function EternalHungerEvaluationPage() {
  return (
    <SimulationPage
      evaluationMode
      evaluationCode={EVALUATION_CODE}
      evaluationSeed={EVALUATION_SEED}
    />
  );
}
