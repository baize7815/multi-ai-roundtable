import DOMPurify from 'dompurify';
import { marked } from 'marked';
import { PROVIDERS, providerById } from '../shared/providers';
import { DEFAULT_STATE, STORAGE_KEY, createConversationSession, loadState } from '../shared/storage';
import { buildExpertPresetTransferFile, mergeExpertPresets, parseExpertPresetTransferFile } from './expert-transfer';
import { humanVisibleEvents } from '../game/werewolf/context';
import { ROLE_LABELS } from '../game/werewolf/rules';
import type { WerewolfActionType, WerewolfGameSession, WerewolfPendingHumanAction, WerewolfSetupSettings } from '../game/werewolf/types';
import { clocktowerRoleById, TROUBLE_BREWING_ROLES } from '../game/clocktower/scripts';
import { publiclyAlive } from '../game/clocktower/core';
import type {
  ClocktowerActionType,
  ClocktowerGameSession,
  ClocktowerPendingHumanAction,
  ClocktowerRoleId,
  ClocktowerSetupSettings
} from '../game/clocktower/types';
import type {
  AttachmentPayload,
  ChatMessage,
  ComposerPayload,
  ConversationMode,
  ConversationSession,
  ExpertAssignmentSnapshot,
  ExpertPreset,
  Mode,
  PersistedState,
  ProviderEvent,
  ProviderId,
  SequentialMode
} from '../shared/types';

marked.use({ gfm: true, breaks: true });

const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const messagesEl = el<HTMLElement>('messages');
const messageInput = el<HTMLTextAreaElement>('messageInput');
const fileInput = el<HTMLInputElement>('fileInput');
const attachmentTray = el<HTMLElement>('attachmentTray');
const qaSendButton = el<HTMLButtonElement>('qaSendButton');
const roundActionButton = el<HTMLButtonElement>('roundActionButton');
const roundRange = el<HTMLInputElement>('roundRange');
const roundNumber = el<HTMLInputElement>('roundNumber');
const roundControls = el<HTMLElement>('roundControls');
const roundtableStatus = el<HTMLElement>('roundtableStatus');

const ICON_EDIT = '<svg width="20" height="20" viewBox="0 0 48 48" fill="none" aria-hidden="true"><path d="M7 42H43" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M11 26.7199V34H18.3172L39 13.3081L31.6951 6L11 26.7199Z" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/></svg>';
const ICON_DELETE = '<svg width="20" height="20" viewBox="0 0 48 48" fill="none" aria-hidden="true"><path d="M9 10V44H39V10H9Z" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/><path d="M20 20V33M28 20V33" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 10H44" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M16 10L19.289 4H28.7771L32 10H16Z" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/></svg>';
const ICON_EXPORT = '<svg width="20" height="20" viewBox="0 0 48 48" fill="none" aria-hidden="true"><path d="M42 27C42 33 38 43 24 43C10 43 6 33 6 27" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M24.0078 5.10059V33.0001" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 17L24 5L36 17" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>';

let state: PersistedState = structuredClone(DEFAULT_STATE);
let uiBaseline: PersistedState = structuredClone(DEFAULT_STATE);
let draftAttachments: AttachmentPayload[] = [];
let interruptRequested = false;
let currentOperationId: string | null = null;
let currentProvider: ProviderId | null = null;
let currentSequentialSessionId: string | null = null;
let editingExpertId: string | null = null;
let clocktowerSelectedTargets: number[] = [];

type ProviderAvailabilityState = 'unknown' | 'ready' | 'error';
interface ProviderAvailability {
  state: ProviderAvailabilityState;
  connected: boolean;
  reason?: string;
}
const providerAvailability = new Map<ProviderId, ProviderAvailability>();

interface PendingOperation {
  messageId: string;
  sessionId: string;
  provider: ProviderId;
  mode: ConversationMode;
  resolve: (text: string) => void;
  reject: (error: Error) => void;
}

const pendingOperations = new Map<string, PendingOperation>();

async function saveState(nextState: PersistedState): Promise<void> {
  const baseline = uiBaseline;
  const changed = (a: unknown, b: unknown) => JSON.stringify(a) !== JSON.stringify(b);
  const settings: Partial<PersistedState['settings']> = {};
  for (const key of ['replyAcceleration', 'qaProviders', 'roundtableProviders', 'werewolfProviders', 'clocktowerProviders', 'expertPresetByProvider'] as const) {
    if (changed(nextState.settings[key], baseline.settings[key])) Object.assign(settings, { [key]: nextState.settings[key] });
  }
  const sessions = nextState.conversations.flatMap<{ id: string; created?: ConversationSession; addedMessages?: ChatMessage[]; rounds?: number; expertAssignments?: ConversationSession['expertAssignments']; title?: string }>((session) => {
    const previous = baseline.conversations.find((item) => item.id === session.id);
    if (!previous) return [{ id: session.id, created: structuredClone(session) }];
    const addedMessages = session.messages.filter((message) => message.role === 'user' && !previous.messages.some((item) => item.id === message.id));
    const update = {
      id: session.id,
      addedMessages,
      ...(session.rounds !== previous.rounds ? { rounds: session.rounds } : {}),
      ...(session.title !== previous.title ? { title: session.title } : {}),
      ...(changed(session.expertAssignments, previous.expertAssignments) ? { expertAssignments: session.expertAssignments } : {})
    };
    return addedMessages.length || Object.keys(update).length > 2 ? [update] : [];
  });
  const patch = {
    ...(nextState.activeMode !== baseline.activeMode ? { activeMode: nextState.activeMode } : {}),
    ...(changed(nextState.activeConversationIds, baseline.activeConversationIds) ? { activeConversationIds: nextState.activeConversationIds } : {}),
    ...(Object.keys(settings).length ? { settings } : {}),
    ...(changed(nextState.expertPresets, baseline.expertPresets) ? { expertPresets: nextState.expertPresets } : {}),
    sessions,
    deletedSessionIds: baseline.conversations.filter((session) => !nextState.conversations.some((item) => item.id === session.id)).map((session) => session.id)
  };
  uiBaseline = structuredClone(nextState);
  try { await runtimeMessage({ type: 'APPLY_UI_PATCH', patch }); }
  catch (error) { await refreshStateFromStorage(); throw error; }
}

function id(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

function isSequentialMode(mode: Mode): mode is SequentialMode {
  return mode === 'roundtable' || mode === 'expert';
}

function isConversationMode(mode: Mode): mode is ConversationMode {
  return mode !== 'werewolf' && mode !== 'clocktower';
}

function isActiveConversation(session: ConversationSession): boolean {
  return isConversationMode(state.activeMode) && state.activeConversationIds[state.activeMode] === session.id;
}

function modeLabel(mode: Mode): string {
  return mode === 'qa' ? 'AI 对话' : mode === 'roundtable' ? 'AI 圆桌' : mode === 'expert' ? '专家团' : mode === 'werewolf' ? '狼人杀' : '迷雾议会';
}

function providersForMode(mode: ConversationMode): ProviderId[] {
  if (mode === 'qa') return state.settings.qaProviders;
  return state.settings.roundtableProviders;
}

function sessionById(sessionId: string): ConversationSession | undefined {
  return state.conversations.find((session) => session.id === sessionId);
}

function captureExpertAssignments(): Partial<Record<ProviderId, ExpertAssignmentSnapshot>> {
  const result: Partial<Record<ProviderId, ExpertAssignmentSnapshot>> = {};
  for (const provider of PROVIDERS) {
    const presetId = state.settings.expertPresetByProvider[provider.id];
    const preset = presetId ? state.expertPresets.find((item) => item.id === presetId) : undefined;
    if (preset) result[provider.id] = { presetId: preset.id, name: preset.name, prompt: preset.prompt };
  }
  return result;
}

function createSession(mode: ConversationMode): ConversationSession {
  const session = createConversationSession(mode);
  if (mode === 'expert') session.expertAssignments = captureExpertAssignments();
  state.conversations.push(session);
  state.activeConversationIds[mode] = session.id;
  return session;
}

function ensureActiveSession(mode: ConversationMode): ConversationSession {
  const activeId = state.activeConversationIds[mode];
  const active = activeId ? sessionById(activeId) : undefined;
  if (active && active.mode === mode) return active;
  const latest = [...state.conversations].filter((session) => session.mode === mode).sort((a, b) => b.updatedAt - a.updatedAt)[0];
  if (latest) {
    state.activeConversationIds[mode] = latest.id;
    return latest;
  }
  return createSession(mode);
}

function activeSession(): ConversationSession {
  if (!isConversationMode(state.activeMode)) throw new Error('游戏模式不使用普通会话 Session');
  return ensureActiveSession(state.activeMode);
}

function activeWerewolfGame(): WerewolfGameSession | undefined {
  return state.activeWerewolfGameId ? state.werewolfGames.find((game) => game.id === state.activeWerewolfGameId) : undefined;
}

function activeClocktowerGame(): ClocktowerGameSession | undefined {
  return state.activeClocktowerGameId ? state.clocktowerGames.find((game) => game.id === state.activeClocktowerGameId) : undefined;
}

function deriveTitle(payload: ComposerPayload): string {
  const text = payload.text.replace(/\s+/g, ' ').trim();
  if (text) return text.length > 30 ? `${text.slice(0, 30)}…` : text;
  return payload.attachments[0]?.name || '新会话';
}

function touchSession(session: ConversationSession): void {
  session.updatedAt = Date.now();
}

function providerLabel(provider?: ProviderId): string {
  return provider ? providerById[provider].label : '系统';
}

function providerIconUrl(provider: ProviderId): string {
  return chrome.runtime.getURL(`LOGO/${providerById[provider]?.iconFile ?? `${provider}.png`}`);
}

function providerDisplayLabel(session: ConversationSession, provider?: ProviderId): string {
  if (!provider) return '系统';
  if (session.mode === 'expert') {
    const expert = session.expertAssignments?.[provider];
    if (expert?.name) return `${providerLabel(provider)} · ${expert.name}`;
  }
  return providerLabel(provider);
}

function renderMarkdown(text: string): string {
  const rendered = marked.parse(text || '') as string;
  return DOMPurify.sanitize(rendered, { USE_PROFILES: { html: true } });
}

function decorateRenderedMarkdown(container: HTMLElement): void {
  container.querySelectorAll('a').forEach((anchor) => {
    anchor.setAttribute('target', '_blank');
    anchor.setAttribute('rel', 'noreferrer noopener');
  });
  container.querySelectorAll('table').forEach((table) => {
    if (table.parentElement?.classList.contains('table-scroll')) return;
    const wrapper = document.createElement('div');
    wrapper.className = 'table-scroll';
    table.parentNode?.insertBefore(wrapper, table);
    wrapper.appendChild(table);
  });
}

function createReplyActions(text: string): HTMLElement {
  const actions = document.createElement('div');
  actions.className = 'reply-actions';
  const copy = document.createElement('button');
  copy.type = 'button';
  copy.className = 'reply-copy-button';
  copy.title = '复制回复';
  copy.setAttribute('aria-label', '复制回复');
  copy.innerHTML = '<svg width="18" height="18" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M13 12.4316V7.8125C13 6.2592 14.2592 5 15.8125 5H40.1875C41.7408 5 43 6.2592 43 7.8125V32.1875C43 33.7408 41.7408 35 40.1875 35H35.5163" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M32.1875 13H7.8125C6.2592 13 5 14.2592 5 15.8125V40.1875C5 41.7408 6.2592 43 7.8125 43H32.1875C33.7408 43 35 41.7408 35 40.1875V15.8125C35 14.2592 33.7408 13 32.1875 13Z" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/></svg>';
  copy.addEventListener('click', async () => {
    copy.disabled = true;
    try {
      await navigator.clipboard.writeText(text);
      showComposerError('已复制回复');
    } catch {
      showComposerError('复制失败，请选中文字手动复制');
    } finally {
      copy.disabled = false;
    }
  });
  actions.append(copy);
  return actions;
}

function werewolfPhaseLabel(game: WerewolfGameSession): string {
  const labels: Partial<Record<WerewolfGameSession['phase'], string>> = {
    setup: '等待开始',
    night_start: `第 ${game.day} 夜`,
    wolf_discussion: '狼人夜谈',
    wolf_vote: '狼人刀人投票',
    wolf_tiebreak_discussion: '狼人决胜讨论',
    wolf_tiebreak_vote: '狼人决胜投票',
    seer_action: '预言家行动',
    witch_action: '女巫行动',
    night_resolution: '夜间结算',
    dawn: `第 ${game.day} 天天亮`,
    death_trigger: '死亡结算',
    last_word: '遗言',
    day_speech: `第 ${game.day} 天发言`,
    day_vote: '白天投票',
    day_tiebreak_vote: '平票重投',
    exile_resolution: '放逐结算',
    win_check: '胜负检查',
    ended: '游戏结束'
  };
  return labels[game.phase] ?? game.phase;
}

function werewolfStatusLabel(game: WerewolfGameSession): string {
  if (game.status === 'paused') return game.lastError ? `已中断 · ${game.lastError}` : '已中断，可继续';
  if (game.status === 'error') return game.lastError ? `异常 · ${game.lastError}` : '异常，等待处理';
  if (game.status === 'waiting_human') return `等待你的行动 · ${werewolfPhaseLabel(game)}`;
  if (game.status === 'ended') return `${game.winner === 'wolf' ? '狼人阵营' : '好人阵营'}获胜`;
  if (game.status === 'running') return werewolfPhaseLabel(game);
  return '待开始';
}

function werewolfProgressLabel(game: WerewolfGameSession): string {
  const pending = game.pendingTurn ?? game.pendingParallelTurns?.[0];
  const kindLabels: Partial<Record<NonNullable<typeof pending>['kind'], string>> = {
    wolf_discussion: '狼人讨论中…',
    kill: '狼人刀人中…',
    check: '预言家验人中…',
    witch: '女巫决定中…',
    shoot: '猎人行动中…',
    speech: '白天发言中…',
    vote: '投票处理中…',
    last_word: '遗言进行中…'
  };
  if (pending?.kind && kindLabels[pending.kind]) return kindLabels[pending.kind]!;

  const phaseLabels: Partial<Record<WerewolfGameSession['phase'], string>> = {
    wolf_discussion: '狼人讨论中…',
    wolf_vote: '狼人刀人中…',
    wolf_tiebreak_discussion: '狼人讨论中…',
    wolf_tiebreak_vote: '狼人刀人中…',
    seer_action: '预言家验人中…',
    witch_action: '女巫决定中…',
    night_start: '夜间准备中…',
    night_resolution: '夜间结算中…',
    death_trigger: '死亡结算中…',
    last_word: '遗言进行中…',
    day_speech: '白天发言中…',
    day_vote: '投票处理中…',
    day_tiebreak_vote: '投票处理中…',
    exile_resolution: '放逐结算中…',
    win_check: '胜负检查中…'
  };
  return phaseLabels[game.phase] ?? '游戏处理中…';
}

function werewolfHumanPlayer(game: WerewolfGameSession) {
  return game.players.find((player) => player.controller === 'human');
}

function werewolfPhaseLabelForHuman(game: WerewolfGameSession): string {
  const human = werewolfHumanPlayer(game);
  if (game.phase.startsWith('wolf_')) return human?.role === 'wolf' ? werewolfPhaseLabel(game) : `第 ${game.day} 夜 · 夜间行动`;
  if (game.phase === 'seer_action') return human?.role === 'seer' ? werewolfPhaseLabel(game) : `第 ${game.day} 夜 · 夜间行动`;
  if (game.phase === 'witch_action') return human?.role === 'witch' ? werewolfPhaseLabel(game) : `第 ${game.day} 夜 · 夜间行动`;
  return werewolfPhaseLabel(game);
}

function canRevealPendingWerewolfActor(game: WerewolfGameSession): boolean {
  const pending = game.pendingTurn;
  if (!pending) return false;
  if (pending.kind === 'speech' || pending.kind === 'last_word') return true;
  return pending.kind === 'wolf_discussion' && werewolfHumanPlayer(game)?.role === 'wolf';
}

function humanTextTurn(pending?: WerewolfPendingHumanAction): boolean {
  return Boolean(pending && ['speech', 'wolf_discussion', 'last_word'].includes(pending.kind));
}

function actionLabel(action: WerewolfActionType): string {
  const labels: Record<WerewolfActionType, string> = {
    vote: '投票',
    kill: '刀人',
    check: '查验',
    save: '使用解药',
    poison: '使用毒药',
    shoot: '开枪',
    pass: '跳过',
    speech: '发言'
  };
  return labels[action];
}

async function submitWerewolfHumanAction(submission: { text?: string; actionType?: WerewolfActionType; targetSeat?: number }): Promise<void> {
  const game = activeWerewolfGame();
  if (!game?.pendingHumanAction) return;
  try {
    await runtimeMessage({ type: 'SUBMIT_WEREWOLF_HUMAN_ACTION', gameId: game.id, submission });
    clearComposer();
  } catch (error) {
    showComposerError(error instanceof Error ? error.message : String(error));
  }
}

async function submitClocktowerHumanAction(submission: { text?: string; actionType?: ClocktowerActionType; targetSeat?: number; targetSeats?: number[] }): Promise<void> {
  const game = activeClocktowerGame();
  if (!game?.pendingHumanAction) return;
  try {
    await runtimeMessage({ type: 'SUBMIT_CLOCKTOWER_HUMAN_ACTION', gameId: game.id, submission });
    clocktowerSelectedTargets = [];
    clearComposer();
  } catch (error) {
    showComposerError(error instanceof Error ? error.message : String(error));
  }
}

function renderHumanActionPanel(game: WerewolfGameSession, pending: WerewolfPendingHumanAction, dashboard: HTMLElement): void {
  if (humanTextTurn(pending)) return;
  const panel = document.createElement('div');
  panel.className = 'werewolf-human-actions';
  const intro = document.createElement('div');
  intro.style.width = '100%';
  intro.style.fontSize = '11px';
  intro.style.color = 'var(--muted)';
  intro.textContent = pending.kind === 'vote'
    ? '请选择投票目标。所有存活玩家同时提交，全部完成后统一公布票型。'
    : pending.prompt.includes('[CURRENT TURN]')
      ? `轮到你行动 · ${werewolfPhaseLabelForHuman(game)}`
      : pending.prompt;
  panel.append(intro);

  for (const action of pending.expectedActions) {
    if (action === 'pass') {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'werewolf-target-button';
      button.textContent = actionLabel(action);
      button.addEventListener('click', () => void submitWerewolfHumanAction({ actionType: action }));
      panel.append(button);
      continue;
    }
    let targets = pending.allowedTargets;
    if (action === 'save') targets = game.night.wolfTarget ? [game.night.wolfTarget] : [];
    for (const target of targets) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'werewolf-target-button';
      button.textContent = `${actionLabel(action)} ${target}号`;
      button.addEventListener('click', () => void submitWerewolfHumanAction({ actionType: action, targetSeat: target }));
      panel.append(button);
    }
  }
  dashboard.append(panel);
}

