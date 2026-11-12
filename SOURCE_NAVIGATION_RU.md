# Навигатор по исходникам NEON RIFT 3D

Этот файл автоматически составлен из **оригинального синтаксического дерева JavaScript**. Ищите нужную функцию по имени и открывайте соответствующий `src/*.js`. Модули **НЕ** предназначены для отдельного подключения к HTML: они совместно собираются внутри исходной общей функции.

| Модуль | Описание | Размер, КБ | Функций |
|---|---|---:|---:|
| `00-core-save.js` | Состояние, настройки, сохранения, импорт и экспорт | 5.6 | 8 |
| `01-webgl-shaders.js` | WebGL: холст, материалы, шейдеры, постобработка | 22.0 | 11 |
| `02-geometry.js` | Геометрические примитивы, матрицы, WebGL draw | 5.0 | 17 |
| `03-height-and-collision.js` | Этажность, прыжки, лестницы, столкновения | 5.1 | 14 |
| `04-map-generation.js` | Алгоритм построения карт | 14.4 | 2 |
| `05-world-mesh.js` | Процедурное создание трёхмерных миров | 29.1 | 1 |
| `06-world-environment.js` | Декорации, навигационные маяки, передовые враги | 2.3 | 3 |
| `07-robot-foundry-core.js` | Основы Robot Foundry и детали корпуса | 12.9 | 3 |
| `08-robot-foundry-rigs.js` | Анимация, повреждения, броня и конечности роботов | 27.8 | 8 |
| `09-robot-foundry-artifacts.js` | Плазма, датчики, части брони, обломки и модели врагов | 15.8 | 13 |
| `10-first-person-render.js` | Оружие от первого лица, основной рендер | 13.5 | 2 |
| `11-fallback-render.js` | Резервный Canvas-рендер без WebGL | 29.2 | 4 |
| `12-arsenal-and-game.js` | Данные оружия/врагов/улучшений, игрок, запуск игры | 10.4 | 5 |
| `13-enemy-navigation-spawn.js` | Навигация, появление врагов, урон и смерть | 9.6 | 11 |
| `14-combat-raycast.js` | Следы попаданий, геометрические лучи и поиск целей | 3.3 | 4 |
| `15-mission-system.js` | Типы миссий, цели, маршрут и завершение | 7.9 | 12 |
| `16-mission-devices.js` | Устройства, энергетические узлы и взаимодействия | 7.4 | 8 |
| `17-weapon-combat.js` | Оружейные эффекты, выстрелы, баллистика и попадания | 7.0 | 12 |
| `18-ai-and-abilities.js` | Способности, атаки врагов, ИИ и снаряды | 11.2 | 4 |
| `19-gameplay-update.js` | Арсенал, управление, тик игры, портал, HUD | 9.4 | 11 |
| `20-minimap-and-checkpoint.js` | Миникарта, сохранение и восстановление игровой сессии | 7.7 | 5 |
| `21-campaign-map.js` | Структура кампании, уровни и экран выбора | 9.1 | 4 |
| `22-menus-and-upgrades.js` | Настройки FPS, меню, ангар, улучшения, пауза | 12.9 | 10 |
| `23-sound.js` | Web Audio, синтезированные звуковые эффекты | 0.7 | 2 |
| `24-cinematic-hooks.js` | Director’s Cut: визуальные эффекты и обёртки базовых функций | 6.9 | 5 |
| `25-cinematic-menu-perf.js` | Анимация меню и масштабирование по производительности | 5.0 | 3 |
| `26-input-handlers.js` | Клавиатура, мышь, сенсорный экран, fullscreen | 6.6 | 3 |
| `27-main-loop-diagnostics.js` | Ограничение FPS, игровой цикл, диагностика и тестовые API | 11.9 | 3 |

## Полный индекс объявлений

### `src/00-core-save.js`

Состояние, настройки, сохранения, импорт и экспорт. В оригинале: операторы 1–29.

**Функции:** `normalizeFpsLimit` (стр. 5), `getSaved` (стр. 7), `loadJournal` (стр. 8), `normalizeCampaign` (стр. 19), `persist` (стр. 36), `saveNotice` (стр. 48), `backupFile` (стр. 49), `wireBackupButtons` (стр. 67).

**Ключевые переменные:** `$`, `TAU`, `clamp`, `hypot`, `rand`, `pick`, `distance`, `game`, `lastFrame`, `deadlock`, `SAVE_KEY`, `SAVE_BACKUP_KEY`, `SAVE_SESSION_KEY`, `FPS_LIMITS`, `saveDefaults`, `loadedSave`, `save`, `CAMPAIGN_CHAPTER_SIZE`, `CAMPAIGN_MAX_LEVEL`, `campaignPage`, `storageAvailable`, `lastSavedAt`, `autosaveNoticeUntil`, `restoreInput`.

