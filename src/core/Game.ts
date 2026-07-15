import * as THREE from 'three';
import dialogueData from '../data/dialogue/dialogues.json';
import { GameConfig } from '../config/GameConfig';
import { EventBus } from './EventBus';
import { Renderer } from './Renderer';
import { SceneManager } from './SceneManager';
import { InputManager } from './InputManager';
import { PerformanceManager } from './PerformanceManager';
import { AssetManager } from './AssetManager';
import { Physics } from '../physics/Physics';
import { WorldManager } from '../world/WorldManager';
import { DayNightSystem } from '../world/DayNightSystem';
import { WeatherManager } from '../world/WeatherManager';
import { WaylightSystem } from '../world/WaylightSystem';
import { terrainHeight, POND } from '../world/Terrain';
import { PlayerController } from '../player/PlayerController';
import { PlayerInventory } from '../player/PlayerInventory';
import { InteractionController } from '../player/InteractionController';
import { ThirdPersonCamera } from '../camera/ThirdPersonCamera';
import { NPCManager } from '../characters/NPCManager';
import { DialogueController } from '../characters/DialogueController';
import { FriendshipSystem } from '../characters/FriendshipSystem';
import { SpiritManager } from '../spirits/SpiritManager';
import { QuestManager } from '../quests/QuestManager';
import { GatheringSystem } from '../crafting/GatheringSystem';
import { CraftingSystem } from '../crafting/CraftingSystem';
import { HousingManager } from '../housing/HousingManager';
import { FishingGame } from '../minigames/FishingGame';
import { EmoteSystem } from '../social/EmoteSystem';
import { NetworkManager } from '../multiplayer/NetworkManager';
import { StylizedPipeline } from '../shaders/postfx';
import { UIManager } from '../ui/UIManager';
import { HUD } from '../ui/HUD';
import { DialogueUI } from '../ui/DialogueUI';
import { InventoryUI } from '../ui/InventoryUI';
import { CraftingUI } from '../ui/CraftingUI';
import { QuestUI } from '../ui/QuestUI';
import { MapUI } from '../ui/MapUI';
import { JournalUI } from '../ui/JournalUI';
import { SettingsUI } from '../ui/SettingsUI';
import { EmoteWheel } from '../ui/EmoteWheel';
import { FishingUI } from '../ui/FishingUI';
import { HousingUI } from '../ui/HousingUI';
import { MobileControls } from '../ui/MobileControls';
import { MiniMap } from '../ui/MiniMap';
import { ChatUI } from '../ui/ChatUI';
import { StatusBar } from '../ui/StatusBar';
import { CustomizationUI } from '../ui/CustomizationUI';
import { isTouchDevice } from '../utils/device';
import { POI } from '../utils/constants';
import type { AudioManager } from './AudioManager';
import type { SaveManager } from './SaveManager';
import type {
  Appearance,
  DialogueCondition,
  DialogueEffects,
  DialogueEntry,
  SaveData,
} from '../types';
import type { NPC } from '../characters/NPC';

const DIALOGUES = dialogueData as unknown as Record<string, DialogueEntry[]>;

/**
 * Game — composition root and main loop. Systems communicate through the
 * EventBus; Game wires them together and owns the frame update order.
 */
export class Game {
  readonly bus = new EventBus();
  private running = false;
  private elapsed = 0;
  private lastFrame = 0;
  private autosaveTimer = GameConfig.autosaveSeconds;
  private flags = new Set<string>();
  private appearance: Appearance;
  private playerName: string;
  private talkingNpc: NPC | null = null;
  private tutorialStage = 0;
  private tutorialTimer = 3;
  private postfx: StylizedPipeline;
  /** Always-on overlays, built by buildOverlays() after construction. */
  private miniMap!: MiniMap;
  private chat!: ChatUI;
  private statusBar!: StatusBar;