function renderWerewolfSetup(): void {
  messagesEl.replaceChildren();
  const card = document.createElement('section');
  card.className = 'werewolf-setup-card';
  const icon = document.createElement('img');
  icon.src = chrome.runtime.getURL('SVG/狼人杀.svg');
  icon.alt = '';
  const title = document.createElement('h3');
  title.textContent = 'AI 狼人杀';
  const setup = state.werewolfSetup;
  const neededAi = setup.playerCount - (setup.includeHuman ? 1 : 0);
  const selected = state.settings.werewolfProviders.filter((provider) => providerById[provider]?.enabled);
  const body = document.createElement('p');
  body.textContent = `${setup.playerCount} 人局 · ${setup.includeHuman ? '你 + ' : ''}${neededAi} 个 AI 玩家。当前已选择 ${selected.length} 个模型，按设置中的顺序取前 ${neededAi} 个。点击下方“开始”后会为本局创建全新的独立网页会话。`;
  card.append(icon, title, body);
  messagesEl.append(card);
}

function renderWerewolfGame(game: WerewolfGameSession): void {
  messagesEl.replaceChildren();
  const dashboard = document.createElement('section');
  dashboard.className = 'werewolf-dashboard';

  const hero = document.createElement('div');
  hero.className = 'werewolf-hero';
  const heroTitle = document.createElement('div');
  heroTitle.className = 'werewolf-hero-title';
  const title = document.createElement('span');
  title.textContent = game.title;
  const status = document.createElement('span');
  status.textContent = game.status === 'running' ? werewolfPhaseLabelForHuman(game) : werewolfStatusLabel(game);
  status.style.color = game.status === 'error' || game.status === 'paused' ? 'var(--danger)' : 'var(--muted)';
  status.style.fontSize = '10px';
  heroTitle.append(title, status);
  const sub = document.createElement('div');
  sub.className = 'werewolf-hero-sub';
  sub.textContent = `${game.rulesetSnapshot.name} · 第 ${game.day} 天 · ${werewolfPhaseLabelForHuman(game)} · Final-only 回复模式`;
  hero.append(heroTitle, sub);
  dashboard.append(hero);

  const human = werewolfHumanPlayer(game);
  if (human) {
    const privateCard = document.createElement('div');
    privateCard.className = 'werewolf-role-private';
    const wolfMates = human.role === 'wolf'
      ? game.players.filter((player) => player.role === 'wolf').map((player) => player.seat).join('、')
      : '';
    privateCard.textContent = `你是 ${human.seat}号 · ${ROLE_LABELS[human.role]} · ${human.faction === 'wolf' ? '狼人阵营' : '好人阵营'}。${wolfMates ? `狼人同伴：${wolfMates}号（含你）。` : ''}游戏中的私密信息只会显示在你的视角。`;
    dashboard.append(privateCard);
  }

  const seats = document.createElement('div');
  seats.className = 'werewolf-seat-grid';
  for (const player of [...game.players].sort((a, b) => a.seat - b.seat)) {
    const seat = document.createElement('div');
    seat.className = `werewolf-seat ${player.lifeState} ${player.controller === 'human' ? 'human' : ''}`;
    if (player.providerId) {
      const avatar = document.createElement('img');
      avatar.src = providerIconUrl(player.providerId);
      avatar.alt = '';
      seat.append(avatar);
    } else {
      const humanAvatar = document.createElement('div');
      humanAvatar.textContent = '你';
      humanAvatar.style.fontWeight = '650';
      humanAvatar.style.fontSize = '13px';
      seat.append(humanAvatar);
    }
    const name = document.createElement('strong');
    name.textContent = `${player.seat}号 · ${player.controller === 'human' ? '你' : providerLabel(player.providerId)}`;
    const role = document.createElement('span');
    role.textContent = game.status === 'ended' || player.controller === 'human' ? ROLE_LABELS[player.role] : player.lifeState === 'dead' ? '已出局' : '身份隐藏';
    seat.append(name, role);
    seats.append(seat);
  }
  dashboard.append(seats);

  const events = document.createElement('div');
  events.className = 'werewolf-events';
  for (const event of humanVisibleEvents(game)) {
    if (!event.content) continue;
    const row = document.createElement('article');
    const author = event.authorSeat ? playerBySeatUi(game, event.authorSeat) : undefined;
    row.className = `werewolf-event ${event.visibility.type === 'wolf' ? 'wolf' : event.visibility.type === 'private' ? 'private' : ''} ${author?.providerId ? providerById[author.providerId].colorClass : ''}`;
    const meta = document.createElement('div');
    meta.className = 'werewolf-event-meta';
    meta.textContent = event.authorSeat
      ? `${event.authorSeat}号 · ${author?.controller === 'human' ? '你' : providerLabel(author?.providerId)}`
      : event.visibility.type === 'wolf' ? '狼人频道' : event.visibility.type === 'private' ? '私密信息' : '主持人';
    const body = document.createElement('div');
    body.className = 'werewolf-event-body';
    body.innerHTML = renderMarkdown(event.content);
    decorateRenderedMarkdown(body);
    row.append(meta, body);
    if (author?.controller === 'ai') row.append(createReplyActions(event.content));
    events.append(row);
  }
  dashboard.append(events);

  if (game.pendingTurn || game.pendingParallelTurns?.length) {
    const thinking = document.createElement('div');
    thinking.className = 'werewolf-thinking';
    thinking.textContent = game.phase === 'day_vote' || game.phase === 'day_tiebreak_vote'
      ? `投票处理中…${game.pendingParallelTurns?.length ? ` 剩余 ${game.pendingParallelTurns.length + (game.pendingHumanAction ? 1 : 0)} 票` : ''}`
      : canRevealPendingWerewolfActor(game)
      ? `${game.pendingTurn!.seat}号 · ${providerLabel(game.pendingTurn!.provider)} 正在思考…`
      : game.phase.startsWith('wolf_') || game.phase === 'seer_action' || game.phase === 'witch_action' || game.phase === 'night_start' || game.phase === 'night_resolution'
          ? werewolfProgressLabel(game)
          : '游戏处理中…';
    dashboard.append(thinking);
  }
  if (game.pendingHumanAction) renderHumanActionPanel(game, game.pendingHumanAction, dashboard);
  messagesEl.append(dashboard);
  requestAnimationFrame(() => { messagesEl.scrollTop = messagesEl.scrollHeight; });
}

function playerBySeatUi(game: WerewolfGameSession, seat: number) {
  return game.players.find((player) => player.seat === seat);
}

function renderWerewolf(): void {
  const game = activeWerewolfGame();
  if (!game) renderWerewolfSetup();
  else renderWerewolfGame(game);
}

function clocktowerPhaseLabel(game: ClocktowerGameSession): string {
  const labels: Partial<Record<ClocktowerGameSession['phase'], string>> = {
    setup: '等待开始',
    first_night: '第一夜',
    other_night: `第 ${game.day} 夜`,
    dawn: `第 ${game.day} 天天亮`,
    day_whispers: '私聊阶段',
    day_discussion: '公开讨论',
    nomination: '提名阶段',
    accusation: '指控',
    defense: '辩护',
    vote: '公开投票',
    execution: '处决结算',
    day_end: '白天结束',
    ended: '游戏结束'
  };
  return labels[game.phase] ?? game.phase;
}

function clocktowerStatusLabel(game: ClocktowerGameSession): string {
  if (game.status === 'ended') return game.winner ? `${game.winner === 'good' ? '善良' : '邪恶'}胜利` : '已结束';
  if (game.status === 'paused') return '已中断';
  if (game.status === 'error') return '异常暂停';
  if (game.status === 'waiting_human') return '等待你的行动';
  return clocktowerPhaseLabel(game);
}

function clocktowerHumanPlayer(game: ClocktowerGameSession) {
  return game.players.find((player) => player.controller === 'human');
}

function clocktowerVisibleEvents(game: ClocktowerGameSession) {
  const human = clocktowerHumanPlayer(game);
  return game.events.filter((event) => {
    if (event.visibility.type === 'public') return true;
    if (event.visibility.type === 'post_game') return game.status === 'ended';
    if (event.visibility.type === 'private') return Boolean(human && event.visibility.seats.includes(human.seat));
    return false;
  });
}

