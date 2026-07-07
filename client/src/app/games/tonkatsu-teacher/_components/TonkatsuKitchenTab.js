import { ActionButton, SmallStat } from '../../_components/GamePlayPrimitives';
import {
  buyIngredientAction,
  craftRecipeAction,
  formatNeeds,
  fulfillDailyOrdersAction,
  inventoryCount,
  sellRecipeAction,
} from '../_lib/tonkatsuTeacherEngine';

export default function TonkatsuKitchenTab(props) {
  const {
    canAct,
    facilityContext,
    formatSigned,
    ingredient,
    ingredientId,
    recipe,
    recipeId,
    recipeStatus,
    selectedRecipePlan,
    setIngredientId,
    setRecipeId,
    setState,
    state,
  } = props;

  return (
    <>
              <>
              <section className="games-panel">
                <div className="games-panel-title">
                  <h2>선택 메뉴 운영 판단</h2>
                  <span>{selectedRecipePlan.planScore}% · {selectedRecipePlan.salesMode}</span>
                </div>
                <div className="games-rank-split">
                  <SmallStat label="제작 준비" value={selectedRecipePlan.prepText} />
                  <SmallStat label="예상 생산" value={`${selectedRecipePlan.expectedYield}개`} />
                  <SmallStat label="마진" value={formatSigned(selectedRecipePlan.margin, 'G')} />
                  <SmallStat label="학생 적합" value={selectedRecipePlan.studentFit} />
                  <SmallStat label="대회" value={selectedRecipePlan.tournamentText} />
                </div>
                <p style={{ color: '#cbd5e1', fontWeight: 900, lineHeight: 1.6, marginTop: 12 }}>
                  {selectedRecipePlan.nextAction}
                </p>
                <div className="game-save-list" style={{ marginTop: 12 }}>
                  {selectedRecipePlan.rows.map((row) => (
                    <article className="game-save-row" key={row.label}>
                      <div>
                        <span>{row.label}</span>
                        <strong>{row.value}</strong>
                        <small>{row.detail}</small>
                      </div>
                    </article>
                  ))}
                </div>
              </section>

              <section className="games-detail-grid">
                <section className="games-panel">
                  <div className="games-panel-title">
                    <h2>빠른 제작</h2>
                    <span>{recipe.name}</span>
                  </div>
                  <p style={{ color: '#cbd5e1', fontWeight: 800, lineHeight: 1.5 }}>
                    필요: {formatNeeds(recipe.needs)}
                  </p>
                  <div style={{ display: 'grid', gap: 8 }}>
                    <ActionButton disabled={!canAct || !recipeStatus.unlocked} onClick={() => setState((current) => craftRecipeAction(current, recipeId))}>메뉴 제작</ActionButton>
                    <ActionButton disabled={!canAct} onClick={() => setState((current) => sellRecipeAction(current, recipeId))}>선택 메뉴 판매</ActionButton>
                    <ActionButton disabled={!canAct} onClick={() => setState((current) => fulfillDailyOrdersAction(current))}>일일 주문 처리</ActionButton>
                  </div>
                </section>
                <section className="games-panel">
                  <div className="games-panel-title">
                    <h2>빠른 매입</h2>
                    <span>{ingredient.name}</span>
                  </div>
                  <div className="games-rank-split">
                    <SmallStat label="가격" value={`${ingredient.price}G`} />
                    <SmallStat label="보유 재료" value={inventoryCount(state)} />
                    <SmallStat label="보관 한도" value={facilityContext.storageCap} />
                  </div>
                  <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
                    <ActionButton disabled={!canAct} onClick={() => setState((current) => buyIngredientAction(current, ingredientId, 1))}>1개 구매</ActionButton>
                    <ActionButton disabled={!canAct} onClick={() => setState((current) => buyIngredientAction(current, ingredientId, 5))}>5개 구매</ActionButton>
                  </div>
                </section>
              </section>
              </>
    </>
  );
}