  private constructor(
    private renderer: Renderer,
    private sceneMgr: SceneManager,
    private input: InputManager,
    readonly audio: AudioManager,
    private saveManager: SaveManager,
    private physics: Physics,
    private world: WorldManager,
    private dayNight: DayNightSystem,
    private weather: WeatherManager,
    private waylights: WaylightSystem,
    private player: PlayerController,
    private tpCamera: ThirdPersonCamera,
    private npcs: NPCManager,
    private spirits: SpiritManager,
    private friendship: FriendshipSystem,
    private inventory: PlayerInventory,
    private quests: QuestManager,
    private dialogue: DialogueController,
    private crafting: CraftingSystem,
    private gathering: GatheringSystem,
    private housing: HousingManager,
    private fishing: FishingGame,
    private emotes: EmoteSystem,
    private network: NetworkManager,
    private interactions: InteractionController,
    private perf: PerformanceManager,
    private ui: UIManager,
    private hud: HUD,
    private dialogueUI: DialogueUI,
    private emoteWheel: EmoteWheel,
    private housingUI: HousingUI,
    private mobile: MobileControls,
    private save: SaveData
  ) {
    this.appearance = save.appearance;
    this.playerName = save.playerName;
    this.postfx = new StylizedPipeline(renderer.gl);
  }

  /* ============================== creation ============================== */

  static async create(
    canvas: HTMLCanvasElement,
    audio: AudioManager,
    saveManager: SaveManager,
    save: SaveData,
    onProgress: (msg: string) => void = () => undefined
  ): Promise<Game> {
    onProgress('Waking the physics of Aeralume…');
    const physics = await Physics.create();

    onProgress('Raising the mountains…');
    const renderer = new Renderer(canvas);
    const sceneMgr = new SceneManager();
    const input = new InputManager(canvas);
    const bus = new EventBus();
    const assets = new AssetManager(renderer.gl);
    const world = new WorldManager(sceneMgr, physics, assets, bus);
    world.build();

    onProgress('Lighting the Waylights…');
    const waylights = new WaylightSystem(bus, audio);
    waylights.buildVillageTower(world.ctx);
    const dayNight = new DayNightSystem(sceneMgr, world.sky, bus, world.ctx.nightGlow, world.ctx.lampLights);
    const weather = new WeatherManager(bus, audio);
    sceneMgr.effectsGroup.add(weather.rain);

    onProgress('Welcoming the villagers…');
    const player = new PlayerController(
      physics,
      sceneMgr.characterGroup,
      audio,
      save.appearance,
      save.position,
      save.yaw
    );
    const tpCamera = new ThirdPersonCamera(save.yaw + Math.PI);
    const npcs = new NPCManager(sceneMgr.characterGroup, bus, () => player.position);
    const spirits = new SpiritManager(sceneMgr.characterGroup, bus, audio);
    const friendship = new FriendshipSystem(bus);
    const inventory = new PlayerInventory(bus);
    const quests = new QuestManager(bus, inventory);
    const interactions = new InteractionController();
    const crafting = new CraftingSystem(bus, audio, inventory, player);
    const gathering = new GatheringSystem(
      sceneMgr.worldGroup,
      sceneMgr.effectsGroup,
      bus,
      audio,
      inventory,
      player,
      interactions
    );
    const housing = new HousingManager(sceneMgr.worldGroup, bus, audio);
    const fishing = new FishingGame(bus, audio, inventory, player);
    const emotes = new EmoteSystem(bus, audio, player);
    const network = new NetworkManager(sceneMgr.characterGroup, bus);
    const perf = new PerformanceManager(renderer, bus);

    onProgress('Setting the table…');
    const ui = new UIManager(bus, input);
    const hud = new HUD(ui.root, bus, quests);
    const dialogueCtrl = new DialogueController(
      bus,
      (c) => game.evalCondition(c),
      (e) => game.runEffects(e)
    );
    quests.runEffects = (e) => game.runEffects(e);
    const dialogueUI = new DialogueUI(ui.root, dialogueCtrl, audio);
    const emoteWheel = new EmoteWheel(ui.root, (id) => {
      emotes.play(id);
    });
    const housingUI = new HousingUI(ui.root, housing, () => game.exitBuildMode());
    new FishingUI(ui.root, fishing);
    const mobile = new MobileControls(ui.root, input);
    mobile.setVisible(isTouchDevice());

    const game = new Game(
      renderer, sceneMgr, input, audio, saveManager, physics, world, dayNight,
      weather, waylights, player, tpCamera, npcs, spirits, friendship, inventory,
      quests, dialogueCtrl, crafting, gathering, housing, fishing, emotes,
      network, interactions, perf, ui, hud, dialogueUI, emoteWheel, housingUI,
      mobile, save
    );
    // The bus created above is the game's — swap in the shared instance.
    game.rebindBus(bus);

    onProgress('Remembering your journey…');
    game.applySave(save);
    game.registerPanels();
    game.registerInteractables();
    game.registerEventReactions();
    game.applySettings();
    // Overlays are built after construction so they can close over `game`.
    game.buildOverlays();
    network.start(save.settings.mockPlayers && GameConfig.networkMode === 'mock');
    return game;
  }