function clocktowerHumanTextTurn(pending?: ClocktowerPendingHumanAction): boolean {
  if (!pending) return false;
  return pending.expectedActions.length === 0 || pending.kind === 'whisper';
}

function renderClocktowerScript(): void {
  const body = el<HTMLElement>('clocktowerScriptBody');
  body.replaceChildren();
  const groups: Array<[string, ClocktowerRoleId[]]> = [
    ['镇民 · Townsfolk', TROUBLE_BREWING_ROLES.filter((role) => role.type === 'townsfolk').map((role) => role.id)],
    ['外来者 · Outsiders', TROUBLE_BREWING_ROLES.filter((role) => role.type === 'outsider').map((role) => role.id)],
    ['爪牙 · Minions', TROUBLE_BREWING_ROLES.filter((role) => role.type === 'minion').map((role) => role.id)],
    ['恶魔 · Demon', TROUBLE_BREWING_ROLES.filter((role) => role.type === 'demon').map((role) => role.id)]
  ];
  for (const [label, ids] of groups) {
    const section = document.createElement('section');
    section.className = 'clocktower-script-group';
    const heading = document.createElement('h3');
    heading.textContent = label;
    const grid = document.createElement('div');
    grid.className = 'clocktower-script-grid';
    for (const roleId of ids) {
      const role = clocktowerRoleById[roleId];
      const row = document.createElement('div');
      row.className = `clocktower-role-row ${role.type}`;
      const bar = document.createElement('span');
      bar.className = 'clocktower-role-bar';
      const content = document.createElement('div');
      const name = document.createElement('div');
      name.className = 'clocktower-role-name';
      const title = document.createElement('span');
      title.textContent = role.name;
      const timing = document.createElement('span');
      timing.className = 'clocktower-role-timing';
      timing.textContent = role.timing;
      name.append(title, timing);
      const description = document.createElement('div');
      description.className = 'clocktower-role-description';
      description.textContent = role.publicDescription;
      content.append(name, description);
      row.append(bar, content);
      grid.append(row);
    }
    section.append(heading, grid);
    body.append(section);
  }
}

function renderClocktowerSetup(): void {
  messagesEl.replaceChildren();
  const card = document.createElement('section');
  card.className = 'werewolf-setup-card';
  const icon = document.createElement('img');
  icon.src = chrome.runtime.getURL('SVG/迷雾议会.svg');
  icon.alt = '';
  const title = document.createElement('h3');
  title.textContent = 'AI 迷雾议会';
  const setup = state.clocktowerSetup;
  const neededAi = setup.playerCount - (setup.includeHuman ? 1 : 0);
  const selected = state.settings.clocktowerProviders.filter((provider) => providerById[provider]?.enabled);
  const body = document.createElement('p');
  body.textContent = `${setup.playerCount} 人 · 经典身份剧本 · ${setup.setupMode === 'curated' ? '推荐阵容' : '随机合法阵容'} · ${setup.includeHuman ? '你 + ' : ''}${neededAi} 个 AI 玩家。已选择 ${selected.length} 个模型，开始时为每名 AI 创建独立网页会话。`;
  card.append(icon, title, body);
  messagesEl.append(card);
}

function renderClocktowerHumanActionPanel(game: ClocktowerGameSession, pending: ClocktowerPendingHumanAction, dashboard: HTMLElement): void {
  const panel = document.createElement('div');
  panel.className = 'clocktower-human-actions';
  const intro = document.createElement('div');
  intro.style.width = '100%';
  intro.style.fontSize = '11px';
  intro.style.color = 'var(--muted)';
  intro.textContent = pending.prompt.includes('[CURRENT TURN]') ? `轮到你行动 · ${clocktowerPhaseLabel(game)}` : pending.prompt;
  panel.append(intro);

  const submitDirect = (actionType: ClocktowerActionType, targetSeats?: number[]) => void submitClocktowerHumanAction({ actionType, targetSeats });
  if (pending.expectedActions.includes('vote_yes')) {
    const yes = document.createElement('button');
    yes.type = 'button';
    yes.className = 'clocktower-target-button';
    yes.textContent = '投票';
    yes.addEventListener('click', () => submitDirect('vote_yes'));
    const no = document.createElement('button');
    no.type = 'button';
    no.className = 'clocktower-target-button';
    no.textContent = '不投';
    no.addEventListener('click', () => submitDirect('vote_no'));
    panel.append(yes, no);
  }

  const targetAction = pending.expectedActions.find((action) => ['choose_player', 'choose_players', 'nominate', 'slay'].includes(action));
  if (targetAction) {
    if (targetAction === 'choose_players') {
      for (const target of pending.allowedTargets) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `clocktower-target-button ${clocktowerSelectedTargets.includes(target) ? 'active' : ''}`;
        button.textContent = `${target}号`;
        button.addEventListener('click', () => {
          if (clocktowerSelectedTargets.includes(target)) clocktowerSelectedTargets = clocktowerSelectedTargets.filter((seat) => seat !== target);
          else if (clocktowerSelectedTargets.length < pending.maxTargets) clocktowerSelectedTargets = [...clocktowerSelectedTargets, target];
          renderMode();
        });
        panel.append(button);
      }
      const submit = document.createElement('button');
      submit.type = 'button';
      submit.className = 'primary-button';
      submit.textContent = '确认';
      submit.disabled = clocktowerSelectedTargets.length < pending.minTargets || clocktowerSelectedTargets.length > pending.maxTargets;
      submit.addEventListener('click', () => submitDirect('choose_players', [...clocktowerSelectedTargets]));
      panel.append(submit);
    } else {
      for (const target of pending.allowedTargets) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'clocktower-target-button';
        button.textContent = `${targetAction === 'nominate' ? '提名 ' : targetAction === 'slay' ? '发动技能 ' : '选择 '}${target}号`;
        button.addEventListener('click', () => submitDirect(targetAction, [target]));
        panel.append(button);
      }
    }
  }
  if (pending.expectedActions.includes('pass')) {
    const pass = document.createElement('button');
    pass.type = 'button';
    pass.className = 'clocktower-target-button';
    pass.textContent = '跳过';
    pass.addEventListener('click', () => submitDirect('pass'));
    panel.append(pass);
  }
  if (pending.kind === 'whisper' && pending.expectedActions.includes('whisper')) {
    const hint = document.createElement('div');
    hint.style.width = '100%';
    hint.style.fontSize = '10px';
    hint.style.color = 'var(--muted)';
    hint.textContent = '先在下方输入私聊内容，再选择目标座位。';
    panel.append(hint);
    for (const target of pending.allowedTargets) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `clocktower-target-button ${clocktowerSelectedTargets[0] === target ? 'active' : ''}`;
      button.textContent = `${target}号`;
      button.addEventListener('click', () => { clocktowerSelectedTargets = [target]; renderMode(); });
      panel.append(button);
    }
  }
  dashboard.append(panel);
}

function renderClocktowerGame(game: ClocktowerGameSession): void {
  messagesEl.replaceChildren();
  const dashboard = document.createElement('section');
  dashboard.className = 'werewolf-dashboard';
  const hero = document.createElement('div');
  hero.className = 'werewolf-hero';
  const heroTitle = document.createElement('div');
  heroTitle.className = 'werewolf-hero-title';
  const title = document.createElement('span');
  title.textContent = game.title;
  const status = document.createElement('span');
  status.textContent = clocktowerStatusLabel(game);
  status.style.color = game.status === 'error' || game.status === 'paused' ? 'var(--danger)' : 'var(--muted)';
  status.style.fontSize = '10px';
  heroTitle.append(title, status);
  const sub = document.createElement('div');
  sub.className = 'werewolf-hero-sub';
  sub.textContent = `经典身份剧本 · ${game.rulesetSnapshot.playerCount} 人 · 第 ${game.day} 天 · ${clocktowerPhaseLabel(game)} · Final-only`;
  hero.append(heroTitle, sub);
  dashboard.append(hero);

  const human = clocktowerHumanPlayer(game);
  if (human) {
    const card = document.createElement('div');
    card.className = 'clocktower-private-card';
    const perceived = clocktowerRoleById[human.perceivedCharacter];
    let extra = '';
    if (!game.rulesetSnapshot.teensyvilleEvilInfo && human.alignment === 'evil') {
      if (human.trueCharacter === 'imp') {
        const minions = game.players.filter((player) => clocktowerRoleById[player.trueCharacter].type === 'minion').map((player) => `${player.seat}号`).join('、');
        extra = ` 爪牙：${minions || '无'}；安全伪装：${game.demonBluffs.map((role) => clocktowerRoleById[role].name).join('、')}。`;
      } else {
        const demon = game.players.find((player) => player.trueCharacter === 'imp');
        extra = ` 恶魔：${demon?.seat ?? '?'}号。`;
      }
    }
    card.textContent = `你是 ${human.seat}号 · ${perceived.name} · ${human.alignment === 'good' ? '善良' : '邪恶'}阵营。能力：${perceived.publicDescription}${extra}`;
    dashboard.append(card);
  }

  const seats = document.createElement('div');
  seats.className = 'werewolf-seat-grid';
  for (const player of [...game.players].sort((a, b) => a.seat - b.seat)) {
    const publicAlive = publiclyAlive(game, player);
    const seat = document.createElement('div');
    seat.className = `werewolf-seat ${publicAlive ? '' : 'dead'} ${player.controller === 'human' ? 'human' : ''}`;
    if (player.providerId) {
      const avatar = document.createElement('img');
      avatar.src = providerIconUrl(player.providerId);
      avatar.alt = '';
      seat.append(avatar);
    } else {
      const humanAvatar = document.createElement('div');
      humanAvatar.textContent = '你';
      humanAvatar.style.fontWeight = '650';
      seat.append(humanAvatar);
    }
    const name = document.createElement('strong');
    name.textContent = `${player.seat}号 · ${player.controller === 'human' ? '你' : providerLabel(player.providerId)}`;
    const role = document.createElement('span');
    role.textContent = game.status === 'ended'
      ? clocktowerRoleById[player.trueCharacter].name
      : player.controller === 'human' ? clocktowerRoleById[player.perceivedCharacter].name
        : publicAlive ? '身份隐藏' : '已死亡';
    seat.append(name, role);
    if (!publicAlive) {
      const vote = document.createElement('span');
      vote.className = 'clocktower-dead-vote';
      vote.textContent = player.deadVoteAvailable ? '死者票可用' : '死者票已用';
      seat.append(vote);
    }
    seats.append(seat);
  }
  dashboard.append(seats);

  if (game.nominations.length) {
    const latest = game.nominations.filter((item) => item.day === game.day).at(-1);
    if (latest) {
      const nomination = document.createElement('div');
      nomination.className = 'clocktower-nomination';
      nomination.textContent = `今日最近提名：${latest.nominatorSeat}号 → ${latest.nomineeSeat}号 · ${latest.resolved ? `${latest.voteCount}票 / 门槛${latest.threshold}` : '进行中'}${game.aboutToDieSeat ? ` · 当前待处决：${game.aboutToDieSeat}号` : ''}`;
      dashboard.append(nomination);
    }
  }

  const events = document.createElement('div');
  events.className = 'werewolf-events';
  for (const event of clocktowerVisibleEvents(game)) {
    if (!event.content || event.type === 'phase') continue;
    const row = document.createElement('article');
    const author = event.authorSeat ? game.players.find((player) => player.seat === event.authorSeat) : undefined;
    row.className = `werewolf-event ${event.visibility.type === 'private' ? 'private' : ''} ${author?.providerId ? providerById[author.providerId].colorClass : ''}`;
    const meta = document.createElement('div');
    meta.className = 'werewolf-event-meta';
    meta.textContent = event.authorSeat
      ? `${event.authorSeat}号 · ${author?.controller === 'human' ? '你' : providerLabel(author?.providerId)}`
      : event.visibility.type === 'private' ? '私密信息' : '说书人';
    const body = document.createElement('div');
    body.className = 'werewolf-event-body';
    body.innerHTML = renderMarkdown(event.content);
    decorateRenderedMarkdown(body);
    row.append(meta, body);
    if (author?.controller === 'ai') row.append(createReplyActions(event.content));
    events.append(row);
  }
  dashboard.append(events);

  if (game.pendingTurn) {
    const thinking = document.createElement('div');
    thinking.className = 'werewolf-thinking';
    const hidden = game.phase === 'first_night' || game.phase === 'other_night';
    thinking.textContent = hidden ? '夜间行动处理中…' : `${game.pendingTurn.seat}号正在行动…`;
    dashboard.append(thinking);
  }
  if (game.pendingHumanAction) renderClocktowerHumanActionPanel(game, game.pendingHumanAction, dashboard);
  messagesEl.append(dashboard);
  requestAnimationFrame(() => { messagesEl.scrollTop = messagesEl.scrollHeight; });
}

function renderClocktower(): void {
  const game = activeClocktowerGame();
  if (!game) renderClocktowerSetup();
  else renderClocktowerGame(game);
}