### `src/01-webgl-shaders.js`

WebGL: холст, материалы, шейдеры, постобработка. В оригинале: операторы 30–59.

**Функции:** `mix` (стр. 8), `rcolor` (стр. 8), `makeMaterialAtlases` (стр. 138), `shader` (стр. 255), `initGL` (стр. 255), `screenProgram` (стр. 272), `initScreenFx` (стр. 273), `screenQuad` (стр. 274), `backdrop` (стр. 275), `ensurePost` (стр. 276), `showPost` (стр. 277).

**Ключевые переменные:** `glCanvas`, `gl`, `worldMesh`, `worldChunks`, `meshStats`, `glReady`, `fallCtx`, `floorCanvas`, `floorCtx`, `fBackAt`, `touchOnly`, `mm`, `legacyResumeSector`, `legacyResumeDivisor`, `mapCells`, `mapSize`, `spawnX`, `spawnZ`, `portal`, `mapFeatures`, `mapRooms`, `sectorArchitecture`, `sectorStyle`, `miniZoom`, `navField`, `navClock`, `portalRouteField`, `themes`, `VS`, `FS`, `materialAlbedo`, `materialNormals`, `program`, `u`, `bufferWorld`.

### `src/02-geometry.js`

Геометрические примитивы, матрицы, WebGL draw. В оригинале: операторы 60–78.

**Функции:** `geomBegin` (стр. 2), `addTri` (стр. 2), `quad` (стр. 2), `box` (стр. 2), `toMesh` (стр. 3), `makeCube` (стр. 3), `makeOcta` (стр. 3), `makeOrb` (стр. 3), `makeRing` (стр. 4), `makeChamferedBox` (стр. 4), `makeCylinder` (стр. 15), `makePylon` (стр. 28), `model` (стр. 29), `perspective` (стр. 29), `lookAt` (стр. 30), `draw` (стр. 31), `drawWorld` (стр. 31).

**Ключевые переменные:** `ID`, `matModel`, `matView`, `matProj`.

### `src/03-height-and-collision.js`

Этажность, прыжки, лестницы, столкновения. В оригинале: операторы 79–95.

**Функции:** `deckAtCell` (стр. 5), `deckHeight` (стр. 6), `supportHeight` (стр. 7), `ceilingHeight` (стр. 13), `floorHeightAtCell` (стр. 15), `floorHeight` (стр. 19), `makeStairHeights` (стр. 20), `tryMoveEntity` (стр. 68), `queueJump` (стр. 75), `updateVertical` (стр. 76), `isWall` (стр. 107), `collide` (стр. 107), `moveEntity` (стр. 107), `lineClear` (стр. 107).

**Ключевые переменные:** `heightCells`, `deckCells`, `stairStages`, `bridgeSpecs`, `BRIDGE_Y`, `BRIDGE_RISE`, `STAIR_RISE`, `JUMP_VELOCITY`, `JUMP_GRAVITY`.

### `src/04-map-generation.js`

Алгоритм построения карт. В оригинале: операторы 96–97.

**Функции:** `buildMap` (стр. 5), `buildFloorDecal` (стр. 297).

### `src/05-world-mesh.js`

Процедурное создание трёхмерных миров. В оригинале: операторы 98–98.

**Функции:** `createWorldMesh` (стр. 2).

### `src/06-world-environment.js`

Декорации, навигационные маяки, передовые враги. В оригинале: операторы 99–101.

**Функции:** `drawEnvironmentDetails` (стр. 2), `drawRouteBeacons` (стр. 15), `drawEnemyVanguard` (стр. 27).

### `src/07-robot-foundry-core.js`

Основы Robot Foundry и детали корпуса. В оригинале: операторы 102–106.

**Функции:** `robotMaker` (стр. 11), `robotPalette` (стр. 62), `robotDetailMesh` (стр. 74).

**Ключевые переменные:** `robotFoundry`, `RF`.

### `src/08-robot-foundry-rigs.js`

Анимация, повреждения, броня и конечности роботов. В оригинале: операторы 107–114.

**Функции:** `buildRobotArticulatedPart` (стр. 5), `buildRobotAnimatedSensors` (стр. 64), `buildRobotDamageOverlay` (стр. 101), `robotArmorKit` (стр. 141), `robotForgeSilhouette` (стр. 248), `buildRobotBody` (стр. 418), `buildRobotLimb` (стр. 584), `buildRobotInsectLeg` (стр. 631).

