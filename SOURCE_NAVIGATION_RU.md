## Быстрая навигация — этапы 16–17: модели и визуальные эффекты

- `src/02-geometry.js`: `makeRoundedBox`, `makeEnergyBeam`, `makeSparkOrb` — скруглённый корпус, энергетический луч, искра с плавными нормалями.
- `src/01-webgl-shaders.js`: регистрирует `geom.rounded`, `geom.tracer`, `geom.spark` при старте.
- `src/07-robot-foundry-core.js`: `robotMaker.ellipsoid`, `robotMaker.rod`; `src/08-robot-foundry-rigs.js`: сглаженные внутренние корпуса и шарниры.
- `src/09a-player-third-person.js`: округлённый костюм и запасной Canvas-контур.
- `src/09-robot-foundry-artifacts.js`: `buildRobotAirframeVariant`, `airRobotVariants` — разные обводы трёх новых летающих классов.
- `src/10-first-person-render.js`: `drawEnergyTail`, GPU-выстрелы и искры; `src/11-fallback-render.js`: светящиеся Canvas-выстрелы.
- `src/13-enemy-navigation-spawn.js`, `src/17-weapon-combat.js`, `src/18-ai-and-abilities.js`: постоянный `maxLife` частицы для корректного fade.
- Проверки: `tests/test_stage16_smooth_models.cjs`, `tests/test_stage17_visual_effects.cjs`.

---

## Быстрая навигация — этап 15: боевые летательные роботы

- `src/12-arsenal-and-game.js`: характеристики `skyhunter`, `skyguard`, `stormray` и `drone`.
- `src/13-enemy-navigation-spawn.js`: `spawnEnemy`, `spawnWave` — физически безопасное появление, этапы допуска и броня небесного стража.
- `src/18-ai-and-abilities.js`: `updateFlyingRobot` — плавная смена высоты, объезд под платформами; `enemyFire` — трёхмерная баллистика и новые залпы.
- `src/03-height-and-collision.js`, `src/13a-enemy-world-navigation.js`: поддержка воздушных акторов без привязки к полу, столкновения с мешами, толпой и грунтом.
- `src/14-combat-raycast.js`, `src/17-weapon-combat.js`, `src/09-robot-foundry-artifacts.js`, `src/11-fallback-render.js`: согласованные крылья/турбины, хитбоксы и отображение воздушных классов.
- `src/20-minimap-and-checkpoint.js`: воздушные отметки на карте, миграция старых чекпоинтов.
- `src/27-main-loop-diagnostics.js`: `__neonTest.airRobotStatus()` и DEV-only `developerSummonFlyer(type)`.
- `tests/test_stage15_flying_robots.cjs`, опциональный `tests/browser_stage15.py`; отчёт `QUALITY_STAGE15_RU.md`.

---

Этап 10: динамическое избегание NPC — `src/13a-enemy-world-navigation.js` (`enemyCrowdAllows`, `enemyCrowdRadius`, `enemyMove`); обязательная проверка каждого микрошагa — `src/03-height-and-collision.js`; экранная диагностика `src/27-main-loop-diagnostics.js`; тесты stage10.

## Быстрая навигация — этап 9

- `src/13a-enemy-world-navigation.js`: `enemyCanOccupy`, `enemyNavTile`, `enemyNavEdge`, `enemyPathClear`, `enemyDirectRoute`, `enemyMove`, `enemyBodyHeight` — ключевые функции 3D-движения и локального обхода.
- `src/13-enemy-navigation-spawn.js`: `rebuildNavigation`, `enemyHeading` — BFS на основе 2D-стен + пространственных коробок, сохранён маршрут к подъёму на мост.
- `src/03-height-and-collision.js`: `tryMoveEntity` — физические микрошаги роботов и игроков без прохода через видимую твёрдую геометрию.
- `src/05-world-mesh.js`: непрерывная верхняя линия перил и сам мост при низком/высоком качестве.
- `src/18-ai-and-abilities.js`: `updateEnemies` — выбор действий, движение с учётом укрытий, атаки (этап 8 не удалён).
- `src/27-main-loop-diagnostics.js`: `__neonTest.npcNav` — диагностика на реальном устройстве.
- `tests/test_stage9_enemy_navigation.cjs`, `tests/test_stage9_world_navigation.cjs`, `tests/browser_stage9.py`, `QUALITY_STAGE9_RU.md`.