function renderMessages(): void {
  if (state.activeMode === 'werewolf') {
    renderWerewolf();
    return;
  }
  if (state.activeMode === 'clocktower') {
    renderClocktower();
    return;
  }
  const session = activeSession();
  messagesEl.replaceChildren();
  if (!session.messages.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = session.mode === 'qa'
      ? '同时向多个 AI 提问，回复会按模型分别显示。'
      : session.mode === 'roundtable'
        ? '输入问题并设置轮数，AI 会按设置顺序依次接力。'
        : '选择专家预设后开始讨论。专家提示词只在各模型首次发言时注入，不写入会话正文。';
    messagesEl.appendChild(empty);
    return;
  }

  for (const message of session.messages) {
    const row = document.createElement('article');
    row.className = `message-row ${message.role}`;
    if (message.provider) row.classList.add(providerById[message.provider].colorClass);

    const meta = document.createElement('div');
    meta.className = 'message-meta';
    if (message.role === 'assistant' && message.provider) {
      const icon = document.createElement('img');
      icon.className = 'provider-avatar';
      icon.src = providerIconUrl(message.provider);
      icon.alt = '';
      meta.append(icon);
    }
    const author = document.createElement('span');
    author.textContent = message.role === 'user' ? '你' : providerDisplayLabel(session, message.provider);
    meta.append(author);

    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';
    if (message.role === 'assistant') {
      bubble.innerHTML = renderMarkdown(message.text || (message.status === 'pending' ? '…' : ''));
      decorateRenderedMarkdown(bubble);
    } else {
      const text = document.createElement('div');
      text.textContent = message.text;
      bubble.append(text);
    }

    if (message.attachments?.length) {
      const files = document.createElement('div');
      files.className = 'message-status';
      files.textContent = message.attachments.map((item) => `${item.kind === 'image' ? '图片' : '附件'}：${item.name}`).join(' · ');
      bubble.append(files);
    }

    row.append(meta, bubble);
    if (message.role === 'assistant' && message.text.trim()) row.append(createReplyActions(message.text));
    if (message.status && message.status !== 'completed') {
      const status = document.createElement('div');
      status.className = `message-status ${message.status === 'error' ? 'error' : ''}`;
      status.textContent = message.status === 'pending'
        ? '等待回复'
        : message.status === 'streaming'
          ? '生成中'
          : message.status === 'interrupted'
            ? '已中断'
            : message.error ?? '发送失败';
      row.append(status);
    }
    messagesEl.append(row);
  }
  requestAnimationFrame(() => { messagesEl.scrollTop = messagesEl.scrollHeight; });
}

function renderSequentialControls(): void {
  const session = activeSession();
  if (!isSequentialMode(session.mode)) return;
  const rounds = Math.max(1, Math.min(99, Number(session.rounds) || 1));
  roundNumber.value = String(rounds);
  roundRange.value = String(Math.min(8, rounds));
  const execution = session.execution;
  roundActionButton.textContent = execution?.status === 'running' ? '中断' : execution?.status === 'paused' ? '继续' : '开始';
  roundActionButton.classList.toggle('danger', execution?.status === 'running');
  if (execution?.status === 'running') {
    const operation = execution.currentOperationId ? session.pendingOperations?.[execution.currentOperationId] : undefined;
    const provider = operation?.provider ?? execution.providers[execution.providerIndex];
    roundtableStatus.textContent = `${provider ? `正在等待 ${providerDisplayLabel(session, provider)}` : '准备中'} · ${execution.roundIndex + 1}/${execution.targetRounds} 轮`;
  } else if (execution?.status === 'paused') {
    roundtableStatus.textContent = `已中断，可继续 · ${Math.min(execution.roundIndex + 1, execution.targetRounds)}/${execution.targetRounds} 轮`;
  } else {
    roundtableStatus.textContent = '待开始';
  }
}

function renderWerewolfControls(): void {
  const game = activeWerewolfGame();
  const actionButton = el<HTMLButtonElement>('werewolfActionButton');
  const status = el<HTMLElement>('werewolfStatus');
  const composer = el<HTMLElement>('composer');
  const attachButton = el<HTMLButtonElement>('attachButton');
  const humanSend = el<HTMLButtonElement>('werewolfHumanSendButton');
  const textTurn = humanTextTurn(game?.pendingHumanAction);

  composer.classList.toggle('hidden', !textTurn);
  composer.classList.toggle('werewolf-human-composer', textTurn);
  attachButton.classList.toggle('hidden', true);
  qaSendButton.classList.add('hidden');
  humanSend.classList.toggle('hidden', !textTurn);
  attachmentTray.classList.add('hidden');
  messageInput.placeholder = textTurn
    ? (game?.pendingHumanAction?.kind === 'last_word' ? '输入你的遗言…' : game?.pendingHumanAction?.kind === 'wolf_discussion' ? '输入狼人私密讨论内容…' : '输入你的公开发言…')
    : '输入消息…';
  messageInput.rows = 2;

  if (!game) {
    actionButton.textContent = '开始';
    actionButton.classList.remove('danger');
    status.textContent = `${state.werewolfSetup.playerCount} 人局 · 待开始`;
    return;
  }
  actionButton.textContent = game.status === 'running' || game.status === 'waiting_human'
    ? '中断'
    : game.status === 'paused' || game.status === 'error'
      ? '继续'
      : game.status === 'ended' ? '新局' : '开始';
  actionButton.classList.toggle('danger', game.status === 'running' || game.status === 'waiting_human');
  status.textContent = game.status === 'running' ? werewolfPhaseLabelForHuman(game) : werewolfStatusLabel(game);
}

async function handleWerewolfAction(): Promise<void> {
  const game = activeWerewolfGame();
  try {
    if (!game) {
      const setup = state.werewolfSetup;
      const needed = setup.playerCount - (setup.includeHuman ? 1 : 0);
      const providers = state.settings.werewolfProviders.filter((provider) => providerById[provider]?.enabled);
      if (providers.length < needed) return showComposerError(`当前 ${setup.playerCount} 人配置至少需要 ${needed} 个已接入 AI 模型`);
      await refreshProviderAvailability(providers.slice(0, needed), false);
      const normalized: WerewolfSetupSettings = {
        ...setup,
        providerIds: providers,
        presetId: `werewolf-v1-${setup.playerCount}`
      };
      const response = await runtimeMessage<{ success: true; gameId: string }>({ type: 'CREATE_WEREWOLF_GAME', setup: normalized });
      state.activeWerewolfGameId = response.gameId;
      await runtimeMessage({ type: 'START_WEREWOLF_GAME', gameId: response.gameId });
      return;
    }
    if (game.status === 'running' || game.status === 'waiting_human') {
      await runtimeMessage({ type: 'INTERRUPT_WEREWOLF_GAME', gameId: game.id });
      return;
    }
    if (game.status === 'paused' || game.status === 'error') {
      await runtimeMessage({ type: 'RESUME_WEREWOLF_GAME', gameId: game.id });
      return;
    }
    if (game.status === 'ended') {
      await runtimeMessage({ type: 'SET_ACTIVE_WEREWOLF_GAME' });
      state.activeWerewolfGameId = undefined;
      renderMode();
      return;
    }
    await runtimeMessage({ type: 'START_WEREWOLF_GAME', gameId: game.id });
  } catch (error) {
    showComposerError(error instanceof Error ? error.message : String(error));
  }
}

async function handleWerewolfHumanTextSend(): Promise<void> {
  const game = activeWerewolfGame();
  if (!game?.pendingHumanAction || !humanTextTurn(game.pendingHumanAction)) return;
  const text = messageInput.value.trim();
  if (!text) return showComposerError('请输入你的发言');
  await submitWerewolfHumanAction({ text });
}

function renderClocktowerControls(): void {
  const game = activeClocktowerGame();
  const actionButton = el<HTMLButtonElement>('clocktowerActionButton');
  const status = el<HTMLElement>('clocktowerStatus');
  const composer = el<HTMLElement>('composer');
  const attachButton = el<HTMLButtonElement>('attachButton');
  const humanSend = el<HTMLButtonElement>('clocktowerHumanSendButton');
  const textTurn = clocktowerHumanTextTurn(game?.pendingHumanAction);

  composer.classList.toggle('hidden', !textTurn);
  composer.classList.toggle('werewolf-human-composer', textTurn);
  attachButton.classList.toggle('hidden', true);
  qaSendButton.classList.add('hidden');
  humanSend.classList.toggle('hidden', !textTurn);
  attachmentTray.classList.add('hidden');
  messageInput.rows = 2;
  messageInput.placeholder = game?.pendingHumanAction?.kind === 'whisper' ? '输入私聊内容…' : textTurn ? '输入你的发言…' : '输入消息…';

  if (!game) {
    actionButton.textContent = '开始';
    actionButton.classList.remove('danger');
    status.textContent = `${state.clocktowerSetup.playerCount} 人 · 待开始`;
    return;
  }
  actionButton.textContent = game.status === 'running' || game.status === 'waiting_human'
    ? '中断'
    : game.status === 'paused' || game.status === 'error'
      ? '继续'
      : game.status === 'ended' ? '新局' : '开始';
  actionButton.classList.toggle('danger', game.status === 'running' || game.status === 'waiting_human');
  status.textContent = clocktowerStatusLabel(game);
}

async function handleClocktowerAction(): Promise<void> {
  const game = activeClocktowerGame();
  try {
    if (!game) {
      const setup = state.clocktowerSetup;
      const needed = setup.playerCount - (setup.includeHuman ? 1 : 0);
      const providers = state.settings.clocktowerProviders.filter((provider) => providerById[provider]?.enabled);
      if (providers.length < needed) return showComposerError(`当前 ${setup.playerCount} 人配置至少需要 ${needed} 个已接入 AI 模型`);
      const selectedProviders = providers.slice(0, needed);
      await refreshProviderAvailability(selectedProviders, false);
      rejectKnownBrokenProviders(selectedProviders);
      const normalized: ClocktowerSetupSettings = { ...setup, providerIds: selectedProviders };
      const response = await runtimeMessage<{ success: true; gameId: string }>({ type: 'CREATE_CLOCKTOWER_GAME', setup: normalized });
      state.activeClocktowerGameId = response.gameId;
      await runtimeMessage({ type: 'START_CLOCKTOWER_GAME', gameId: response.gameId });
      return;
    }
    if (game.status === 'running' || game.status === 'waiting_human') {
      await runtimeMessage({ type: 'INTERRUPT_CLOCKTOWER_GAME', gameId: game.id });
      return;
    }
    if (game.status === 'error' && game.phase === 'setup') {
      await runtimeMessage({ type: 'START_CLOCKTOWER_GAME', gameId: game.id });
      return;
    }
    if (game.status === 'paused' || game.status === 'error') {
      await runtimeMessage({ type: 'RESUME_CLOCKTOWER_GAME', gameId: game.id });
      return;
    }
    if (game.status === 'ended') {
      await runtimeMessage({ type: 'SET_ACTIVE_CLOCKTOWER_GAME' });
      state.activeClocktowerGameId = undefined;
      renderMode();
      return;
    }
    await runtimeMessage({ type: 'START_CLOCKTOWER_GAME', gameId: game.id });
  } catch (error) {
    showComposerError(error instanceof Error ? error.message : String(error));
  }
}

async function handleClocktowerHumanTextSend(): Promise<void> {
  const game = activeClocktowerGame();
  const pending = game?.pendingHumanAction;
  if (!pending || !clocktowerHumanTextTurn(pending)) return;
  const text = messageInput.value.trim();
  if (!text) return showComposerError(pending.kind === 'whisper' ? '请输入私聊内容' : '请输入你的发言');
  if (pending.kind === 'whisper' && pending.expectedActions.includes('whisper')) {
    const target = clocktowerSelectedTargets[0];
    if (!target) return showComposerError('请先选择私聊目标');
    await submitClocktowerHumanAction({ text, actionType: 'whisper', targetSeats: [target] });
    return;
  }
  await submitClocktowerHumanAction({ text });
}

function renderMode(): void {
  document.querySelectorAll<HTMLButtonElement>('.mode-tab').forEach((tab) => tab.classList.toggle('active', tab.dataset.mode === state.activeMode));
  const sequential = isSequentialMode(state.activeMode);
  const werewolf = state.activeMode === 'werewolf';
  const clocktower = state.activeMode === 'clocktower';
  roundControls.classList.toggle('hidden', !sequential);
  el<HTMLElement>('werewolfControls').classList.toggle('hidden', !werewolf);
  el<HTMLElement>('clocktowerControls').classList.toggle('hidden', !clocktower);
  qaSendButton.classList.toggle('hidden', sequential || werewolf || clocktower);
  el<HTMLButtonElement>('werewolfHumanSendButton').classList.add('hidden');
  el<HTMLButtonElement>('clocktowerHumanSendButton').classList.add('hidden');
  if (!werewolf && !clocktower) {
    el<HTMLElement>('composer').classList.remove('hidden');
    el<HTMLButtonElement>('attachButton').classList.remove('hidden');
    messageInput.placeholder = '输入消息，或粘贴图片/附件…';
  }
  el<HTMLButtonElement>('newConversationButton').title = state.activeMode === 'werewolf' ? '新狼人杀对局' : state.activeMode === 'clocktower' ? '新迷雾议会对局' : `新${modeLabel(state.activeMode)}会话`;
  renderMessages();
  if (sequential) renderSequentialControls();
  if (werewolf) renderWerewolfControls();
  if (clocktower) renderClocktowerControls();
}

function renderAttachmentTray(): void {
  attachmentTray.replaceChildren();
  attachmentTray.classList.toggle('hidden', draftAttachments.length === 0);
  for (const attachment of draftAttachments) {
    const chip = document.createElement('div');
    chip.className = 'attachment-chip';
    const name = document.createElement('span');
    name.textContent = `${attachment.kind === 'image' ? '图片' : '附件'} · ${attachment.name}`;
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.textContent = '×';
    remove.addEventListener('click', () => {
      draftAttachments = draftAttachments.filter((item) => item.id !== attachment.id);
      renderAttachmentTray();
    });
    chip.append(name, remove);
    attachmentTray.append(chip);
  }
}