  /** The constructor initializes `bus` before create() can inject the shared one. */
  private rebindBus(bus: EventBus): void {
    (this as { bus: EventBus }).bus = bus;
  }

  /* ============================== save/load ============================= */

  private applySave(save: SaveData): void {
    this.dayNight.timeOfDay = save.timeOfDay;
    this.dayNight.day = save.day;
    this.inventory.load(save.inventory, save.activeTool);
    this.quests.load(save.quests);
    this.friendship.load(save.friendships);
    this.friendship.nameResolver = (id) =>
      this.npcs.get(id)?.def.name ?? this.spirits.nameOf(id);
    this.spirits.load(save.echoBonds, save.calmedEchoes);
    for (const id of save.calmedEchoes) this.spirits.get(id)?.calm();
    this.waylights.applySave(save.restoredWaylights);
    this.housing.load(save.housing);
    this.fishing.loadCaught(save.fishCaught);
    this.flags = new Set(save.flags);
    // A fresh save has no quests, so nothing was tracked and the HUD objective
    // box stayed hidden until the player happened to find Mira. Start the main
    // chapter up front so there's always an active mission to follow.
    // `start()` no-ops on an existing state, so loaded saves are untouched.
    if (!this.quests.isStarted('ch1_silent_waylight')) {
      this.quests.start('ch1_silent_waylight');
    }
    this.hud.refreshObjectives();
    this.hud.setTool(this.inventory.activeTool);
    // Re-scatter quest seeds if the player saved mid-step.
    if (this.flags.has('seeds_scattered')) this.scatterSeeds();
    // Restore Piproot's distressed state mid-chapter.
    const ch1Step = this.quests.stepIndex('ch1_silent_waylight');
    if (ch1Step >= 3 && ch1Step <= 5 && !this.quests.isCompleted('ch1_silent_waylight')) {
      this.spirits.get('piproot')?.setDistressed(true);
    }
  }

  buildSaveData(): SaveData {
    const p = this.player.position;
    const spiritState = this.spirits.serialize();
    return {
      ...this.save,
      version: GameConfig.saveVersion,
      playerName: this.playerName,
      appearance: this.appearance,
      position: { x: p.x, y: p.y, z: p.z },
      yaw: this.player.yaw,
      timeOfDay: this.dayNight.timeOfDay,
      day: this.dayNight.day,
      inventory: this.inventory.serialize(),
      activeTool: this.inventory.activeTool,
      quests: this.quests.serialize(),
      flags: Array.from(this.flags),
      friendships: this.friendship.all(),
      echoBonds: spiritState.bonds,
      calmedEchoes: spiritState.calmed,
      restoredWaylights: this.waylights.restoredIds,
      housing: this.housing.serialize(),
      fishCaught: this.fishing.fishCaught,
      updatedAt: Date.now(),
    };
  }

  async saveNow(manual: boolean): Promise<void> {
    await this.saveManager.save(this.buildSaveData());
    this.bus.emit('save:completed', { manual });
    if (manual) this.bus.emit('notify', { text: 'Journey saved', icon: '💾' });
  }

  /* ======================= conditions & effects ======================== */

  evalCondition(c?: DialogueCondition): boolean {
    if (!c) return true;
    if (c.questAt && !this.quests.questAt(c.questAt.quest, c.questAt.step)) return false;
    if (c.questActive && !this.quests.isActive(c.questActive)) return false;
    if (c.questCompleted && !this.quests.isCompleted(c.questCompleted)) return false;
    if (c.notQuestStarted && this.quests.isStarted(c.notQuestStarted)) return false;
    if (c.hasItem && !this.inventory.has(c.hasItem.id, c.hasItem.qty)) return false;
    if (c.flag && !this.flags.has(c.flag)) return false;
    if (c.notFlag && this.flags.has(c.notFlag)) return false;
    if (c.friendshipAtLeast && this.friendship.level(c.friendshipAtLeast.id) < c.friendshipAtLeast.level)
      return false;
    if (c.phase && this.dayNight.phase !== c.phase) return false;
    return true;
  }