---

## Быстрая навигация — этап 8

- `src/18-ai-and-abilities.js`: `enemyCombatClear`, `enemyMeleeReach`, `bossGroundWaveReach`, `updateEnemies` — удары и помощь роботов через реальные укрытия, отдельная атака босса и временная невосприимчивость оглушённого босса к совершению атак.
- `src/13-enemy-navigation-spawn.js`: `randFloor`, `spawnEnemy`, `spawnWave`, `damagePlayer` — спавн вне металлических конструкций, защита командира «Охоты», таймер регенерации энергии после фактического удара.
- `src/27-main-loop-diagnostics.js`: `__neonTest.coverBetween`.
- `tests/test_stage8_enemy_cover.cjs`, `tests/browser_stage8.py` — тесты уровня 8.

---

### Дополнение этапа 7

`src/03-height-and-collision.js` — `tryMoveEntity` и микрошаги движения; `src/14-combat-raycast.js` — `embeddedSolidSurface` (ближайшая грань для старта внутри металла); `src/26-input-handlers.js` — `resetTransientInput` (пауза и очистка двухпальцевых состояний). Тесты: `tests/test_stage7_contact_motion.cjs`, `tests/browser_stage7.py`.

## Дополнение этапа 6

- `src/14-combat-raycast.js`: `sweptSphereAABB` (точный контакт с гранью, ребром, углом), `sweepWorldSphere` (общая коллизия объёмного снаряда и камеры), `robotNearRay` (ранний фильтр для луча), `robotNearArea` (ранний фильтр для взрыва/ЭМИ).
- `src/17-weapon-combat.js`: `addSurfaceMark` — проекция следа на реальную грань, `splash` — фильтрация далёких роботов.
- `src/18-ai-and-abilities.js`: `useAbility` — фильтрация далёких целей ЭМИ.
- `tests/test_stage6_precision.cjs` — точная геометрия с 1200 независимыми численными эталонами, поверхностные декали, динамические роботы.

## Дополнение этапа 5

- `src/14-combat-raycast.js`: `robotAccessoryVolumes`, `robotAccessoryRay`, `rayEnemy` — дополнительные динамические части силуэта врага и лучевое попадание.
- `src/17-weapon-combat.js`: `enemyBlastSamples` — радиусный урон с учётом ближайших частей модели.
- `src/27-main-loop-diagnostics.js`: `window.__neonTest.traceRobot` — проверка луча в браузере.

## Новые узлы этапа 3 — общие препятствия мира

- `src/04a-static-world-solids.js`: `worldSolidBox`, `registerWorldSolid`, `worldSolidRayCell`, `worldSolidBodyCollision`, `worldSolidHeadBarrier`, `worldDecorObstructsRoute`, `worldSolidStats`. Главное место для изменения физических 3D-препятствий.
- `src/05-world-mesh.js`: `createWorldMesh` теперь строит визуальные объекты **и** их AABB из одинаковых координат. Разделение фаз позволяет не закрывать верхние мосты случайными подвесными конструкциями.
- `src/14-combat-raycast.js`: `rayWall`, `sweepWorldSphere`, `rebuildDecalMesh` — попадания, объёмные снаряды, границы следов.
- `src/03-height-and-collision.js`: `tryMoveEntity`, `updateVertical` — боковая коллизия игрока и удар головой.
- `src/09a-player-third-person.js`: `thirdPersonCameraPose` — учёт объёмной геометрии новой камерой.
- `src/17-weapon-combat.js`: `updateProjectiles` — коллизия ракет.
- `src/18-ai-and-abilities.js`: `updateBullets` — коллизия вражеских шаровых снарядов.
- `tests/test_world_scenes.cjs` — **реальный исходник процедурного мира** с заглушкой WebGL, мосты, пять стилей и визуальная геометрия; `tests/test_world_solids.cjs` — точечные проверки формул.

