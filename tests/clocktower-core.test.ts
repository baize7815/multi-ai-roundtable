import assert from 'node:assert/strict';
import { parseClocktowerAction, validateClocktowerAction } from '../src/game/clocktower/actions';
import { buildClocktowerBaseContext } from '../src/game/clocktower/context';
import { checkClocktowerWinner, publiclyAlive, resolveRegistration, resolveRegistrationAsType } from '../src/game/clocktower/core';
import { clocktowerRoleById } from '../src/game/clocktower/scripts';
import { createClocktowerGame, resolveClocktowerSetup } from '../src/game/clocktower/setup';
import type { ClocktowerSetupSettings } from '../src/game/clocktower/types';
import type { ProviderId } from '../src/shared/types';

const PROVIDERS: ProviderId[] = ['doubao', 'deepseek', 'kimi', 'qwen', 'zhipu', 'gpt', 'gemini', 'grok'];

function settings(playerCount: 6 | 7 | 8, includeHuman = false, setupMode: 'curated' | 'random_legal' = 'random_legal'): ClocktowerSetupSettings {
  return {
    playerCount,
    providerIds: PROVIDERS.slice(0, playerCount - (includeHuman ? 1 : 0)),
    includeHuman,
    humanSeat: includeHuman ? 3 : 0,
    scriptId: 'trouble-brewing',
    setupMode
  };
}

function testSetupResolver(): void {
  for (const playerCount of [6, 7, 8] as const) {
    for (let seed = 1; seed <= 1000; seed += 1) {
      const setup = resolveClocktowerSetup(settings(playerCount), seed);
      assert.equal(setup.players.length, playerCount);
      assert.equal(setup.players.filter((p) => clocktowerRoleById[p.trueCharacter].type === 'demon').length, 1);
      assert.equal(setup.players.filter((p) => clocktowerRoleById[p.trueCharacter].type === 'minion').length, 1);
      const hasBaron = setup.players.some((p) => p.trueCharacter === 'baron');
      const expectedOutsiders = (playerCount === 6 ? 1 : playerCount === 7 ? 0 : 1) + (hasBaron ? 2 : 0);
      const expectedTownsfolk = (playerCount === 6 ? 3 : 5) - (hasBaron ? 2 : 0);
      assert.equal(setup.players.filter((p) => clocktowerRoleById[p.trueCharacter].type === 'outsider').length, expectedOutsiders);
      assert.equal(setup.players.filter((p) => clocktowerRoleById[p.trueCharacter].type === 'townsfolk').length, expectedTownsfolk);
      if (playerCount === 6) assert.equal(setup.demonBluffs.length, 0, '6人小局不应获得 Demon bluffs');
      else {
        assert.equal(setup.demonBluffs.length, 3);
        const goodInPlay = new Set(setup.players.filter((p) => p.alignment === 'good').map((p) => p.trueCharacter));
        assert.equal(setup.demonBluffs.some((role) => goodInPlay.has(role)), false, 'Demon bluff 不能是真正在场善良角色');
      }
      const drunk = setup.players.find((p) => p.trueCharacter === 'drunk');
      if (drunk) {
        assert.notEqual(drunk.perceivedCharacter, 'drunk');
        assert.equal(clocktowerRoleById[drunk.perceivedCharacter].type, 'townsfolk');
      }
    }
  }
}

function testActions(): void {
  const parsed = parseClocktowerAction('我会执行这个选择。\n[[ACTION:CHOOSE_PLAYERS:2,5]]');
  assert.equal(parsed.displayText, '我会执行这个选择。');
  assert.equal(parsed.actionType, 'choose_players');
  assert.deepEqual(parsed.targetSeats, [2, 5]);
  assert.deepEqual(validateClocktowerAction({
    parsed,
    expected: ['choose_players'],
    allowedTargets: [1, 2, 3, 4, 5, 6],
    minTargets: 2,
    maxTargets: 2
  }), { ok: true });
  assert.equal(validateClocktowerAction({
    parsed: parseClocktowerAction('[[ACTION:CHOOSE_PLAYER:9]]'),
    expected: ['choose_player'],
    allowedTargets: [1, 2, 3],
    minTargets: 1,
    maxTargets: 1
  }).ok, false);

  const markdownEscaped = parseClocktowerAction('[[ACTION:CHOOSE\\_PLAYER:3]]');
  assert.equal(markdownEscaped.actionType, 'choose_player', 'Provider Markdown 转义下划线后仍应识别机器动作');
  assert.deepEqual(markdownEscaped.targetSeats, [3]);

  const escapedVote = parseClocktowerAction('[[ACTION:VOTE\\_YES]]');
  assert.equal(escapedVote.actionType, 'vote_yes');
}