async function fileToAttachment(file: File): Promise<AttachmentPayload> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('读取文件失败'));
    reader.readAsDataURL(file);
  });
  return {
    id: id('attachment'),
    name: file.name || '剪贴板图片',
    type: file.type,
    size: file.size,
    dataUrl,
    kind: file.type.startsWith('image/') ? 'image' : 'attachment'
  };
}

async function addFiles(files: FileList | File[]): Promise<void> {
  const added = await Promise.all([...files].map(fileToAttachment));
  draftAttachments.push(...added);
  renderAttachmentTray();
}

function takeComposerPayload(): ComposerPayload | null {
  const text = messageInput.value.trim();
  if (!text && !draftAttachments.length) return null;
  return { text, attachments: draftAttachments.map((item) => ({ ...item })) };
}

function clearComposer(): void {
  messageInput.value = '';
  messageInput.style.height = '';
  draftAttachments = [];
  fileInput.value = '';
  renderAttachmentTray();
}

function attachmentMetadata(payload: ComposerPayload) {
  return payload.attachments.map(({ id, name, type, size, kind }) => ({ id, name, type, size, kind }));
}

async function runtimeMessage<T = any>(message: unknown): Promise<T> {
  const response = await chrome.runtime.sendMessage(message) as T & { success?: boolean; error?: string };
  if (response && response.success === false) throw new Error(response.error || '扩展操作失败');
  return response;
}

async function refreshProviderAvailability(providers: ProviderId[], rerenderSettings = true): Promise<void> {
  const unique = [...new Set(providers)].filter((provider) => providerById[provider]?.enabled);
  if (!unique.length) return;
  try {
    const response = await runtimeMessage<{
      statuses: Array<{ provider: ProviderId; state: ProviderAvailabilityState; connected: boolean; reason?: string }>;
    }>({ type: 'GET_PROVIDER_STATUS', providers: unique });
    for (const status of response.statuses ?? []) {
      providerAvailability.set(status.provider, {
        state: status.state,
        connected: status.connected,
        reason: status.reason
      });
    }
  } catch {
    for (const provider of unique) {
      if (!providerAvailability.has(provider)) providerAvailability.set(provider, { state: 'unknown', connected: false, reason: '状态检测失败' });
    }
  }
  if (rerenderSettings && !el<HTMLElement>('settingsOverlay').classList.contains('hidden')) renderSettings();
}

function rejectKnownBrokenProviders(providers: ProviderId[]): void {
  const broken = providers
    .map((provider) => ({ provider, status: providerAvailability.get(provider) }))
    .filter(({ status }) => status?.state === 'error');
  if (!broken.length) return;
  const detail = broken
    .map(({ provider, status }) => `${providerLabel(provider)}：${status?.reason || '当前不可用'}`)
    .join('；');
  throw new Error(`以下模型当前不可用：${detail}`);
}

function updateMessage(sessionId: string, messageId: string, patch: Partial<ChatMessage>): void {
  const session = sessionById(sessionId);
  const message = session?.messages.find((item) => item.id === messageId);
  if (!session || !message) return;
  Object.assign(message, patch);
  touchSession(session);
  if (isActiveConversation(session)) renderMessages();
  void saveState(state);
}

function waitForProvider(session: ConversationSession, provider: ProviderId, payload: ComposerPayload, tabId?: number): Promise<string> {
  const operationId = id('op');
  const message: ChatMessage = { id: id('msg'), role: 'assistant', provider, text: '', createdAt: Date.now(), status: 'pending' };
  session.messages.push(message);
  touchSession(session);
  if (isActiveConversation(session)) renderMessages();

  return new Promise<string>((resolve, reject) => {
    pendingOperations.set(operationId, { messageId: message.id, sessionId: session.id, provider, mode: session.mode, resolve, reject });
    if (isSequentialMode(session.mode)) {
      currentOperationId = operationId;
      currentProvider = provider;
      currentSequentialSessionId = session.id;
      if (isActiveConversation(session)) renderSequentialControls();
    }
    const binding = session.bindings[provider];
    runtimeMessage({ type: 'SEND_TO_PROVIDER', provider, operationId, payload, tabId, conversationUrl: binding?.conversationUrl })
      .catch((error: Error) => {
        pendingOperations.delete(operationId);
        updateMessage(session.id, message.id, { status: 'error', error: error.message });
        reject(error);
      });
  });
}

function onProviderEvent(event: ProviderEvent): void {
  const operationId = event.operationId;
  if (!operationId) return;
  const pending = pendingOperations.get(operationId);
  if (!pending) return;
  const session = sessionById(pending.sessionId);
  if (!session) return;
  if (event.tabId) {
    const existing = session.bindings[event.provider];
    session.bindings[event.provider] = {
      provider: event.provider,
      tabId: event.tabId,
      conversationUrl: event.url || existing?.conversationUrl
    };
  }
  if (event.type === 'PROVIDER_RESPONSE_STARTED') updateMessage(session.id, pending.messageId, { status: 'streaming' });
  if (event.type === 'PROVIDER_RESPONSE_DELTA') updateMessage(session.id, pending.messageId, { text: event.text ?? '', status: 'streaming' });
  if (event.type === 'PROVIDER_RESPONSE_COMPLETED') {
    const text = event.text ?? '';
    updateMessage(session.id, pending.messageId, { text, status: 'completed' });
    pendingOperations.delete(operationId);
    pending.resolve(text);
  }
  if (event.type === 'PROVIDER_ERROR') {
    const error = new Error(event.error || `${providerLabel(pending.provider)} 执行失败`);
    updateMessage(session.id, pending.messageId, { status: 'error', error: error.message });
    pendingOperations.delete(operationId);
    pending.reject(error);
  }
}

async function ensureSessionBindings(session: ConversationSession, providers: ProviderId[]): Promise<void> {
  const bindings = { ...session.bindings };
  if (session.needsFreshConversations) {
    const created = await Promise.all(providers.map(async (provider) => {
      const response = await runtimeMessage<{ success: boolean; tabId: number; conversationUrl?: string }>({
        type: 'CREATE_FRESH_CONVERSATION', provider, tabId: bindings[provider]?.tabId
      });
      return [provider, { provider, tabId: response.tabId, conversationUrl: response.conversationUrl }] as const;
    }));
    for (const [provider, binding] of created) bindings[provider] = binding;
    session.bindings = bindings;
    session.needsFreshConversations = false;
    touchSession(session);
    await saveState(state);
    return;
  }

  const missing = providers.filter((provider) => !bindings[provider]);
  const created = await Promise.all(missing.map(async (provider) => {
    const response = await runtimeMessage<{ success: boolean; tabId: number; conversationUrl?: string }>({ type: 'CREATE_FRESH_CONVERSATION', provider });
    return [provider, { provider, tabId: response.tabId, conversationUrl: response.conversationUrl }] as const;
  }));
  for (const [provider, binding] of created) bindings[provider] = binding;
  session.bindings = bindings;
  await saveState(state);
}

async function handleQaSend(): Promise<void> {
  const payload = takeComposerPayload();
  if (!payload) return;
  const session = activeSession();
  const providers = state.settings.qaProviders.filter((provider) => providerById[provider].enabled);
  if (!providers.length) return showComposerError('请先在设置里选择至少一个已接入模型');
  await refreshProviderAvailability(providers, false);
  session.messages.push({ id: id('msg'), role: 'user', text: payload.text, attachments: attachmentMetadata(payload), createdAt: Date.now(), status: 'completed' });
  if (session.title === '新会话') session.title = deriveTitle(payload);
  touchSession(session);
  clearComposer();
  renderMessages();
  await saveState(state);
  try {
    await runtimeMessage({ type: 'START_QA_SESSION', sessionId: session.id, providers, payload });
  } catch (error) {
    showComposerError(error instanceof Error ? error.message : String(error));
  }
}

function buildSequentialPrompt(session: ConversationSession, provider: ProviderId): string {
  let lastOwnIndex = -1;
  session.messages.forEach((message, index) => {
    if (message.role === 'assistant' && message.provider === provider && message.status === 'completed') lastOwnIndex = index;
  });
  const unseen = session.messages
    .slice(lastOwnIndex + 1)
    .filter((message) => message.role === 'user' || (message.role === 'assistant' && message.provider !== provider && message.status === 'completed'));
  const body = unseen.length
    ? unseen.map((message) => `【${message.role === 'user' ? '用户' : providerDisplayLabel(session, message.provider)}】\n${message.text}`).join('\n\n')
    : '请继续讨论，补充新的观点。';
  return `${body}\n\n请基于以上你尚未看到的新增内容继续讨论。避免复述已有内容，直接回应并推进讨论。`;
}

function withExpertPreset(session: ConversationSession, provider: ProviderId, prompt: string): string {
  if (session.mode !== 'expert') return prompt;
  const initialized = session.expertInitializedProviders?.includes(provider) ?? false;
  const expert = session.expertAssignments?.[provider];
  if (initialized || !expert?.prompt.trim()) return prompt;
  return `${expert.prompt.trim()}\n\n${prompt}`;
}

async function handleSequentialAction(): Promise<void> {
  const session = activeSession();
  if (!isSequentialMode(session.mode)) return;
  if (session.execution?.status === 'running') {
    await runtimeMessage({ type: 'INTERRUPT_SESSION', sessionId: session.id }).catch((error: Error) => showComposerError(error.message));
    return;
  }
  if (session.execution?.status === 'paused') {
    const supplementalPayload = takeComposerPayload();
    try {
      await refreshProviderAvailability(session.execution.providers, false);
      await runtimeMessage({
        type: 'RESUME_SEQUENTIAL_SESSION',
        sessionId: session.id,
        payload: supplementalPayload ?? undefined
      });
      if (supplementalPayload) clearComposer();
    } catch (error) {
      showComposerError(error instanceof Error ? error.message : String(error));
    }
    return;
  }

  const payload = takeComposerPayload();
  if (!payload) return showComposerError('请输入问题或添加附件');
  const providers = providersForMode(session.mode).filter((provider) => providerById[provider].enabled);
  if (providers.length < 2) return showComposerError(`${modeLabel(session.mode)}至少选择两个已接入模型`);
  await refreshProviderAvailability(providers, false);
  if (session.mode === 'expert' && session.messages.length === 0) {
    session.expertAssignments = captureExpertAssignments();
    session.expertInitializedProviders = [];
  }

  session.messages.push({ id: id('msg'), role: 'user', text: payload.text, attachments: attachmentMetadata(payload), createdAt: Date.now(), status: 'completed' });
  if (session.title === '新会话') session.title = deriveTitle(payload);
  touchSession(session);
  clearComposer();
  renderMessages();
  renderSequentialControls();
  await saveState(state);
  try {
    await runtimeMessage({
      type: 'START_SEQUENTIAL_SESSION',
      sessionId: session.id,
      providers,
      payload,
      targetRounds: Math.max(1, Math.min(99, session.rounds))
    });
  } catch (error) {
    showComposerError(error instanceof Error ? error.message : String(error));
  }
}

async function runSequential(session: ConversationSession): Promise<void> {
  const execution = session.execution;
  if (!execution) return;
  currentSequentialSessionId = session.id;
  try {
    await ensureSessionBindings(session, execution.providers);
    while (execution.status === 'running' && execution.roundIndex < execution.targetRounds) {
      const provider = execution.providers[execution.providerIndex];
      if (!provider || interruptRequested) break;
      currentProvider = provider;
      if (isActiveConversation(session)) renderSequentialControls();

      const basePrompt = buildSequentialPrompt(session, provider);
      const text = withExpertPreset(session, provider, basePrompt);
      const seen = execution.seenCurrentUserProviders.includes(provider);
      const turnPayload: ComposerPayload = { text, attachments: seen ? [] : execution.payload.attachments };
      await waitForProvider(session, provider, turnPayload, session.bindings[provider]?.tabId);

      if (interruptRequested || execution.status !== 'running') break;
      if (!seen) execution.seenCurrentUserProviders.push(provider);
      if (session.mode === 'expert' && !(session.expertInitializedProviders?.includes(provider))) {
        session.expertInitializedProviders = [...(session.expertInitializedProviders ?? []), provider];
      }

      execution.providerIndex += 1;
      if (execution.providerIndex >= execution.providers.length) {
        execution.providerIndex = 0;
        execution.roundIndex += 1;
      }
      touchSession(session);
      await saveState(state);
      if (isActiveConversation(session)) renderSequentialControls();
    }

    if (execution.status === 'running' && execution.roundIndex >= execution.targetRounds) {
      session.execution = undefined;
      touchSession(session);
      await saveState(state);
    }
  } catch (error) {
    if (session.execution) session.execution.status = 'paused';
    showComposerError(error instanceof Error ? error.message : String(error));
    await saveState(state);
  } finally {
    currentOperationId = null;
    currentProvider = null;
    currentSequentialSessionId = null;
    if (isActiveConversation(session)) renderSequentialControls();
  }
}

async function interruptSequential(session: ConversationSession): Promise<void> {
  interruptRequested = true;
  if (session.execution) session.execution.status = 'paused';
  if (currentOperationId) {
    const pending = pendingOperations.get(currentOperationId);
    if (pending && pending.sessionId === session.id) {
      updateMessage(session.id, pending.messageId, { status: 'interrupted' });
      pendingOperations.delete(currentOperationId);
      pending.resolve('');
    }
  }
  if (currentProvider) {
    const binding = session.bindings[currentProvider];
    await runtimeMessage({ type: 'CANCEL_PROVIDER', provider: currentProvider, operationId: currentOperationId, tabId: binding?.tabId }).catch(() => undefined);
  }
  currentOperationId = null;
  currentProvider = null;
  touchSession(session);
  renderSequentialControls();
  await saveState(state);
}