---

## Новые узлы этапа 2

- `src/09a-player-third-person.js` — `thirdPersonCameraPose`, `aimFromOperator`, `renderOperator`, `drawFallbackOperator`, `renderArmorPreview`, `toggleCameraMode`, `refreshCameraInterface`, `operatorPalette`. Это основная точка для изменений модели персонажа, камеры и её столкновений.
- `src/10-first-person-render.js` — `render`: камера WebGL и выбор отображения игрока/оружия.
- `src/11-fallback-render.js` — `renderFallback`: программная проекция камеры, силуэт в третьем лице.
- `src/17-weapon-combat.js` — `shootPellet`: траектория выстрела из персонажа с наведением через камеру.
- `src/19-gameplay-update.js` — `updateHud`: информация о цели соответствует реальной траектории.
- `src/22-menus-and-upgrades.js` — `hangar`, `armorShopHTML`, `pause`: просмотр и экипировка костюма, настройка камеры.
- `src/26-input-handlers.js` — `keydown` (F5), `#viewTouch` (Android).
- `tests/test_third_person.cjs` — тесты геометрии и коллизий камеры без браузера.
- `tests/browser_stage2.py` — реальное F5, смена вида, предпросмотр, одновременный джойстик + кнопка вида в Canvas fallback.

---

# Навигатор по исходникам NEON RIFT 3D

Основная таблица ниже первоначально составлялась из **оригинального синтаксического дерева JavaScript** и может не отражать функции, добавленные позднее. Ищите нужную функцию по имени и открывайте соответствующий `src/*.js`. Модули **НЕ** предназначены для отдельного подключения к HTML: они совместно собираются внутри исходной общей функции.

| Модуль | Описание | Размер, КБ | Функций |
|---|---|---:|---:|
| `00-core-save.js` | Состояние, настройки, сохранения, импорт и экспорт | 5.6 | 8 |
| `01-webgl-shaders.js` | WebGL: холст, материалы, шейдеры, постобработка | 22.0 | 11 |
| `02-geometry.js` | Геометрические примитивы, матрицы, WebGL draw | 5.0 | 17 |
| `03-height-and-collision.js` | Этажность, прыжки, лестницы, столкновения | 5.1 | 14 |
| `04-map-generation.js` | Алгоритм построения карт | 14.4 | 2 |
| `04a-static-world-solids.js` | **Этап 3:** геометрия и единые статические препятствия | 4+ | 8 |
| `05-world-mesh.js` | Процедурное создание трёхмерных миров | 29.1 | 1 |
| `06-world-environment.js` | Декорации, навигационные маяки, передовые враги | 2.3 | 3 |
| `07-robot-foundry-core.js` | Основы Robot Foundry и детали корпуса | 12.9 | 3 |
| `08-robot-foundry-rigs.js` | Анимация, повреждения, броня и конечности роботов | 27.8 | 8 |
| `09-robot-foundry-artifacts.js` | Плазма, датчики, части брони, обломки и модели врагов | 15.8 | 13 |
| `10-first-person-render.js` | Оружие от первого лица, основной рендер | 13.5 | 2 |
| `11-fallback-render.js` | Резервный Canvas-рендер без WebGL | 29.2 | 4 |
| `12-arsenal-and-game.js` | Данные оружия/врагов/улучшений, игрок, запуск игры | 10.4 | 5 |
| `12a-loadout-economy.js` | **НОВЫЙ**: числовая броня игрока, собственные ветки улучшения орудий, сохранения | динамич. | 5 |
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