  runEffects(e?: DialogueEffects): void {
    if (!e) return;
    if (e.giveItems) for (const g of e.giveItems) this.inventory.add(g.id, g.qty);
    if (e.takeItems) for (const t of e.takeItems) this.inventory.remove(t.id, t.qty);
    if (e.friendship) this.friendship.add(e.friendship.id, e.friendship.delta);
    if (e.echoBond) this.spirits.addBond(e.echoBond.id, e.echoBond.delta);
    if (e.calmEcho) this.spirits.calm(e.calmEcho);
    if (e.setFlag && !this.flags.has(e.setFlag)) {
      this.flags.add(e.setFlag);
      this.bus.emit('flag:set', { flag: e.setFlag });
    }
    if (e.startQuest) this.quests.start(e.startQuest);
    if (e.unlockRecipe) this.flags.add(`recipe_${e.unlockRecipe}`);
    if (e.openCrafting) this.ui.open('crafting');
    if (e.openCustomization) void this.openCustomization();
    this.hud.setTool(this.inventory.activeTool);
  }

  /* ============================== overlays ============================= */

  /**
   * Always-on overlays: minimap, village feed, wallet/back strip. Built after
   * the constructor so their callbacks can reference `this`.
   */
  private buildOverlays(): void {
    // --- founder nameplate above the character ---
    this.player.setName(this.playerName);

    // --- minimap (click or M for the full map) ---
    this.miniMap = new MiniMap(this.ui.root, () => this.ui.toggle('map'));
    this.miniMap.getPlayer = () => {
      const p = this.player.position;
      return { x: p.x, z: p.z, yaw: this.tpCamera.yaw + Math.PI };
    };
    this.miniMap.start();

    // --- simulated village feed ---
    this.chat = new ChatUI(this.ui.root, this.bus, this.playerName, (focused) => {
      // Typing must not drive the player. On blur, defer to whether a panel is
      // open rather than clearing uiMode outright.
      this.input.uiMode = focused || this.ui.isOpen();
    });
    this.chat.start();

    // --- wallet status + back to landing ---
    this.statusBar = new StatusBar(this.ui.root, () => {
      void this.saveNow(false).then(() => {
        window.location.href = './index.html';
      });
    });

    // On touch, the on-screen sticks need the room.
    if (isTouchDevice()) {
      this.chat.setVisible(false);
    }
  }

  /* ============================ registration =========================== */

  private registerPanels(): void {
    const close = () => this.ui.closeAll();
    const inventoryUI = new InventoryUI(close, this.inventory);
    inventoryUI.onToolEquipped = (id) => this.hud.setTool(id);
    this.ui.register(inventoryUI.panel);
    this.ui.register(new CraftingUI(close, this.crafting, this.inventory).panel);
    this.ui.register(new QuestUI(close, this.quests).panel);
    const mapUI = new MapUI(close);
    mapUI.getPlayer = () => {
      const p = this.player.position;
      return { x: p.x, z: p.z, yaw: this.tpCamera.yaw + Math.PI };
    };
    this.ui.register(mapUI.panel);
    this.ui.register(
      new JournalUI(close, this.spirits, this.friendship, this.npcs, this.fishing).panel
    );
    const settingsUI = new SettingsUI(this.save.settings, {
      onResume: close,
      onOpenJournal: () => this.ui.open('journal'),
      onSaveNow: () => void this.saveNow(true),
      onExport: () => this.saveManager.exportToFile(this.buildSaveData()),
      onImport: () => {
        void this.saveManager.importFromFile().then((data) => {
          if (data) {
            void this.saveManager.save(data).then(() => window.location.reload());
          } else {
            this.bus.emit('notify', { text: 'Could not read that save file', icon: '⚠️' });
          }
        });
      },
      onReset: () => {
        void this.saveManager.clear().then(() => window.location.reload());
      },
      onQuitToTitle: () => {
        void this.saveNow(false).then(() => window.location.reload());
      },
      onSettingsChanged: () => this.applySettings(),
    });
    this.ui.register(settingsUI.panel);
  }

