import { el } from '../utils/dom';
import type { EventBus } from '../core/EventBus';

/**
 * Village chat feed.
 *
 * IMPORTANT: this is a *simulated* feed. Messages come from a local script on
 * timers — there is no server, no other players, and nothing you type leaves
 * the browser. The real chat is meant to live in WorldRoom on the server where
 * it can be authoritative and moderated. Until that ships, this is set dressing
 * and is labelled as such in the UI ("village feed · simulated").
 */

interface ChatLine {
  who: string;
  text: string;
  kind: 'villager' | 'player' | 'system' | 'you';
}

/** Ambient chatter. Written to sound like the valley, not like a chatroom. */
const AMBIENT: ChatLine[] = [
  { who: 'Mira', text: 'Tower still humming? Check the west relay before dusk.', kind: 'villager' },
  { who: 'Orin', text: 'Ranger camp has spare rope if anyone needs it.', kind: 'villager' },
  { who: 'sora_dev', text: 'first fish of the day 🎣 took me 20 minutes', kind: 'player' },
  { who: 'Kae', text: 'Café is open. The good beans, not the other ones.', kind: 'villager' },
  { who: 'nullpointer', text: 'anyone know where the shrine path starts?', kind: 'player' },
  { who: 'Mira', text: 'It starts behind the meadow. Follow the lamps.', kind: 'villager' },
  { who: 'Tomo', text: 'Rain coming in over the ridge. Bring the washing in.', kind: 'villager' },
  { who: 'buildfail', text: 'my house has 14 chairs and no bed. this is fine', kind: 'player' },
  { who: 'Orin', text: 'Echo drifting near the bridge. Not hostile. Just sad.', kind: 'villager' },
  { who: 'Kae', text: 'Whoever left a lantern on the counter — it is still here.', kind: 'villager' },
  { who: 'yuki.eth', text: 'gm valley', kind: 'player' },
  { who: 'sora_dev', text: 'the pond at night is unreasonably pretty', kind: 'player' },
  { who: 'Mira', text: 'Signal strength up two points. Someone did good work.', kind: 'villager' },
  { who: 'Tomo', text: 'Festival stage needs three more planks. No rush.', kind: 'villager' },
  { who: 'refactor_rat', text: 'took the long way round. worth it.', kind: 'player' },
];

/** Replies used when the player says something — keeps the feed feeling alive. */
const REPLIES: ChatLine[] = [
  { who: 'Kae', text: 'Heard. Kettle is on.', kind: 'villager' },
  { who: 'sora_dev', text: 'same tbh', kind: 'player' },
  { who: 'Mira', text: 'Mm. Keep at it.', kind: 'villager' },
  { who: 'Orin', text: 'Noted. Stay on the path after dark.', kind: 'villager' },
  { who: 'yuki.eth', text: 'ok that is fair', kind: 'player' },
];

const MAX_LINES = 40;

export class ChatUI {
  private wrap: HTMLElement;
  private log: HTMLElement;
  private input: HTMLInputElement;
  private timer: number | null = null;
  private ambientIdx = 0;
  private collapsed = false;

  constructor(
    root: HTMLElement,
    private bus: EventBus,
    private playerName: string,
    private onFocusChange: (focused: boolean) => void
  ) {
    this.wrap = el('div', 'kp-chat');

    const head = el('div', 'kp-chat-head');
    const title = el('span', 'kp-chat-title', '💬 Village feed');
    const tag = el('span', 'kp-chat-tag', 'simulated');
    const toggle = el('button', 'kp-chat-toggle', '–');
    toggle.addEventListener('click', () => {
      this.collapsed = !this.collapsed;
      this.wrap.classList.toggle('collapsed', this.collapsed);
      toggle.textContent = this.collapsed ? '+' : '–';
    });
    head.append(title, tag, toggle);

    this.log = el('div', 'kp-chat-log');

    const form = el('form', 'kp-chat-form');
    this.input = el('input', 'kp-chat-input') as HTMLInputElement;
    this.input.type = 'text';
    this.input.maxLength = 140;
    this.input.placeholder = 'Say something…';
    this.input.autocomplete = 'off';
    form.appendChild(this.input);

    // While typing, movement keys must not drive the player.
    this.input.addEventListener('focus', () => this.onFocusChange(true));
    this.input.addEventListener('blur', () => this.onFocusChange(false));
    this.input.addEventListener('keydown', (ev) => ev.stopPropagation());

    form.addEventListener('submit', (ev) => {
      ev.preventDefault();
      const text = this.input.value.trim();
      if (!text) return;
      this.push({ who: this.playerName, text, kind: 'you' });
      this.input.value = '';
      // A local reply, so saying something never feels like shouting into a void.
      if (Math.random() < 0.7) {
        window.setTimeout(
          () => this.push(REPLIES[Math.floor(Math.random() * REPLIES.length)]),
          900 + Math.random() * 1600
        );
      }
    });

    this.wrap.append(head, this.log, form);
    root.appendChild(this.wrap);

    // Surface real game events in the feed so it isn't purely fictional.
    this.bus.on('quest:completed', () => {
      this.push({ who: '', text: `${this.playerName} finished a job for the village.`, kind: 'system' });
    });
    this.bus.on('waylight:restored', () => {
      this.push({ who: '', text: 'A relay came back online. Signal strength rising.', kind: 'system' });
    });
    this.bus.on('net:playerJoined', ({ name }) => {
      this.push({ who: '', text: `${name} arrived in the valley.`, kind: 'system' });
    });
    this.bus.on('net:playerLeft', () => {
      this.push({ who: '', text: 'Someone took the last train out.', kind: 'system' });
    });
  }

  start(): void {
    if (this.timer !== null) return;
    this.push({ who: '', text: 'Connected to the village feed.', kind: 'system' });
    const tick = () => {
      const line = AMBIENT[this.ambientIdx % AMBIENT.length];
      this.ambientIdx++;
      this.push(line);
      // Irregular spacing reads as human; a fixed interval reads as a machine.
      this.timer = window.setTimeout(tick, 9000 + Math.random() * 16000);
    };
    this.timer = window.setTimeout(tick, 4000);
  }

  stop(): void {
    if (this.timer !== null) window.clearTimeout(this.timer);
    this.timer = null;
  }

  setVisible(visible: boolean): void {
    this.wrap.style.display = visible ? '' : 'none';
  }

  private push(line: ChatLine): void {
    const row = el('div', `kp-chat-line ${line.kind}`);
    if (line.kind === 'system') {
      row.appendChild(el('span', 'msg', line.text));
    } else {
      row.append(el('span', 'who', `${line.who}:`), el('span', 'msg', line.text));
    }
    this.log.appendChild(row);
    while (this.log.childElementCount > MAX_LINES) {
      this.log.firstElementChild?.remove();
    }
    this.log.scrollTop = this.log.scrollHeight;
  }
}