function showComposerError(text: string): void {
  const toast = el<HTMLElement>('toast');
  toast.textContent = text;
  toast.classList.remove('hidden');
  window.setTimeout(() => {
    toast.classList.add('hidden');
  }, 4000);
}

function providerOptionBase(providerId: ProviderId, checked: boolean): { row: HTMLDivElement; checkbox: HTMLInputElement } {
  const provider = providerById[providerId];
  const row = document.createElement('div');
  row.className = `provider-option ${provider.enabled ? '' : 'disabled'}`;
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.checked = checked;
  checkbox.disabled = !provider.enabled;
  const icon = document.createElement('img');
  icon.className = 'provider-setting-icon';
  icon.src = providerIconUrl(providerId);
  icon.alt = '';
  const name = document.createElement('span');
  name.className = 'provider-option-name';
  name.textContent = provider.label;
  const availability = providerAvailability.get(providerId);
  const statusDot = document.createElement('span');
  const statusState: ProviderAvailabilityState = availability?.state ?? 'unknown';
  statusDot.className = `provider-status-dot ${statusState}`;
  statusDot.setAttribute('aria-label', availability?.reason ?? (statusState === 'ready' ? '已登录，可用' : statusState === 'error' ? '不可用或未登录' : '未检测或页面未打开'));
  statusDot.title = availability?.reason ?? (statusState === 'ready' ? '已登录，可用' : statusState === 'error' ? '不可用或未登录' : '未检测或页面未打开');
  row.append(checkbox, icon, name, statusDot);
  if (!provider.enabled) {
    const badge = document.createElement('small');
    badge.textContent = '待接入';
    row.append(badge);
  }
  return { row, checkbox };
}

function renderQaSettings(): void {
  const container = el<HTMLElement>('qaProviderSettings');
  container.replaceChildren();
  for (const provider of PROVIDERS) {
    const { row, checkbox } = providerOptionBase(provider.id, state.settings.qaProviders.includes(provider.id));
    checkbox.addEventListener('change', async () => {
      const set = new Set(state.settings.qaProviders);
      checkbox.checked ? set.add(provider.id) : set.delete(provider.id);
      state.settings.qaProviders = PROVIDERS.map((item) => item.id).filter((providerId) => set.has(providerId));
      await saveState(state);
    });
    container.append(row);
  }
}

function selectedProviders(mode: SequentialMode): ProviderId[] {
  void mode;
  return state.settings.roundtableProviders;
}

function setSelectedProviders(mode: SequentialMode, providers: ProviderId[]): void {
  void mode;
  state.settings.roundtableProviders = providers;
}

function syncBlankExpertSessionAssignments(): void {
  const session = ensureActiveSession('expert');
  if (!session.messages.length) session.expertAssignments = captureExpertAssignments();
}

function renderSequentialSettings(mode: SequentialMode, containerId: string): void {
  const container = el<HTMLElement>(containerId);
  container.replaceChildren();
  const selected = selectedProviders(mode);
  const ordered = [...selected.map((providerId) => providerById[providerId]).filter(Boolean), ...PROVIDERS.filter((provider) => !selected.includes(provider.id))];

  for (const provider of ordered) {
    const { row, checkbox } = providerOptionBase(provider.id, selected.includes(provider.id));
    checkbox.addEventListener('change', async () => {
      const next = [...selectedProviders(mode)];
      if (checkbox.checked && !next.includes(provider.id)) next.push(provider.id);
      if (!checkbox.checked) {
        const index = next.indexOf(provider.id);
        if (index >= 0) next.splice(index, 1);
      }
      setSelectedProviders(mode, next);
      syncBlankExpertSessionAssignments();
      await saveState(state);
      renderSequentialSettings(mode, containerId);
    });

    if (provider.enabled) {
      const select = document.createElement('select');
      select.className = 'expert-select';
      select.title = '选择专家预设';
      const none = document.createElement('option');
      none.value = '';
      none.textContent = 'None';
      select.append(none);
      for (const preset of state.expertPresets) {
        const option = document.createElement('option');
        option.value = preset.id;
        option.textContent = preset.name;
        select.append(option);
      }
      select.value = state.settings.expertPresetByProvider[provider.id] ?? '';
      select.addEventListener('change', async () => {
        if (select.value) state.settings.expertPresetByProvider[provider.id] = select.value;
        else delete state.settings.expertPresetByProvider[provider.id];
        syncBlankExpertSessionAssignments();
        await saveState(state);
      });
      row.append(select);
    }

    if (provider.enabled && checkbox.checked) {
      const index = selectedProviders(mode).indexOf(provider.id);
      const up = document.createElement('button');
      up.type = 'button';
      up.className = 'order-button';
      up.textContent = '↑';
      up.title = '提前发言';
      up.disabled = index <= 0;
      up.addEventListener('click', async () => {
        if (index <= 0) return;
        const next = [...selectedProviders(mode)];
        [next[index - 1], next[index]] = [next[index], next[index - 1]];
        setSelectedProviders(mode, next);
        await saveState(state);
        renderSequentialSettings(mode, containerId);
      });
      const down = document.createElement('button');
      down.type = 'button';
      down.className = 'order-button';
      down.textContent = '↓';
      down.title = '延后发言';
      down.disabled = index < 0 || index >= selectedProviders(mode).length - 1;
      down.addEventListener('click', async () => {
        if (index < 0 || index >= selectedProviders(mode).length - 1) return;
        const next = [...selectedProviders(mode)];
        [next[index + 1], next[index]] = [next[index], next[index + 1]];
        setSelectedProviders(mode, next);
        await saveState(state);
        renderSequentialSettings(mode, containerId);
      });
      row.append(up, down);
    }
    container.append(row);
  }
}

async function persistWerewolfSettings(): Promise<void> {
  state.werewolfSetup.providerIds = [...state.settings.werewolfProviders];
  state.werewolfSetup.presetId = `werewolf-v1-${state.werewolfSetup.playerCount}`;
  await saveState(state);
  await runtimeMessage({ type: 'UPDATE_WEREWOLF_SETUP', setup: state.werewolfSetup });
}

function renderWerewolfSettings(): void {
  const container = el<HTMLElement>('werewolfProviderSettings');
  const countSelect = el<HTMLSelectElement>('werewolfPlayerCount');
  const humanToggle = el<HTMLInputElement>('werewolfIncludeHuman');
  const humanSeat = el<HTMLSelectElement>('werewolfHumanSeat');
  countSelect.value = String(state.werewolfSetup.playerCount);
  humanToggle.checked = state.werewolfSetup.includeHuman;
  humanSeat.replaceChildren();
  const randomOption = document.createElement('option');
  randomOption.value = '0';
  randomOption.textContent = '随机';
  humanSeat.append(randomOption);
  for (let seat = 1; seat <= state.werewolfSetup.playerCount; seat += 1) {
    const option = document.createElement('option');
    option.value = String(seat);
    option.textContent = `${seat}号`;
    humanSeat.append(option);
  }
  humanSeat.value = String(state.werewolfSetup.humanSeat <= state.werewolfSetup.playerCount ? state.werewolfSetup.humanSeat : 0);
  humanSeat.disabled = !state.werewolfSetup.includeHuman;

  countSelect.onchange = async () => {
    const value = Number(countSelect.value) as 6 | 7 | 8;
    state.werewolfSetup.playerCount = value;
    if (state.werewolfSetup.humanSeat > value) state.werewolfSetup.humanSeat = 0;
    await persistWerewolfSettings();
    renderWerewolfSettings();
    if (state.activeMode === 'werewolf' && !activeWerewolfGame()) renderMode();
  };
  humanToggle.onchange = async () => {
    state.werewolfSetup.includeHuman = humanToggle.checked;
    if (!humanToggle.checked) state.werewolfSetup.humanSeat = 0;
    await persistWerewolfSettings();
    renderWerewolfSettings();
    if (state.activeMode === 'werewolf' && !activeWerewolfGame()) renderMode();
  };
  humanSeat.onchange = async () => {
    state.werewolfSetup.humanSeat = Number(humanSeat.value) as WerewolfSetupSettings['humanSeat'];
    await persistWerewolfSettings();
  };

  container.replaceChildren();
  const selected = state.settings.werewolfProviders;
  const ordered = [...selected.map((providerId) => providerById[providerId]).filter(Boolean), ...PROVIDERS.filter((provider) => !selected.includes(provider.id))];
  for (const provider of ordered) {
    const { row, checkbox } = providerOptionBase(provider.id, selected.includes(provider.id));
    checkbox.addEventListener('change', async () => {
      const next = [...state.settings.werewolfProviders];
      if (checkbox.checked && !next.includes(provider.id)) next.push(provider.id);
      if (!checkbox.checked) {
        const index = next.indexOf(provider.id);
        if (index >= 0) next.splice(index, 1);
      }
      state.settings.werewolfProviders = next;
      await persistWerewolfSettings();
      renderWerewolfSettings();
      if (state.activeMode === 'werewolf' && !activeWerewolfGame()) renderMode();
    });
    if (provider.enabled && checkbox.checked) {
      const index = state.settings.werewolfProviders.indexOf(provider.id);
      const up = document.createElement('button');
      up.type = 'button';
      up.className = 'order-button';
      up.textContent = '↑';
      up.title = '提前座位顺序';
      up.disabled = index <= 0;
      up.addEventListener('click', async () => {
        if (index <= 0) return;
        const next = [...state.settings.werewolfProviders];
        [next[index - 1], next[index]] = [next[index], next[index - 1]];
        state.settings.werewolfProviders = next;
        await persistWerewolfSettings();
        renderWerewolfSettings();
      });
      const down = document.createElement('button');
      down.type = 'button';
      down.className = 'order-button';
      down.textContent = '↓';
      down.title = '延后座位顺序';
      down.disabled = index >= state.settings.werewolfProviders.length - 1;
      down.addEventListener('click', async () => {
        if (index < 0 || index >= state.settings.werewolfProviders.length - 1) return;
        const next = [...state.settings.werewolfProviders];
        [next[index + 1], next[index]] = [next[index], next[index + 1]];
        state.settings.werewolfProviders = next;
        await persistWerewolfSettings();
        renderWerewolfSettings();
      });
      row.append(up, down);
    }
    container.append(row);
  }
}

async function persistClocktowerSettings(): Promise<void> {
  state.clocktowerSetup.providerIds = [...state.settings.clocktowerProviders];
  await saveState(state);
  await runtimeMessage({ type: 'UPDATE_CLOCKTOWER_SETUP', setup: state.clocktowerSetup });
}

function renderClocktowerSettings(): void {
  const container = el<HTMLElement>('clocktowerProviderSettings');
  const countSelect = el<HTMLSelectElement>('clocktowerPlayerCount');
  const scriptSelect = el<HTMLSelectElement>('clocktowerScript');
  const setupMode = el<HTMLSelectElement>('clocktowerSetupMode');
  const humanToggle = el<HTMLInputElement>('clocktowerIncludeHuman');
  const humanSeat = el<HTMLSelectElement>('clocktowerHumanSeat');
  countSelect.value = String(state.clocktowerSetup.playerCount);
  scriptSelect.value = state.clocktowerSetup.scriptId;
  setupMode.value = state.clocktowerSetup.setupMode;
  humanToggle.checked = state.clocktowerSetup.includeHuman;
  humanSeat.replaceChildren();
  const randomOption = document.createElement('option');
  randomOption.value = '0';
  randomOption.textContent = '随机';
  humanSeat.append(randomOption);
  for (let seat = 1; seat <= state.clocktowerSetup.playerCount; seat += 1) {
    const option = document.createElement('option');
    option.value = String(seat);
    option.textContent = String(seat) + '号';
    humanSeat.append(option);
  }
  humanSeat.value = String(state.clocktowerSetup.humanSeat <= state.clocktowerSetup.playerCount ? state.clocktowerSetup.humanSeat : 0);
  humanSeat.disabled = !state.clocktowerSetup.includeHuman;

  countSelect.onchange = async () => {
    const value = Number(countSelect.value) as 6 | 7 | 8;
    state.clocktowerSetup.playerCount = value;
    if (state.clocktowerSetup.humanSeat > value) state.clocktowerSetup.humanSeat = 0;
    await persistClocktowerSettings();
    renderClocktowerSettings();
    if (state.activeMode === 'clocktower' && !activeClocktowerGame()) renderMode();
  };
  scriptSelect.onchange = async () => {
    state.clocktowerSetup.scriptId = 'trouble-brewing';
    await persistClocktowerSettings();
  };
  setupMode.onchange = async () => {
    state.clocktowerSetup.setupMode = setupMode.value as ClocktowerSetupSettings['setupMode'];
    await persistClocktowerSettings();
    if (state.activeMode === 'clocktower' && !activeClocktowerGame()) renderMode();
  };
  humanToggle.onchange = async () => {
    state.clocktowerSetup.includeHuman = humanToggle.checked;
    if (!humanToggle.checked) state.clocktowerSetup.humanSeat = 0;
    await persistClocktowerSettings();
    renderClocktowerSettings();
    if (state.activeMode === 'clocktower' && !activeClocktowerGame()) renderMode();
  };
  humanSeat.onchange = async () => {
    state.clocktowerSetup.humanSeat = Number(humanSeat.value) as ClocktowerSetupSettings['humanSeat'];
    await persistClocktowerSettings();
  };

  container.replaceChildren();
  const selected = state.settings.clocktowerProviders;
  const ordered = [...selected.map((providerId) => providerById[providerId]).filter(Boolean), ...PROVIDERS.filter((provider) => !selected.includes(provider.id))];
  for (const provider of ordered) {
    const { row, checkbox } = providerOptionBase(provider.id, selected.includes(provider.id));
    checkbox.addEventListener('change', async () => {
      const next = [...state.settings.clocktowerProviders];
      if (checkbox.checked && !next.includes(provider.id)) next.push(provider.id);
      if (!checkbox.checked) {
        const index = next.indexOf(provider.id);
        if (index >= 0) next.splice(index, 1);
      }
      state.settings.clocktowerProviders = next;
      await persistClocktowerSettings();
      renderClocktowerSettings();
      if (state.activeMode === 'clocktower' && !activeClocktowerGame()) renderMode();
    });
    if (provider.enabled && checkbox.checked) {
      const index = state.settings.clocktowerProviders.indexOf(provider.id);
      const up = document.createElement('button');
      up.type = 'button';
      up.className = 'order-button';
      up.textContent = '↑';
      up.title = '提前座位顺序';
      up.disabled = index <= 0;
      up.addEventListener('click', async () => {
        if (index <= 0) return;
        const next = [...state.settings.clocktowerProviders];
        [next[index - 1], next[index]] = [next[index], next[index - 1]];
        state.settings.clocktowerProviders = next;
        await persistClocktowerSettings();
        renderClocktowerSettings();
      });
      const down = document.createElement('button');
      down.type = 'button';
      down.className = 'order-button';
      down.textContent = '↓';
      down.title = '延后座位顺序';
      down.disabled = index >= state.settings.clocktowerProviders.length - 1;
      down.addEventListener('click', async () => {
        if (index < 0 || index >= state.settings.clocktowerProviders.length - 1) return;
        const next = [...state.settings.clocktowerProviders];
        [next[index + 1], next[index]] = [next[index], next[index + 1]];
        state.settings.clocktowerProviders = next;
        await persistClocktowerSettings();
        renderClocktowerSettings();
      });
      row.append(up, down);
    }
    container.append(row);
  }
}