  private startDialogueWith(id: string, speaker: string, key: string, npc?: NPC): void {
    const entries = DIALOGUES[key];
    if (!entries) {
      console.warn(`[Game] missing dialogue for key "${key}"`);
      return;
    }
    if (npc) {
      npc.startTalking();
      this.talkingNpc = npc;
      this.tpCamera.focusOn(npc.position.add(new THREE.Vector3(0, 1.35, 0)));
    } else {
      const echo = this.spirits.get(id);
      if (echo) this.tpCamera.focusOn(echo.position.add(new THREE.Vector3(0, 0.6, 0)));
    }
    this.player.inputEnabled = false;
    this.dialogue.start(id, speaker, entries);
  }

  private registerInteractables(): void {
    // Villagers.
    for (const npc of this.npcs.all()) {
      this.interactions.register({
        id: `npc-${npc.id}`,
        position: () => npc.position,
        prompt: `Talk to ${npc.def.name}`,
        radius: 2.9,
        enabled: () => !this.dialogue.active && npc.rig.root.visible,
        onInteract: () => this.startDialogueWith(npc.id, npc.def.name, npc.def.dialogueKey, npc),
      });
    }

    // Echo spirits speak in chimes the lantern translates.
    for (const echo of this.spirits.all()) {
      this.interactions.register({
        id: `echo-${echo.def.id}`,
        position: () => echo.position,
        prompt: () => (echo.calmed ? `Visit ${echo.def.name}` : `Listen to ${echo.def.name}`),
        radius: 2.6,
        enabled: () => !this.dialogue.active && echo.group.visible,
        onInteract: () => this.startDialogueWith(echo.def.id, echo.def.name, echo.def.id),
      });
    }

    // Community crafting pavilion.
    const pavPos = new THREE.Vector3(
      POI.craftingPavilion.x,
      terrainHeight(POI.craftingPavilion.x, POI.craftingPavilion.z) + 0.9,
      POI.craftingPavilion.z
    );
    this.interactions.register({
      id: 'crafting-pavilion',
      position: pavPos,
      prompt: 'Use the crafting bench',
      radius: 3.2,
      onInteract: () => this.ui.open('crafting'),
    });

    // Notice board opens the quest journal.
    this.interactions.register({
      id: 'notice-board',
      position: new THREE.Vector3(
        POI.noticeBoard.x,
        terrainHeight(POI.noticeBoard.x, POI.noticeBoard.z) + 1.2,
        POI.noticeBoard.z
      ),
      prompt: 'Read the notice board',
      radius: 2.6,
      onInteract: () => this.ui.open('quests'),
    });

    // The silent Waylight.
    this.interactions.register({
      id: 'village-waylight',
      position: new THREE.Vector3(
        POI.waylightTower.x,
        terrainHeight(POI.waylightTower.x, POI.waylightTower.z) + 1.5,
        POI.waylightTower.z
      ),
      prompt: () =>
        this.waylights.isRestored('village_waylight')
          ? 'Feel the Signal Tower hum'
          : this.inventory.has('lantern_lens')
            ? 'Bring the Signal Tower online'
            : 'The Signal Tower is dark…',
      radius: 3.6,
      onInteract: () => {
        if (this.waylights.isRestored('village_waylight')) {
          this.bus.emit('notify', { text: 'The Signal Tower sings — Kiriko Vale is on the map.', icon: '✨' });
          return;
        }
        if (this.inventory.has('lantern_lens')) {
          this.inventory.remove('lantern_lens');
          this.waylights.restore('village_waylight');
          this.hud.setTool(this.inventory.activeTool);
        } else {
          this.bus.emit('notify', { text: 'It needs a crafted Signal Lens.', icon: '🔍' });
        }
      },
    });

    // Fishing spots.
    const pierPos = new THREE.Vector3(
      POND.x + POND.radius - 2.2,
      terrainHeight(POND.x + POND.radius - 2.2, POND.z) + 0.4,
      POND.z
    );
    this.interactions.register({
      id: 'fishing-pond',
      position: pierPos,
      prompt: () => (this.fishing.canFish() ? 'Fish from the pier' : 'Fish (needs a fishing rod)'),
      radius: 3,
      enabled: () => !this.fishing.active,
      onInteract: () => {
        if (this.fishing.canFish()) this.fishing.begin('pond', this.dayNight.phase === 'night');
        else this.bus.emit('notify', { text: 'Mira rewards helpers with her old rod…', icon: '🎣' });
      },
    });
    this.interactions.register({
      id: 'fishing-river',
      position: new THREE.Vector3(112, terrainHeight(112, 52) + 0.4, 52),
      prompt: () => (this.fishing.canFish() ? 'Fish in the river' : 'Fish (needs a fishing rod)'),
      radius: 3.4,
      enabled: () => !this.fishing.active,
      onInteract: () => {
        if (this.fishing.canFish()) this.fishing.begin('river', this.dayNight.phase === 'night');
        else this.bus.emit('notify', { text: 'You need a fishing rod.', icon: '🎣' });
      },
    });

    // Festival stage — perform!
    this.interactions.register({
      id: 'festival-stage',
      position: new THREE.Vector3(
        POI.festivalStage.x,
        terrainHeight(POI.festivalStage.x, POI.festivalStage.z) + 0.8,
        POI.festivalStage.z
      ),
      prompt: 'Perform on the stage',
      radius: 4.6,
      onInteract: () => this.emotes.play('dance'),
    });

    // Home plot sign.
    this.interactions.register({
      id: 'home-plot',
      position: new THREE.Vector3(
        POI.homePlot.x,
        terrainHeight(POI.homePlot.x, POI.homePlot.z) + 1,
        POI.homePlot.z
      ),
      prompt: () => (this.housing.active ? 'Build mode active' : 'Shape your sanctuary (H)'),
      radius: 8,
      enabled: () => !this.housing.active,
      onInteract: () => this.enterBuildMode(),
    });
  }