## Этап 11 · Новая точка входа навигации
Появление NPC: `src/13-enemy-navigation-spawn.js` → `enemySpawnSpaceClear`, `randFloor`, `spawnEnemy`, `spawnWave`. Тесты: `tests/test_stage11_spawn_safety.cjs` и `tests/browser_stage11.py`.

## Этап 12 · Подъём по лестницам
Если игрок застревает перед обычной ступенью, проверяйте два независимых места:

1. `src/05-world-mesh.js` — геометрия ступеней и их декоративных антискользящих полос: полосы должны оставаться визуальными `box()`, но не попадать в `worldSolidGrid`.
2. `src/03-height-and-collision.js` — `tryMoveEntity()` и `updateVertical()`: шаг не выше 0,245 м, горизонтальное движение микрошагами, высота ног синхронизируется **при принятом микрошаге** на земле; стены/рейлинги проверяются через `worldSolidBodyCollision()`.

Тесты: `tests/test_stage12_stair_access.cjs`, `tests/browser_stage12.py`, исторический `tests/test_stage7_contact_motion.cjs`.
# Быстрый указатель по этапу 13

- Камера спереди, переключение трёх режимов: `src/09a-player-third-person.js` — `secondPersonCameraPose`, `toggleCameraMode`.
- Расход энергии при беге: `src/19-gameplay-update.js` — `sprintMotionState`.
- Прыжок с удержанием Space: `src/26-input-handlers.js` — `jumpHeld`; `src/03-height-and-collision.js` — `updateVertical`.
- Общая модернизация до уровня 40: `src/22-menus-and-upgrades.js` — `hangarData`, `permPrice`; `src/00-core-save.js` — `normalizePerms`.
- Максимальная энергия и дальность Shift: `src/12-arsenal-and-game.js` — `newPlayer`; `src/18-ai-and-abilities.js` — `useAbility('dash')`.
- Диагностика: `window.__neonTest.expansionStatus()`. Тесты: `tests/test_stage13_controls_upgrades.cjs`, `tests/browser_stage13.py`.

---

## Этап 14 — дополнительные ориентиры

| Функция | Исходник |
| --- | --- |
| Пароль DEV, смена, сброс тестовых покупок, изоляция | `src/21a-developer-mode.js` |
| Ветвление `persist()` между обычной и тестовой игрой | `src/00-core-save.js` |
| Кнопки DEV и бесконечные тестовые покупки | `src/22-menus-and-upgrades.js` |
| Ввод любого уровня 1–99 999 | `src/21-campaign-map.js` |
| `toggleFlight()` и вертикальная кинематика | `src/03-height-and-collision.js` |
| Вертикальная swept-проверка посадки | `src/04a-static-world-solids.js` |
| Двойной Space, V и кнопки на Android | `src/26-input-handlers.js` |
| Тестовый статус без секрета пароля | `src/27-main-loop-diagnostics.js`: `developerFlightStatus()` |



## Быстрая навигация — этап 18: изменяемая дальность рывка

- `src/00-core-save.js`: сохраняемое значение `settings.dashDistance` и нормализация старых/новых JSON.
- `src/19-gameplay-update.js`: измерение купленного максимума, переключение на шаг 0,24 м, боковая полоса при ↑/↓.
- `src/26-input-handlers.js`: клавиатурный обработчик стрелок и задержка автоповтора.
- `src/22-menus-and-upgrades.js`: ползунок во время паузы (включая Android).
- `src/18-ai-and-abilities.js`: фактическая дистанция горизонтального Shift/сенсорного рывка.
- `styles/40-hud.css`, `tools/index-template.html`, `dev.html`: оформление шкалы и сенсорного ползунка.
- `tests/test_stage18_dash_distance.cjs`, `QUALITY_STAGE18_RU.md`: динамические проверки и сценарии ручной приёмки.

---