function renderSettings(): void {
  const acceleration = el<HTMLInputElement>('replyAcceleration');
  acceleration.checked = state.settings.replyAcceleration !== false;
  acceleration.onchange = () => {
    state.settings.replyAcceleration = acceleration.checked;
    void saveState(state).catch((error: unknown) => showComposerError(error instanceof Error ? error.message : String(error)));
  };
  renderQaSettings();
  renderSequentialSettings('roundtable', 'roundtableProviderSettings');
  renderWerewolfSettings();
  renderClocktowerSettings();
}

function actionIconButton(icon: string, title: string): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'mini-icon-button';
  button.title = title;
  button.setAttribute('aria-label', title);
  button.innerHTML = icon;
  return button;
}

function closeExpertEditor(): void {
  editingExpertId = null;
  el<HTMLInputElement>('expertNameInput').value = '';
  el<HTMLTextAreaElement>('expertPromptInput').value = '';
  el<HTMLElement>('expertPresetHint').textContent = '';
  el<HTMLElement>('expertEditor').classList.add('hidden');
}

function openExpertEditor(preset?: ExpertPreset): void {
  editingExpertId = preset?.id ?? null;
  el<HTMLInputElement>('expertNameInput').value = preset?.name ?? '';
  el<HTMLTextAreaElement>('expertPromptInput').value = preset?.prompt ?? '';
  el<HTMLElement>('expertPresetHint').textContent = '';
  el<HTMLElement>('expertEditor').classList.remove('hidden');
  el<HTMLInputElement>('expertNameInput').focus();
}

function renderExpertPresets(): void {
  const list = el<HTMLElement>('expertPresetList');
  list.replaceChildren();
  if (!state.expertPresets.length) {
    const empty = document.createElement('p');
    empty.className = 'drawer-empty';
    empty.textContent = '还没有专家预设。';
    list.append(empty);
    return;
  }
  for (const preset of state.expertPresets) {
    const row = document.createElement('div');
    row.className = 'expert-row';
    const name = document.createElement('span');
    name.textContent = preset.name;
    const edit = actionIconButton(ICON_EDIT, '编辑专家');
    edit.addEventListener('click', () => openExpertEditor(preset));
    const remove = actionIconButton(ICON_DELETE, '删除专家');
    remove.addEventListener('click', async () => {
      if (!window.confirm(`删除专家“${preset.name}”？已有历史会话中的专家快照不会受影响。`)) return;
      state.expertPresets = state.expertPresets.filter((item) => item.id !== preset.id);
      for (const provider of PROVIDERS) {
        if (state.settings.expertPresetByProvider[provider.id] === preset.id) delete state.settings.expertPresetByProvider[provider.id];
      }
      syncBlankExpertSessionAssignments();
      await saveState(state);
      renderExpertPresets();
      renderSettings();
      if (editingExpertId === preset.id) closeExpertEditor();
    });
    row.append(name, edit, remove);
    list.append(row);
  }
}

async function saveExpertPreset(): Promise<void> {
  const name = el<HTMLInputElement>('expertNameInput').value.trim();
  const prompt = el<HTMLTextAreaElement>('expertPromptInput').value.trim();
  const hint = el<HTMLElement>('expertPresetHint');
  if (!name || !prompt) {
    hint.textContent = '名称和预设提示词都不能为空。';
    return;
  }
  const now = Date.now();
  if (editingExpertId) {
    const preset = state.expertPresets.find((item) => item.id === editingExpertId);
    if (preset) Object.assign(preset, { name, prompt, updatedAt: now });
  } else {
    state.expertPresets.push({ id: id('expert'), name, prompt, createdAt: now, updatedAt: now });
  }
  syncBlankExpertSessionAssignments();
  await saveState(state);
  closeExpertEditor();
  renderExpertPresets();
  renderSettings();
}

function exportExpertPresets(): void {
  if (!state.expertPresets.length) {
    showComposerError('当前没有可导出的专家预设。');
    return;
  }
  const payload = buildExpertPresetTransferFile(state.expertPresets);
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `multi-ai-roundtable-experts-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  showComposerError(`已导出 ${state.expertPresets.length} 个专家预设。`);
}

async function importExpertPresets(file: File): Promise<void> {
  try {
    if (file.size > 5 * 1024 * 1024) throw new Error('JSON 文件超过 5 MB，已拒绝导入。');
    const incoming = parseExpertPresetTransferFile(await file.text());
    const merged = mergeExpertPresets(state.expertPresets, incoming, Date.now(), () => id('expert'));
    state.expertPresets = merged.presets;
    syncBlankExpertSessionAssignments();
    await saveState(state);
    closeExpertEditor();
    renderExpertPresets();
    renderSettings();
    const parts = [`新增 ${merged.added}`];
    if (merged.updated) parts.push(`更新 ${merged.updated}`);
    if (merged.unchanged) parts.push(`未变 ${merged.unchanged}`);
    showComposerError(`专家预设导入完成：${parts.join('，')}。`);
  } catch (error) {
    showComposerError(error instanceof Error ? `导入失败：${error.message}` : '导入失败：未知错误');
  }
}

function sessionMarkdown(session: ConversationSession): string {
  const lines = [`# ${session.title}`, '', `- 类型：${modeLabel(session.mode)}`, `- 创建时间：${new Date(session.createdAt).toLocaleString()}`, `- 更新时间：${new Date(session.updatedAt).toLocaleString()}`];
  if (session.mode === 'expert') {
    const assignments = Object.entries(session.expertAssignments ?? {}) as [ProviderId, ExpertAssignmentSnapshot][];
    const labels = assignments.filter(([, expert]) => expert?.name).map(([provider, expert]) => `${providerLabel(provider)}：${expert.name}`);
    if (labels.length) lines.push(`- 专家配置：${labels.join('；')}`);
  }
  lines.push('', '## 对话', '');
  for (const message of session.messages) {
    if (message.role === 'system') continue;
    const author = message.role === 'user' ? '用户' : providerDisplayLabel(session, message.provider);
    lines.push(`### ${author}`, '', message.text || (message.status === 'interrupted' ? '*已中断*' : ''), '');
    if (message.attachments?.length) {
      lines.push(message.attachments.map((item) => `- ${item.kind === 'image' ? '图片' : '附件'}：${item.name}`).join('\n'), '');
    }
    if (message.error) lines.push(`> 错误：${message.error}`, '');
  }
  return lines.join('\n').trimEnd() + '\n';
}