  private registerEventReactions(): void {
    this.interactions.onPromptChange = (prompt) => this.hud.setPrompt(prompt);
    this.bus.on('dialogue:ended', () => {
      this.talkingNpc?.stopTalking();
      this.talkingNpc = null;
      this.tpCamera.clearFocus();
      this.player.inputEnabled = true;
    });
    this.bus.on('flag:set', ({ flag }) => {
      if (flag === 'seeds_scattered') this.scatterSeeds();
    });
    // Piproot shivers, gray and distressed, until its seeds come home.
    this.bus.on('quest:advanced', ({ id, step }) => {
      if (id === 'ch1_silent_waylight' && step === 3) {
        this.spirits.get('piproot')?.setDistressed(true);
      }
    });
    this.bus.on('quest:completed', ({ id }) => {
      if (id === 'ch1_silent_waylight') {
        this.audio.playSfx('quest');
        this.weather.setWeather('clear', false);
        this.bus.emit('notify', {
          text: 'Chapter One complete! Kiriko Vale is back online — your startup has a home. (Chapter Two arrives in a future build.)',
          icon: '🎆',
        });
        for (const npc of this.npcs.all()) this.friendship.add(npc.id, 2);
      }
    });
    this.bus.on('item:added', () => this.hud.setTool(this.inventory.activeTool));
    // Piproot's ability: once calmed, it reveals buried crafting materials.
    this.bus.on('echo:calmed', ({ echoId }) => {
      if (echoId === 'piproot') {
        this.gathering.addNode({ id: 'piproot_gift1', type: 'glowmoss', item: 'glow_moss', x: 152, z: 77 });
        this.gathering.addNode({ id: 'piproot_gift2', type: 'glowmoss', item: 'glow_moss', x: 148, z: 82 });
      }
    });
  }

  private scatterSeeds(): void {
    const spots: [number, number][] = [
      [146, 74],
      [155, 85],
      [147, 87],
    ];
    spots.forEach(([x, z], i) => this.gathering.spawnSpecial(`seed${i}`, 'lost_seed', x, z));
  }

  /* ============================ customization =========================== */

  private async openCustomization(): Promise<void> {
    this.ui.closeAll();
    this.input.uiMode = true;
    const result = await new CustomizationUI().show(
      this.ui.root,
      this.playerName,
      this.appearance,
      'Looking good!'
    );
    this.input.uiMode = false;
    if (result) {
      this.playerName = result.name;
      this.appearance = result.appearance;
      this.player.rebuildAppearance(result.appearance);
      // The tailor can rename, and rebuildAppearance restores the previous
      // tag — so push the new name explicitly.
      this.player.setName(this.playerName);
      this.bus.emit('notify', { text: 'A fresh look!', icon: '🧵' });
    }
  }

  /* ============================== build mode ============================ */