function testHumanAndPerceivedRole(): void {
  const game = createClocktowerGame(settings(6, true, 'curated'), 1234);
  assert.equal(game.players.filter((p) => p.controller === 'human').length, 1);
  assert.equal(game.players.find((p) => p.controller === 'human')?.seat, 3);
  const drunk = game.players[0];
  drunk.trueCharacter = 'drunk';
  drunk.perceivedCharacter = 'chef';
  drunk.alignment = 'good';
  drunk.drunk = true;
  const context = buildClocktowerBaseContext(game, drunk.seat);
  const privateState = context.split('[YOUR PRIVATE STATE]')[1].split('[PUBLIC / PRIVATE TIMELINE]')[0];
  assert.ok(privateState.includes(clocktowerRoleById.chef.name), '玩家应认知伪装身份的新显示名称');
  assert.equal(privateState.includes(`你的角色是：${clocktowerRoleById.drunk.name}`), false);

  const sober = game.players[1];
  sober.drunk = false;
  sober.poisonedUntilDay = undefined;
  const soberContext = buildClocktowerBaseContext(game, sober.seat);
  const reliabilityNotice = '信息可靠性提示：主持人可能依据规则给出正确或不正确的信息；系统不会通过提示格式、字段有无或措辞变化告诉你自己是否醉酒/中毒。';
  assert.match(context, new RegExp(reliabilityNotice.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(soberContext, new RegExp(reliabilityNotice.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));

  const nightVictim = game.players[2];
  nightVictim.alive = false;
  game.pendingNightDeaths = [nightVictim.seat];
  assert.equal(publiclyAlive(game, nightVictim), true, '夜间死亡在天亮公开前仍应按公开存活状态显示');
  game.pendingNightDeaths = [];
  assert.equal(publiclyAlive(game, nightVictim), false, '天亮公开后才应显示死亡');
}

function testRegistrationAndWin(): void {
  const game = createClocktowerGame(settings(7, false, 'curated'), 77);
  const subject = game.players[0];
  subject.trueCharacter = 'recluse';
  subject.perceivedCharacter = 'recluse';
  subject.alignment = 'good';
  const registration = resolveRegistration(game, subject, 'test');
  assert.ok(['good', 'evil'].includes(registration.alignment));
  assert.equal(resolveRegistrationAsType(game, subject, 'investigator-test', 'minion')?.type, 'minion');
  assert.equal(resolveRegistrationAsType(game, subject, 'slayer-test', 'demon')?.type, 'demon');
  assert.equal(resolveRegistrationAsType(game, subject, 'washerwoman-test', 'townsfolk'), undefined);

  const spy = game.players[1];
  spy.trueCharacter = 'spy';
  spy.perceivedCharacter = 'spy';
  spy.alignment = 'evil';
  assert.equal(resolveRegistrationAsType(game, spy, 'investigator-test', 'minion')?.role, 'spy');
  assert.equal(resolveRegistrationAsType(game, spy, 'washerwoman-test', 'townsfolk')?.type, 'townsfolk');
  assert.equal(resolveRegistrationAsType(game, spy, 'librarian-test', 'outsider')?.type, 'outsider');

  const imp = game.players.find((p) => p.trueCharacter === 'imp') ?? game.players[1];
  imp.trueCharacter = 'imp';
  imp.perceivedCharacter = 'imp';
  imp.alignment = 'evil';
  for (const player of game.players) player.alive = player.seat === imp.seat || player.seat === game.players.at(-1)!.seat;
  assert.equal(checkClocktowerWinner(game), 'evil', '两名存活且恶魔仍在场应为邪恶获胜');
}

testSetupResolver();
testActions();
testHumanAndPerceivedRole();
testRegistrationAndWin();
console.log('clocktower core tests passed');