### `src/09-robot-foundry-artifacts.js`

Плазма, датчики, части брони, обломки и модели врагов. В оригинале: операторы 115–128.

**Функции:** `buildRobotThruster` (стр. 2), `buildRobotMuzzle` (стр. 14), `buildRobotReactor` (стр. 31), `buildRobotServo` (стр. 46), `robotWrapAngle` (стр. 57), `robotApproachAngle` (стр. 58), `robotAnimationProfile` (стр. 59), `buildRobotArmorPlate` (стр. 71), `buildRobotExposedPanel` (стр. 109), `buildRobotEliteRig` (стр. 125), `buildRobotDebrisMesh` (стр. 142), `initRobotFoundry` (стр. 149), `drawEnemyModel` (стр. 169).

**Ключевые переменные:** `robotDebrisMesh`.

### `src/10-first-person-render.js`

Оружие от первого лица, основной рендер. В оригинале: операторы 129–130.

**Функции:** `renderHeldWeapon` (стр. 3), `render` (стр. 110).

### `src/11-fallback-render.js`

Резервный Canvas-рендер без WebGL. В оригинале: операторы 131–135.

**Функции:** `makeSteelAtlas` (стр. 6), `wallTexture` (стр. 65), `drawFallbackRobot` (стр. 67), `renderFallback` (стр. 186).

**Ключевые переменные:** `steelAtlas`.

### `src/12-arsenal-and-game.js`

Данные оружия/врагов/улучшений, игрок, запуск игры. В оригинале: операторы 136–144.

**Функции:** `newPlayer` (стр. 18), `freshGame` (стр. 19), `startGame` (стр. 20), `enterSector` (стр. 35), `chooseEntranceYaw` (стр. 36).

**Ключевые переменные:** `weapons`, `enemies`, `bossNames`, `upgrades`.

### `src/13-enemy-navigation-spawn.js`

Навигация, появление врагов, урон и смерть. В оригинале: операторы 145–155.

**Функции:** `rebuildNavigation` (стр. 3), `enemyHeading` (стр. 19), `randFloor` (стр. 45), `spawnEnemy` (стр. 56), `spawnWave` (стр. 57), `spawnRobotArmorDebris` (стр. 59), `updateRobotDebris` (стр. 81), `awardKill` (стр. 106), `hurtEnemy` (стр. 111), `damagePlayer` (стр. 116), `burst` (стр. 119).

### `src/14-combat-raycast.js`

Следы попаданий, геометрические лучи и поиск целей. В оригинале: операторы 156–161.

**Функции:** `rebuildDecalMesh` (стр. 6), `v3` (стр. 31), `rayWall` (стр. 32), `rayEnemy` (стр. 67).

**Ключевые переменные:** `MAX_WALL_MARKS`, `decalMesh`, `decalDirty`.

### `src/15-mission-system.js`

Типы миссий, цели, маршрут и завершение. В оригинале: операторы 162–176.

**Функции:** `missionType` (стр. 18), `missionInfo` (стр. 19), `missionLocations` (стр. 20), `startMission` (стр. 37), `missionCounter` (стр. 42), `missionFinished` (стр. 52), `maybeFinishMission` (стр. 57), `updateMission` (стр. 63), `missionWaypoint` (стр. 97), `missionStars` (стр. 110), `missionField` (стр. 114), `missionRouteTo` (стр. 131).

**Ключевые переменные:** `NODE_TYPES`, `MISSION_TYPES`, `missionGuideCache`.

### `src/16-mission-devices.js`

Устройства, энергетические узлы и взаимодействия. В оригинале: операторы 177–184.

**Функции:** `initDevices` (стр. 5), `deviceColor` (стр. 22), `completeDevice` (стр. 23), `updateDevices` (стр. 46), `drawDevices` (стр. 72), `spawnPowerNodes` (стр. 98), `rayNode` (стр. 116), `damagePowerNode` (стр. 128).

### `src/17-weapon-combat.js`

Оружейные эффекты, выстрелы, баллистика и попадания. В оригинале: операторы 185–197.

**Функции:** `sparkImpact` (стр. 2), `addSurfaceMark` (стр. 10), `addImpact` (стр. 17), `makeTracer` (стр. 25), `muzzleVisual` (стр. 30), `shotProjectile` (стр. 37), `splash` (стр. 42), `shootPellet` (стр. 59), `fireBurstShot` (стр. 93), `shoot` (стр. 100), `updatePlayerOrdnance` (стр. 111), `showDamage` (стр. 138).

**Ключевые переменные:** `ammoShots`.

### `src/18-ai-and-abilities.js`