  private enterBuildMode(): void {
    const p = this.player.position;
    if (!this.housing.isInsidePlot(p.x, p.z)) {
      this.bus.emit('notify', { text: 'Build mode works at your sanctuary plot (see map 🏡)', icon: '🔨' });
      return;
    }
    this.housing.enterBuildMode();
    this.housingUI.show();
  }

  exitBuildMode(): void {
    this.housing.exitBuildMode();
    this.housingUI.hide();
  }

  /* ================================ tools =============================== */

  private useTool(): void {
    const tool = this.inventory.activeTool;
    if (!tool) {
      this.bus.emit('notify', { text: 'No tool equipped (Tab → tap a tool)', icon: '🎒' });
      return;
    }
    if (tool === 'fishing_rod') {
      const p = this.player.position;
      const nearPond = Math.hypot(p.x - POND.x, p.z - POND.z) < POND.radius + 4;
      const nearRiver = Math.hypot(p.x - 112, p.z - 52) < 6;
      if (nearPond) this.fishing.begin('pond', this.dayNight.phase === 'night');
      else if (nearRiver) this.fishing.begin('river', this.dayNight.phase === 'night');
      else this.bus.emit('notify', { text: 'Find open water to cast.', icon: '🎣' });
    } else if (tool === 'spirit_lantern') {
      this.audio.playSfx('chime');
      this.player.playAction('heart');
      let heard = false;
      for (const echo of this.spirits.all()) {
        if (echo.position.distanceTo(this.player.position) < 7) heard = true;
      }
      this.bus.emit('notify', {
        text: heard ? 'Nearby Echoes shimmer in answer…' : 'The lantern glows softly.',
        icon: '🏮',
      });
    }
  }

