import { ActionButton, SmallStat } from '../../_components/GamePlayPrimitives';
import {
  INGREDIENTS,
  buyIngredientAction,
  craftRecipeAction,
  formatNeeds,
  fulfillDailyOrdersAction,
  inventoryCount,
  sellRecipeAction,
} from '../_lib/tonkatsuTeacherEngine';
import TonkatsuMethodStrip from './TonkatsuMethodStrip';

export default function TonkatsuKitchenTab(props) {
  const {
    canAct,
    facilityContext,
    formatSigned,
    ingredient,
    ingredientId,
    methodProfile,
    methodRows,
    recipe,
    recipeId,
    recipes,
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
                <div className="tonkatsu-quick-selectors">
                  <label className="game-save-json-field">
                    <span>운영 메뉴</span>
                    <select value={recipeId} onChange={(event) => setRecipeId(event.target.value)}>
                      {recipes.map((item) => (
                        <option value={item.id} key={item.id} disabled={!item.unlocked}>
                          {item.unlocked ? item.name : `${item.name} · ${item.reason}`}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="game-save-json-field">
                    <span>매입 재료</span>
                    <select value={ingredientId} onChange={(event) => setIngredientId(event.target.value)}>
                      {INGREDIENTS.map((item) => (
                        <option value={item.id} key={item.id}>{item.name} · {item.price}G</option>
                      ))}
                    </select>
                  </label>
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

              <section className="games-panel tonkatsu-method-panel">
                <div className="games-panel-title">
                  <h2>조리 공정</h2>
                  <span>성공 {methodProfile.successPct}% · 숙련 생산 {methodProfile.productionText}</span>
                </div>
                <TonkatsuMethodStrip rows={methodRows.filter((row) => row.selected)} />
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
                    <ActionButton
                      action={methodProfile.methods[0]?.action || 'cook'}
                      cue="off"
                      disabled={!canAct || !selectedRecipePlan.canCraft}
                      title={selectedRecipePlan.canCraft ? `${methodProfile.successPct}% 확률로 제작` : selectedRecipePlan.nextAction}
                      onClick={() => setState((current) => craftRecipeAction(current, recipeId))}
                    >
                      메뉴 제작 · 성공 {methodProfile.successPct}%
                    </ActionButton>
                    <ActionButton action="sales" cue="off" disabled={!canAct} onClick={() => setState((current) => sellRecipeAction(current, recipeId))}>선택 메뉴 판매</ActionButton>
                    <ActionButton action="order" cue="off" disabled={!canAct} onClick={() => setState((current) => fulfillDailyOrdersAction(current))}>일일 주문 처리</ActionButton>
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
                    <ActionButton action="trade" cue="off" disabled={!canAct} onClick={() => setState((current) => buyIngredientAction(current, ingredientId, 1))}>1개 구매</ActionButton>
                    <ActionButton action="trade" cue="off" disabled={!canAct} onClick={() => setState((current) => buyIngredientAction(current, ingredientId, 5))}>5개 구매</ActionButton>
                  </div>
                </section>
              </section>
              </>
    </>
  );
}