Способности, атаки врагов, ИИ и снаряды. В оригинале: операторы 198–203.

**Функции:** `useAbility` (стр. 2), `enemyFire` (стр. 3), `updateEnemies` (стр. 11), `updateBullets` (стр. 112).

**Ключевые переменные:** `updateEnemiesBeforeRobotRig`.

### `src/19-gameplay-update.js`

Арсенал, управление, тик игры, портал, HUD. В оригинале: операторы 204–216.

**Функции:** `closeArsenal` (стр. 3), `toggleArsenal` (стр. 4), `key` (стр. 13), `update` (стр. 13), `portalNext` (стр. 16), `recordLevelCompleted` (стр. 25), `toast` (стр. 48), `portalFlow` (стр. 49), `portalRoute` (стр. 63), `navArrow` (стр. 78), `updateHud` (стр. 79).

**Ключевые переменные:** `arsenalOpened`, `input`.

### `src/20-minimap-and-checkpoint.js`

Миникарта, сохранение и восстановление игровой сессии. В оригинале: операторы 217–224.

**Функции:** `drawMinimap` (стр. 2), `pickUpgrades` (стр. 59), `saveRun` (стр. 59), `restoreLiveCheckpoint` (стр. 66), `panel` (стр. 89).

### `src/21-campaign-map.js`

Структура кампании, уровни и экран выбора. В оригинале: операторы 225–231.

**Функции:** `stageName` (стр. 5), `mapChapterMaximum` (стр. 6), `updateCampaignRoute` (стр. 7), `showCampaignMap` (стр. 36).

**Ключевые переменные:** `CAMPAIGN_ZONE_NAMES`, `LEVEL_ARCHITECTURES`.

### `src/22-menus-and-upgrades.js`

Настройки FPS, меню, ангар, улучшения, пауза. В оригинале: операторы 232–242.

**Функции:** `fpsOptionsHTML` (стр. 4), `fpsSettingsHTML` (стр. 5), `wireFpsSettings` (стр. 6), `menu` (стр. 8), `hangar` (стр. 11), `showUpgrade` (стр. 12), `pause` (стр. 15), `pauseRefresh` (стр. 16), `gameOver` (стр. 17), `switchWeapon` (стр. 18).

**Ключевые переменные:** `hangarData`.

### `src/23-sound.js`

Web Audio, синтезированные звуковые эффекты. В оригинале: операторы 243–245.

**Функции:** `audioStart` (стр. 2), `sound` (стр. 3).

**Ключевые переменные:** `ac`.

### `src/24-cinematic-hooks.js`

Director’s Cut: визуальные эффекты и обёртки базовых функций. В оригинале: операторы 246–271.

**Функции:** `dcNamedEnemy` (стр. 6), `dcBadge` (стр. 11), `dcWeaponFlash` (стр. 16), `dcSplash` (стр. 21), `dcAudioTransient` (стр. 32).

**Ключевые переменные:** `dc`, `dcMuzzleBase`, `dcDamageBase`, `dcDamageNumberBase`, `dcAwardKillBase`, `dcSwitchBase`, `dcEnterSectorBase`, `dcRenderBase`, `dcUpgradeBase`, `dcPauseBase`, `dcUpdateBase`.

### `src/25-cinematic-menu-perf.js`

Анимация меню и масштабирование по производительности. В оригинале: операторы 272–288.

**Функции:** `dcMenuResize` (стр. 7), `dcDrawMenu` (стр. 12), `resize` (стр. 61).

**Ключевые переменные:** `dcMenuCanvas`, `dcOverlay`, `dcMenuCtx`, `dcSceneW`, `dcSceneH`, `dcSceneLast`, `dcMenuBase`, `adaptiveScale`, `performanceSlow`, `performanceFast`.

### `src/26-input-handlers.js`

Клавиатура, мышь, сенсорный экран, fullscreen. В оригинале: операторы 289–311.

**Функции:** `keydown` (стр. 2), `updateFullscreenButtons` (стр. 49), `toggleFullscreen` (стр. 56).

**Ключевые переменные:** `fullscreenTransition`, `fsEl`.

### `src/27-main-loop-diagnostics.js`

Ограничение FPS, игровой цикл, диагностика и тестовые API. В оригинале: операторы 312–325.

**Функции:** `resetFpsPacing` (стр. 4), `shouldRenderFpsFrame` (стр. 7), `frame` (стр. 15).

**Ключевые переменные:** `uiTick`, `perfTick`, `fpsSamples`, `fpsTotal`, `frameBudgetMs`, `fpsLoopState`, `lastMeasuredFps`, `framesRenderedTotal`.