  /* ================================ loop ================================ */

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastFrame = performance.now();
    const frame = () => {
      if (!this.running) return;
      requestAnimationFrame(frame);
      const now = performance.now();
      const dt = Math.min(0.05, (now - this.lastFrame) / 1000);
      this.lastFrame = now;
      this.elapsed += dt;
      this.update(dt);
    };
    requestAnimationFrame(frame);
  }

  stop(): void {
    this.running = false;
    // The overlays drive their own rAF/timers, so they'd keep running otherwise.
    this.miniMap?.stop();
    this.chat?.stop();
  }

  private update(dt: number): void {
    const t = this.elapsed;
    this.perf.update(dt);
    this.input.pollGamepad();

    /* ---- global keys ---- */
    if (this.input.consumeAction('menu')) {
      if (this.ui.isOpen()) this.ui.closeAll();
      else if (this.emoteWheel.isOpen) this.emoteWheel.hide();
      else if (this.housing.active) this.exitBuildMode();
      else if (this.fishing.active) this.fishing.cancel();
      else if (this.dialogue.active) this.dialogue.skip();
      else this.ui.open('menu');
    }
    if (!this.input.uiMode && !this.dialogue.active && !this.fishing.active) {
      if (this.input.consumeAction('inventory')) this.ui.toggle('inventory');
      if (this.input.consumeAction('map')) this.ui.toggle('map');
      if (this.input.consumeAction('quests')) this.ui.toggle('quests');
      if (this.input.consumeAction('emote')) this.emoteWheel.toggle();
      if (!this.housing.active && this.input.consumeAction('housing')) this.enterBuildMode();
      else if (this.housing.active && this.input.consumeAction('housing')) this.exitBuildMode();
      if (!this.housing.active && this.input.consumeAction('tool')) this.useTool();
    }

    /* ---- mode-specific input ---- */
    if (this.dialogue.active) {
      this.player.inputEnabled = false;
      if (this.input.consumeAction('interact')) this.dialogueUI.advance();
    } else if (this.fishing.active) {
      this.fishing.update(dt, this.input);
    } else if (this.housing.active) {
      this.player.inputEnabled = true;
      const p = this.player.position;
      this.housing.updateGhost(p.x, p.z, this.player.yaw);
      const def = this.housing.selectedDef;
      const v = this.housing.currentValidity;
      this.housingUI.setValidity(
        v === 'ok',
        def
          ? v === 'ok'
            ? `${def.name}: ready to place`
            : v === 'outside'
              ? 'Outside your plot'
              : v === 'overlap'
                ? 'Too crowded here'
                : 'Needs solid support'
          : 'Pick an item below'
      );
      if (this.input.consumeAction('interact')) this.housing.confirmPlace();
      if (this.input.consumeAction('rotate')) this.housing.rotateGhost();
      if (this.input.consumeAction('snap')) this.housing.toggleSnap();
      if (this.input.consumeAction('tool')) this.housing.recolorGhost();
      if (this.input.consumeAction('cancel')) this.housing.removeNearest(p.x, p.z);
    } else {
      this.player.inputEnabled = true;
    }

    /* ---- simulation ---- */
    this.player.update(dt, t, this.input, this.tpCamera.yaw);
    const playerPos = this.player.position;
    this.tpCamera.sensitivity = this.save.settings.cameraSensitivity;
    this.tpCamera.invertY = this.save.settings.invertY;
    this.tpCamera.update(
      dt,
      this.input,
      this.player.headPosition,
      this.player.yaw,
      this.player.horizontalSpeed > 0.5,
      this.sceneMgr.cameraBlockers,
      t
    );

    const interactPressed =
      !this.dialogue.active &&
      !this.fishing.active &&
      !this.housing.active &&
      !this.input.uiMode &&
      this.input.consumeAction('interact');
    this.interactions.update(playerPos, interactPressed);

    this.npcs.update(dt, t, this.dayNight.timeOfDay, playerPos);
    this.spirits.update(dt, t, playerPos, this.dayNight.phase === 'night');
    this.world.update(dt, t, playerPos);
    this.dayNight.update(dt, this.weather.modifiers, playerPos, this.perf.current.fogFar);
    this.weather.update(dt, this.tpCamera.camera.position, this.dayNight.phase === 'night');
    this.waylights.update(dt, t);
    this.gathering.update(dt, t);
    this.network.update(dt, t, playerPos, this.player.yaw, this.player.animator.locomotion);
    this.quests.checkReach(playerPos.x, playerPos.z);
    this.physics.step(dt);

    /* ---- ambience ---- */
    const mood =
      this.weather.modifiers.rainStrength > 0.3
        ? 'rain'
        : this.dayNight.phase === 'night'
          ? 'night'
          : Math.hypot(playerPos.x, playerPos.z) < 55
            ? 'village'
            : 'valley';
    this.audio.setMood(mood);

    /* ---- HUD & autosave ---- */
    this.hud.showFps = this.save.settings.showFps;
    this.hud.updateClock(this.dayNight.timeOfDay, this.dayNight.day, this.weather.icon(), this.perf.fps);
    this.autosaveTimer -= dt;
    if (this.autosaveTimer <= 0) {
      this.autosaveTimer = GameConfig.autosaveSeconds;
      void this.saveNow(false);
    }

    this.updateTutorial(dt);
    this.input.endFrame();
    this.postfx.enabled = this.save.settings.stylizedOutlines && this.perf.current.postfx;
    this.postfx.render(this.sceneMgr.scene, this.tpCamera.camera);
  }

  /** Gentle contextual hints instead of tutorial walls. */
  private updateTutorial(dt: number): void {
    if (this.flags.has('tutorial_done')) return;
    this.tutorialTimer -= dt;
    if (this.tutorialTimer > 0) return;
    const touch = isTouchDevice();
    switch (this.tutorialStage) {
      case 0:
        this.bus.emit('notify', {
          text: touch ? 'Drag the left stick to walk' : 'WASD to walk · hold Shift to jog',
          icon: '🚶',
        });
        this.tutorialTimer = 6;
        break;
      case 1:
        this.bus.emit('notify', {
          text: touch ? 'Swipe the right side to look around' : 'Drag the mouse to look · scroll to zoom',
          icon: '🎥',
        });
        this.tutorialTimer = 6;
        break;
      case 2:
        this.bus.emit('notify', { text: 'Find Mira Vale by the dark Signal Tower', icon: '🧭' });
        this.flags.add('tutorial_done');
        break;
    }
    this.tutorialStage++;
  }

  applySettings(): void {
    const s = this.save.settings;
    this.audio.setVolumes(s.masterVolume, s.musicVolume, s.sfxVolume);
    this.perf.setPreset(s.quality);
    this.world.setGrassDensity(this.perf.current.grassDensity);
    this.dayNight.setShadowMapSize(this.perf.current.shadowMapSize);
    this.mobile.setVisible(isTouchDevice());
    if (GameConfig.networkMode === 'mock') {
      if (s.mockPlayers) this.network.start(true);
      else this.network.stop();
    }
  }
}
