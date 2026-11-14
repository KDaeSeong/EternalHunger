// Frame sides describe starting positions, not which side belongs to the human.
export function boardTeamsFor(player, opponent, watch) {
  const teams = watch ? [watch.left, watch.right] : [player, opponent];
  const allySide = player?.id ? teams.findIndex(team => team?.id === player.id) : -1;
  return teams.map((team, side) => {
    const relation = allySide < 0 ? 'spectator' : side === allySide ? 'ally' : 'enemy';
    const tone = relation === 'ally' || relation === 'spectator' && side === 0 ? 'blue' : 'red';
    const position = side === 0 ? '하단' : '상단';
    const label = relation === 'ally' ? '아군 진영' : relation === 'enemy' ? '적군 진영' : position + ' 팀';
    const badge = relation === 'ally' ? '아군' : relation === 'enemy' ? '적군' : position;
    return {
      side, id: team?.id || '', name: team?.name || '상대 팀', relation, tone, label, badge,
      caption: relation === 'spectator' ? '관전 · ' + label : label + ' · ' + position,
    };
  });
}
