import type { EventBus } from '../core/EventBus';
import type {
  DialogueChoice,
  DialogueCondition,
  DialogueEffects,
  DialogueEntry,
  DialogueNode,
} from '../types';

export interface DialogueView {
  npcId: string;
  speaker: string;
  line: string;
  lineIndex: number;
  lineCount: number;
  choices: DialogueChoice[] | null;
  done: boolean;
}

/**
 * Data-driven conversation engine. Conditions and effects are evaluated by
 * callbacks injected from Game, keeping this module free of system imports.
 */
export class DialogueController {
  private entryNodes: Record<string, DialogueNode> | null = null;
  private npcId = '';
  private speakerName = '';
  private nodeId = '';
  private lineIndex = 0;
  private effectsRan = false;
  /** UI subscribes here. */
  onUpdate: ((view: DialogueView | null) => void) | null = null;

  constructor(
    private bus: EventBus,
    private evalCondition: (c?: DialogueCondition) => boolean,
    private runEffects: (e?: DialogueEffects) => void
  ) {}

  get active(): boolean {
    return this.entryNodes !== null;
  }

  /** Pick the first entry whose conditions pass and begin the conversation. */
  start(npcId: string, speakerName: string, entries: DialogueEntry[]): boolean {
    const entry = entries.find((e) => this.evalCondition(e.conditions));
    if (!entry) return false;
    this.entryNodes = entry.nodes;
    this.npcId = npcId;
    this.speakerName = speakerName;
    this.nodeId = entry.start;
    this.lineIndex = 0;
    this.effectsRan = false;
    this.bus.emit('dialogue:started', { npcId });
    this.pushView();
    return true;
  }

  private node(): DialogueNode | null {
    return this.entryNodes?.[this.nodeId] ?? null;
  }

  private pushView(): void {
    const node = this.node();
    if (!node) {
      this.end();
      return;
    }
    const atLastLine = this.lineIndex >= node.lines.length - 1;
    const choices = atLastLine && node.choices
      ? node.choices.filter((c) => this.evalCondition(c.conditions))
      : null;
    this.onUpdate?.({
      npcId: this.npcId,
      speaker: node.speaker ?? this.speakerName,
      line: node.lines[this.lineIndex] ?? '',
      lineIndex: this.lineIndex,
      lineCount: node.lines.length,
      choices: choices && choices.length > 0 ? choices : null,
      done: false,
    });
    // Node effects fire once, when its final line is first displayed.
    if (atLastLine && !this.effectsRan) {
      this.effectsRan = true;
      this.runEffects(node.effects);
    }
  }

  /** Advance to the next line / follow `next` / end. No-op while choices are shown. */
  advance(): void {
    const node = this.node();
    if (!node) return;
    const atLastLine = this.lineIndex >= node.lines.length - 1;
    if (!atLastLine) {
      this.lineIndex++;
      this.pushView();
      return;
    }
    if (node.choices && node.choices.some((c) => this.evalCondition(c.conditions))) {
      return; // waiting for a choice
    }
    if (node.next) {
      this.goto(node.next);
    } else {
      this.end();
    }
  }

  choose(choice: DialogueChoice): void {
    this.runEffects(choice.effects);
    if (choice.next) this.goto(choice.next);
    else this.end();
  }

  private goto(nodeId: string): void {
    this.nodeId = nodeId;
    this.lineIndex = 0;
    this.effectsRan = false;
    this.pushView();
  }

  skip(): void {
    this.end();
  }

  private end(): void {
    if (!this.entryNodes) return;
    const endedNode = this.nodeId;
    this.entryNodes = null;
    this.onUpdate?.(null);
    this.bus.emit('dialogue:ended', { npcId: this.npcId, nodeId: endedNode });
  }
}