function exportSession(session: ConversationSession): void {
  const blob = new Blob([sessionMarkdown(session)], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${session.title.replace(/[\\/:*?"<>|]/g, '_').slice(0, 48) || 'conversation'}.md`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function werewolfGameMarkdown(game: WerewolfGameSession): string {
  const human = werewolfHumanPlayer(game);
  const lines = [
    `# ${game.title}`,
    '',
    '- 类型：狼人杀',
    `- 规则：${game.rulesetSnapshot.name}`,
    `- 状态：${werewolfStatusLabel(game)}`,
    `- 创建时间：${new Date(game.createdAt).toLocaleString()}`,
    `- 更新时间：${new Date(game.updatedAt).toLocaleString()}`
  ];
  if (human) lines.push(`- 你的座位：${human.seat}号`, `- 你的身份：${ROLE_LABELS[human.role]}`);
  if (game.status === 'ended') {
    lines.push(`- 获胜阵营：${game.winner === 'wolf' ? '狼人阵营' : '好人阵营'}`);
    lines.push(`- 最终身份：${[...game.players].sort((a, b) => a.seat - b.seat).map((player) => `${player.seat}号 ${ROLE_LABELS[player.role]}`).join('；')}`);
  }
  lines.push('', '## 游戏记录', '');
  for (const event of humanVisibleEvents(game)) {
    if (!event.content || event.visibility.type === 'system') continue;
    const author = event.authorSeat
      ? `${event.authorSeat}号${playerBySeatUi(game, event.authorSeat)?.controller === 'human' ? ' · 你' : ''}`
      : event.visibility.type === 'wolf' ? '狼人频道' : event.visibility.type === 'private' ? '私密信息' : '主持人';
    lines.push(`### ${author}`, '', event.content, '');
  }
  return lines.join('\n').trimEnd() + '\n';
}

function exportWerewolfGame(game: WerewolfGameSession): void {
  const blob = new Blob([werewolfGameMarkdown(game)], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${game.title.replace(/[\\/:*?"<>|]/g, '_').slice(0, 48) || 'werewolf'}.md`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function clocktowerGameMarkdown(game: ClocktowerGameSession): string {
  const human = clocktowerHumanPlayer(game);
  const lines = [
    `# ${game.title}`,
    '',
    '- 类型：迷雾议会',
    '- 剧本：经典身份剧本',
    `- 人数：${game.rulesetSnapshot.playerCount}`,
    `- 状态：${clocktowerStatusLabel(game)}`,
    `- 创建时间：${new Date(game.createdAt).toLocaleString()}`,
    `- 更新时间：${new Date(game.updatedAt).toLocaleString()}`
  ];
  if (human) {
    lines.push(`- 你的座位：${human.seat}号`);
    lines.push(`- 你认知的角色：${clocktowerRoleById[human.perceivedCharacter].name}`);
  }
  if (game.status === 'ended') {
    lines.push(`- 获胜阵营：${game.winner === 'good' ? '善良' : '邪恶'}`);
    lines.push(`- 胜负原因：${game.winnerReason ?? '未记录'}`);
    lines.push(`- 最终角色：${[...game.players].sort((a, b) => a.seat - b.seat).map((player) => `${player.seat}号 ${clocktowerRoleById[player.trueCharacter].name}`).join('；')}`);
  }
  lines.push('', '## 游戏记录', '');
  const events = game.status === 'ended'
    ? game.events
    : clocktowerVisibleEvents(game);
  for (const event of events) {
    if (!event.content || event.type === 'phase') continue;
    if (game.status !== 'ended' && event.visibility.type === 'storyteller') continue;
    const author = event.authorSeat ? `${event.authorSeat}号` : event.visibility.type === 'private' ? '私密信息' : event.visibility.type === 'storyteller' ? '说书人（隐藏记录）' : '说书人';
    lines.push(`### ${author}`, '', event.content, '');
  }
  if (game.status === 'ended' && game.storytellerDecisions.length) {
    lines.push('## Storyteller 裁量记录', '');
    for (const decision of game.storytellerDecisions) {
      lines.push(`- ${decision.kind}：${decision.selected}（${decision.reason}）`);
    }
    lines.push('');
  }
  return lines.join('\n').trimEnd() + '\n';
}

function exportClocktowerGame(game: ClocktowerGameSession): void {
  const blob = new Blob([clocktowerGameMarkdown(game)], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${game.title.replace(/[\\/:*?"<>|]/g, '_').slice(0, 48) || 'clocktower'}.md`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function deleteWerewolfGame(game: WerewolfGameSession): Promise<void> {
  if (game.status === 'running' || game.status === 'waiting_human' || game.pendingTurn) {
    showComposerError('请先中断正在运行的狼人杀对局');
    return;
  }
  if (!window.confirm(`删除狼人杀对局“${game.title}”？此操作只删除扩展本地记录。`)) return;
  try {
    await runtimeMessage({ type: 'DELETE_WEREWOLF_GAME', gameId: game.id });
    await refreshStateFromStorage();
    renderHistory();
  } catch (error) {
    showComposerError(error instanceof Error ? error.message : String(error));
  }
}

async function deleteClocktowerGame(game: ClocktowerGameSession): Promise<void> {
  if (game.status === 'running' || game.status === 'waiting_human' || game.pendingTurn) {
    showComposerError('请先中断正在运行的迷雾议会对局');
    return;
  }
  if (!window.confirm(`删除迷雾议会对局“${game.title}”？此操作只删除扩展本地记录。`)) return;
  try {
    await runtimeMessage({ type: 'DELETE_CLOCKTOWER_GAME', gameId: game.id });
    await refreshStateFromStorage();
    renderHistory();
  } catch (error) {
    showComposerError(error instanceof Error ? error.message : String(error));
  }
}

async function deleteSession(session: ConversationSession): Promise<void> {
  if (session.execution?.status === 'running') {
    showComposerError('请先中断正在运行的会话');
    return;
  }
  if (!window.confirm(`删除会话“${session.title}”？此操作只删除扩展本地记录。`)) return;
  state.conversations = state.conversations.filter((item) => item.id !== session.id);
  if (state.activeConversationIds[session.mode] === session.id) createSession(session.mode);
  await saveState(state);
  renderHistory();
  renderMode();
}

function renderHistory(): void {
  const body = el<HTMLElement>('historyBody');
  body.replaceChildren();
  const modes: ConversationMode[] = ['qa', 'roundtable', 'expert'];
  for (const mode of modes) {
    const section = document.createElement('section');
    section.className = 'history-section';
    const heading = document.createElement('h3');
    heading.textContent = modeLabel(mode);
    section.append(heading);
    const sessions = [...state.conversations].filter((session) => session.mode === mode && session.messages.length).sort((a, b) => b.updatedAt - a.updatedAt);
    if (!sessions.length) {
      const empty = document.createElement('p');
      empty.className = 'history-empty';
      empty.textContent = '暂无会话';
      section.append(empty);
    }
    for (const session of sessions) {
      const card = document.createElement('div');
      card.className = `history-card ${state.activeConversationIds[mode] === session.id ? 'active' : ''}`;
      const title = document.createElement('button');
      title.type = 'button';
      title.className = 'history-title';
      title.textContent = session.title;
      title.addEventListener('click', async () => {
        state.activeMode = mode;
        state.activeConversationIds[mode] = session.id;
        el<HTMLElement>('historyOverlay').classList.add('hidden');
        clearComposer();
        renderMode();
        await saveState(state);
      });
      const exportButton = actionIconButton(ICON_EXPORT, '导出为 Markdown');
      exportButton.addEventListener('click', () => exportSession(session));
      const deleteButton = actionIconButton(ICON_DELETE, '删除会话');
      deleteButton.addEventListener('click', () => void deleteSession(session));
      card.append(title, exportButton, deleteButton);
      section.append(card);
    }
    body.append(section);
  }

  const gameSection = document.createElement('section');
  gameSection.className = 'history-section';
  const gameHeading = document.createElement('h3');
  gameHeading.textContent = '狼人杀';
  gameSection.append(gameHeading);
  const games = [...state.werewolfGames].sort((a, b) => b.updatedAt - a.updatedAt);
  if (!games.length) {
    const empty = document.createElement('p');
    empty.className = 'history-empty';
    empty.textContent = '暂无对局';
    gameSection.append(empty);
  }
  for (const game of games) {
    const card = document.createElement('div');
    card.className = `history-card ${state.activeWerewolfGameId === game.id ? 'active' : ''}`;
    const title = document.createElement('button');
    title.type = 'button';
    title.className = 'history-title';
    title.textContent = `${game.title} · ${werewolfStatusLabel(game)}`;
    title.addEventListener('click', async () => {
      try {
        await runtimeMessage({ type: 'SET_ACTIVE_WEREWOLF_GAME', gameId: game.id });
        state.activeMode = 'werewolf';
        state.activeWerewolfGameId = game.id;
        el<HTMLElement>('historyOverlay').classList.add('hidden');
        clearComposer();
        renderMode();
        await saveState(state);
      } catch (error) {
        showComposerError(error instanceof Error ? error.message : String(error));
      }
    });
    const exportButton = actionIconButton(ICON_EXPORT, '导出为 Markdown');
    exportButton.addEventListener('click', () => exportWerewolfGame(game));
    const deleteButton = actionIconButton(ICON_DELETE, '删除对局');
    deleteButton.addEventListener('click', () => void deleteWerewolfGame(game));
    card.append(title, exportButton, deleteButton);
    gameSection.append(card);
  }
  body.append(gameSection);

  const clockSection = document.createElement('section');
  clockSection.className = 'history-section';
  const clockHeading = document.createElement('h3');
  clockHeading.textContent = '迷雾议会';
  clockSection.append(clockHeading);
  const clockGames = [...state.clocktowerGames].sort((a, b) => b.updatedAt - a.updatedAt);
  if (!clockGames.length) {
    const empty = document.createElement('p');
    empty.className = 'history-empty';
    empty.textContent = '暂无对局';
    clockSection.append(empty);
  }
  for (const game of clockGames) {
    const card = document.createElement('div');
    card.className = `history-card ${state.activeClocktowerGameId === game.id ? 'active' : ''}`;
    const title = document.createElement('button');
    title.type = 'button';
    title.className = 'history-title';
    title.textContent = `${game.title} · ${clocktowerStatusLabel(game)}`;
    title.addEventListener('click', async () => {
      try {
        await runtimeMessage({ type: 'SET_ACTIVE_CLOCKTOWER_GAME', gameId: game.id });
        state.activeMode = 'clocktower';
        state.activeClocktowerGameId = game.id;
        el<HTMLElement>('historyOverlay').classList.add('hidden');
        clocktowerSelectedTargets = [];
        clearComposer();
        renderMode();
        await saveState(state);
      } catch (error) {
        showComposerError(error instanceof Error ? error.message : String(error));
      }
    });
    const exportButton = actionIconButton(ICON_EXPORT, '导出为 Markdown');
    exportButton.addEventListener('click', () => exportClocktowerGame(game));
    const deleteButton = actionIconButton(ICON_DELETE, '删除对局');
    deleteButton.addEventListener('click', () => void deleteClocktowerGame(game));
    card.append(title, exportButton, deleteButton);
    clockSection.append(card);
  }
  body.append(clockSection);
}

async function newConversation(): Promise<void> {
  const mode = state.activeMode;
  if (mode === 'werewolf') {
    const game = activeWerewolfGame();
    if (game?.status === 'running' || game?.status === 'waiting_human') return showComposerError('请先中断当前狼人杀对局再新开一局');
    try {
      await runtimeMessage({ type: 'SET_ACTIVE_WEREWOLF_GAME' });
      state.activeWerewolfGameId = undefined;
      clearComposer();
      renderMode();
    } catch (error) {
      showComposerError(error instanceof Error ? error.message : String(error));
    }
    return;
  }
  if (mode === 'clocktower') {
    const game = activeClocktowerGame();
    if (game?.status === 'running' || game?.status === 'waiting_human') return showComposerError('请先中断当前迷雾议会对局再新开一局');
    try {
      await runtimeMessage({ type: 'SET_ACTIVE_CLOCKTOWER_GAME' });
      state.activeClocktowerGameId = undefined;
      clocktowerSelectedTargets = [];
      clearComposer();
      renderMode();
    } catch (error) {
      showComposerError(error instanceof Error ? error.message : String(error));
    }
    return;
  }
  const current = activeSession();
  if (current.execution?.status === 'running') return showComposerError('请先中断当前循环再新建会话');
  createSession(mode);
  interruptRequested = false;
  clearComposer();
  renderMode();
  await saveState(state);
}

function openOverlay(idValue: string): void {
  el<HTMLElement>(idValue).classList.remove('hidden');
}

function closeOverlay(idValue: string): void {
  el<HTMLElement>(idValue).classList.add('hidden');
}

async function refreshStateFromStorage(): Promise<void> {
  state = await loadState();
  uiBaseline = structuredClone(state);
  ensureActiveSession('qa');
  ensureActiveSession('roundtable');
  ensureActiveSession('expert');
  renderMode();
  if (!el<HTMLElement>('settingsOverlay').classList.contains('hidden')) renderSettings();
  if (!el<HTMLElement>('expertOverlay').classList.contains('hidden')) renderExpertPresets();
  if (!el<HTMLElement>('historyOverlay').classList.contains('hidden')) renderHistory();
}

function wireOverlay(overlayId: string, closeButtonId: string): void {
  const overlay = el<HTMLElement>(overlayId);
  el<HTMLButtonElement>(closeButtonId).addEventListener('click', () => closeOverlay(overlayId));
  overlay.addEventListener('click', (event) => { if (event.target === overlay) closeOverlay(overlayId); });
}

function wireEvents(): void {
  document.querySelectorAll<HTMLButtonElement>('.mode-tab').forEach((tab) => tab.addEventListener('click', async () => {
    state.activeMode = tab.dataset.mode as Mode;
    if (isConversationMode(state.activeMode)) ensureActiveSession(state.activeMode);
    clearComposer();
    renderMode();
    await saveState(state);
  }));

  el<HTMLButtonElement>('newConversationButton').addEventListener('click', () => void newConversation());
  el<HTMLButtonElement>('fullscreenButton').addEventListener('click', () => void runtimeMessage({ type: 'OPEN_FULLSCREEN' }));
  el<HTMLButtonElement>('settingsButton').addEventListener('click', () => {
    renderSettings();
    openOverlay('settingsOverlay');
    void refreshProviderAvailability(PROVIDERS.map((provider) => provider.id));
  });
  el<HTMLButtonElement>('expertPresetButton').addEventListener('click', () => { renderExpertPresets(); openOverlay('expertOverlay'); });
  el<HTMLButtonElement>('historyButton').addEventListener('click', () => { renderHistory(); openOverlay('historyOverlay'); });
  el<HTMLButtonElement>('clocktowerScriptButton').addEventListener('click', () => { renderClocktowerScript(); openOverlay('clocktowerScriptOverlay'); });
  wireOverlay('settingsOverlay', 'closeSettingsButton');
  wireOverlay('expertOverlay', 'closeExpertButton');
  wireOverlay('historyOverlay', 'closeHistoryButton');
  wireOverlay('clocktowerScriptOverlay', 'closeClocktowerScriptButton');

  el<HTMLButtonElement>('newExpertButton').addEventListener('click', () => openExpertEditor());
  el<HTMLButtonElement>('saveExpertButton').addEventListener('click', () => void saveExpertPreset());
  el<HTMLButtonElement>('cancelExpertButton').addEventListener('click', closeExpertEditor);
  const expertImportInput = el<HTMLInputElement>('expertImportInput');
  el<HTMLButtonElement>('importExpertsButton').addEventListener('click', () => {
    expertImportInput.value = '';
    expertImportInput.click();
  });
  el<HTMLButtonElement>('exportExpertsButton').addEventListener('click', exportExpertPresets);
  expertImportInput.addEventListener('change', () => {
    const file = expertImportInput.files?.[0];
    expertImportInput.value = '';
    if (file) void importExpertPresets(file);
  });

  el<HTMLButtonElement>('attachButton').addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => { if (fileInput.files) void addFiles(fileInput.files); });
  messageInput.addEventListener('paste', (event) => {
    const files = [...(event.clipboardData?.files ?? [])];
    if (files.length) void addFiles(files);
  });
  messageInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey && state.activeMode === 'qa') {
      event.preventDefault();
      void handleQaSend();
      return;
    }
    if (event.key === 'Enter' && !event.shiftKey && state.activeMode === 'werewolf' && humanTextTurn(activeWerewolfGame()?.pendingHumanAction)) {
      event.preventDefault();
      void handleWerewolfHumanTextSend();
      return;
    }
    if (event.key === 'Enter' && !event.shiftKey && state.activeMode === 'clocktower' && clocktowerHumanTextTurn(activeClocktowerGame()?.pendingHumanAction)) {
      event.preventDefault();
      void handleClocktowerHumanTextSend();
    }
  });
  qaSendButton.addEventListener('click', () => void handleQaSend());
  roundActionButton.addEventListener('click', () => void handleSequentialAction());
  el<HTMLButtonElement>('werewolfActionButton').addEventListener('click', () => void handleWerewolfAction());
  el<HTMLButtonElement>('werewolfHumanSendButton').addEventListener('click', () => void handleWerewolfHumanTextSend());
  el<HTMLButtonElement>('clocktowerActionButton').addEventListener('click', () => void handleClocktowerAction());
  el<HTMLButtonElement>('clocktowerHumanSendButton').addEventListener('click', () => void handleClocktowerHumanTextSend());
  roundRange.addEventListener('input', () => {
    const session = activeSession();
    if (!isSequentialMode(session.mode)) return;
    session.rounds = Number(roundRange.value);
    if (session.execution) session.execution.targetRounds = session.rounds;
    roundNumber.value = roundRange.value;
    touchSession(session);
    void saveState(state);
  });
  roundNumber.addEventListener('change', () => {
    const session = activeSession();
    if (!isSequentialMode(session.mode)) return;
    const value = Math.max(1, Math.min(99, Math.trunc(Number(roundNumber.value) || 1)));
    session.rounds = value;
    if (session.execution) session.execution.targetRounds = value;
    roundNumber.value = String(value);
    roundRange.value = String(Math.min(8, value));
    touchSession(session);
    void saveState(state);
  });

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && changes[STORAGE_KEY]) void refreshStateFromStorage();
  });
}

async function init(): Promise<void> {
  state = await loadState();
  uiBaseline = structuredClone(state);
  ensureActiveSession('qa');
  ensureActiveSession('roundtable');
  ensureActiveSession('expert');
  wireEvents();
  renderMode();
  renderSettings();
  renderExpertPresets();
  renderAttachmentTray();
  await saveState(state);
}

void init();
