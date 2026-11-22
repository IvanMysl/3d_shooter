# Новое в Stage131

`src/21k-multiplayer-nametags.js` — привязка ника к голове удалённого сетевого актёра, проекция WebGL/Canvas и фильтрация видимости через физический raycast; `styles/55-multiplayer.css` — ненавязчивые плашки. В `src/27-main-loop-diagnostics.js` вызов обновления после кадра. Полный отчёт: `QUALITY_STAGE131_OCCLUDED_NAMES_RU.md`.

---

# Stage129

В `src/21j-multiplayer-traffic.js` — разделённые состояния фокуса и IME, `mpChatDismissKeyboard`, `mpChatViewportEvent`, `mpChatFollowKeyboard`. В `styles/55-multiplayer.css` — резерв справа для системной навигации Android и кнопка `⌄`. Разметка в `tools/index-template.html` и `dev.html`. Регрессия `tests/test_stage129_chat_keyboard_restore.py`. Протокол WebRTC 43 не изменён.

# Stage128

`tools/index-template.html` и `dev.html` включают `#mpChatScroll` вокруг сообщений и формы. `styles/55-multiplayer.css` задаёт единый мобильный scroll container. `src/21j-multiplayer-traffic.js`: `mpChatScrollBox`, сохранение позиции, настройка высоты под IME и отключение автопрокрутки во время жеста. `tests/test_stage128_shared_chat_scroll.py` проверяет настоящий touch. Отчёт `QUALITY_STAGE128_SHARED_CHAT_SCROLL_RU.md`.

# Stage127

Сенсорная прокрутка и сохранение истории: `src/21j-multiplayer-traffic.js`, `styles/55-multiplayer.css`, `tests/test_stage127_chat_touch_scroll.py`. Дополнительная информация: `QUALITY_STAGE127_CHAT_TOUCH_HISTORY_RU.md`.

## Stage121 — актуальная версия (22.11.2026)

Кампания, PvP и просмотр используют общие средства создания и обновления эффектов: частицы, затухание, отдача, вспышки, трассеры, физические следы ракет и взрывы, ЭМИ, ремонт, сфера, рывок, перегрев. Специфический эффект попадания в игрока и баланс PvP сохранены. Протокол 42; для полного визуального паритета обновите оба устройства. GitHub Pages: замените `index.html`, откройте `?v=121`. Отчёт: `QUALITY_STAGE121_SHARED_EFFECT_LIFECYCLE_RU.md`.

## Stage120 — предыдущая версия (22.11.2026)

Общие эффекты кампании и PvP: выстрелы, отдача, ЭМИ, рывок, сфера, ремонт, взрывы и следы попаданий hitscan. Обычный PvP и просмотр используют общий запуск арены, боевой цикл и характеристики PvP. Снимки состояния передают нагрев оружия и его готовность; протокол 42 сохранён, новые поля необязательны. GitHub Pages: замените `index.html`, откройте `?v=120`. Отчёт: `QUALITY_STAGE120_PVP_EFFECT_PARITY_RU.md`.

## Stage119 — предыдущая версия (22.11.2026)

Исправлен визуальный и звуковой ЭМИ в тренировке и сетевой игре: вместо обычного эффекта попадания используется тот же излучатель 45 голубых частиц, что в кампании. Урон, радиус, расход энергии и перезарядка не менялись. Протокол 42. Для GitHub Pages обновите `index.html` и откройте `?v=119`. Отчёт: `QUALITY_STAGE119_SHARED_EMI_EFFECT_RU.md`.

## Stage118 — предыдущая версия (22.11.2026)

«Посмотреть» в сетевом выборе каждой карты запускает настоящую локальную тренировку по правилам PvP без соперников и соединения. Все 10 орудий (или фиксированное из формы), нагрев, выстрелы, снаряды, взрывы, способности E/Q/C/F, энергия, полёт V/Space/Shift, урон себе и возрождение работают через штатный PvP-код. F5 / «ВИД» меняет камеру только в тренировке. Таймер повторяется без фиктивного победителя. Esc / «Назад» сохраняет параметры формы. Кампания и её сохранения не затрагиваются. Протокол 42 совместим с V115–V117. Для GitHub Pages обновите `index.html`, откройте `?v=118`. Отчёт: `QUALITY_STAGE118_PVP_PRACTICE_RU.md`.

## Stage117 — предыдущая версия (22.11.2026)

В сетевой игре → «Создать игру» → раскройте семейство → нажмите «Посмотреть» возле любой из 100 карт. Открывается пустая локальная арена с той же статической геометрией и физикой движения, что в PvP. Игрок может ходить, бегать, прыгать и летать без расхода энергии. ПК: WASD, мышь, V (полёт), Space/Shift (высота), Esc («Назад»). Телефон: джойстик, перетаскивание по экрану, прыжок, полёт и кнопки ↑/↓. Кнопка «Назад» сохраняет поля формы, выбранную карту, раскрытую группу и прокрутку. Не требуется соединение, бой и сохранение отключены. Протокол 42 совместим с V115/V116. Для GitHub Pages обновите `index.html` и откройте `?v=117`.

`21b`: разметка и независимый выбор/просмотр карты; `21d`: `mpPreviewStart`, `mpPreviewEnd`, `mpPreviewUpdate`, `mpPreviewHud`; `27`: отдельная ветвь цикла; `00`, `20`: запрет сохранений; `26`, `22`: ввод/выход; `55-multiplayer.css`: адаптивные кнопки и HUD.

## Stage116 — предыдущая версия (21.11.2026)

В сетевом выборе 100 карт сгруппированы в 18 раскрываемых архитектурных семейств. Семейства 1–10 содержат по 6 карт, 11–18 — по 5. Одновременно открыта не более одной группы; выбор сохраняется после её сворачивания. Протокол 42 без изменений (совместим с V115). Для GitHub Pages замените `index.html` и откройте `?v=116`. Отчёт — `QUALITY_STAGE116_MAP_FAMILIES_RU.md`.

## Stage115 — предыдущая версия (21.11.2026)

100 карт с уникальными названиями доступны в кампании и PvP; полный список — `MAP_CATALOG_RU.md`. В одиночной игре Esc открывает паузу, повторное Esc выполняет кнопку «Меню»; для продолжения нажмите «Продолжить». В экранах с кнопками «Меню», «Назад» или «Выйти» Esc активирует соответствующую кнопку; в сетевой паузе — «Вернуться». Награда сохраняется. Сетевой протокол 42: все участники должны обновиться до V115. Для GitHub Pages замените `index.html`, после публикации откройте с `?v=115`. Исторические сведения ниже относятся к предыдущим сборкам.

## Stage114 — предрелизный аудит

- `03`: worldActorVerticalLimit / worldActorVerticalFloor, `18`, `21d`, `21g`: вертикальные контакты живых тел.
- `13`: интервалы спавна. `00`, `12`, `20`, `22`: структура сохранения, безопасное восстановление оружия и меню.
- `tests/stage114_audit_results.json`: итоговые статусы исторических скриптов.

## Stage113 — физические контакты и маршруты

- `03-height-and-collision.js`: `worldActorPairClear`, `worldActorAdvance`, `worldActorBlockers`; общие swept-проверки.
- `13a-enemy-world-navigation.js`: реальный контакт живых соседей при локальном движении.
- `15-mission-system.js`: `missionRouteLink`, `missionUpperExit`, `missionRouteTo`.
- `19-gameplay-update.js`: единый физический маршрут и HUD; `21d`, `21g`: PvP и Dash.
- `27-main-loop-diagnostics.js`: `dynamicGuidanceAudit`. Отчёт `QUALITY_STAGE113_PHYSICAL_CONTACT_AND_GUIDANCE_RU.md`.

## Stage112 — непрерывные круговые контакты

- `src/03-height-and-collision.js`: `worldCircleRectInterval`, `worldMotionProbes`, `worldActorSweepPlan`, общая проверка горизонтального сегмента в `tryMoveEntity`.
- `src/13a-enemy-world-navigation.js`: `enemyPathClear`, `enemyFlatShortcutSafe`, точный кэш конечных координат; отдельный `playerNavProfile`, `playerNavState`, `playerNavTile`, `playerNavEdge`.
- `src/15-mission-system.js`, `src/19-gameplay-update.js`: геометрия оператора для наземных миссий и маршрута к порталу.
- `src/21d-multiplayer-movement.js`, `src/21g-multiplayer-flight-abilities.js`: общий swept-план для PvP и Dash.
- `src/27-main-loop-diagnostics.js`: `continuousContactAudit`, физический профиль подсказок.
- Геометрия карт, меши, реестр AABB и баллистика не изменены. Отчёт `QUALITY_STAGE112_CONTINUOUS_CIRCULAR_SWEEPS_RU.md`.

## Stage111 — navPhysicalEdge и короткие спуски

- `src/13a-enemy-world-navigation.js`: `navStandingFeet`, `navPhysicalEdge`, `groundStandardProfile`, ревизии кэша стандартных рёбер и `enemyDirectRevisionCache` (WeakMap, без сериализации геометрии в сохранениях).
- `src/13-enemy-navigation-spawn.js`: общие интервалы контакта для верхних и chassis-aware наземных рёбер; повторное использование рёбер профиля между целями; сброс кэшей балконов/крыш/настилов по геометрии.
- `src/03-height-and-collision.js`: `worldActorMovePlan` ищет реальную нижнюю опору в пределах допустимого шага; воздушный режим прежний; PvP пользуется общей функцией.
- `src/15-mission-system.js`: кэши указателей миссий и эвакуации учитывают ревизии коллайдеров, режим рендера и настилы.
- Не менялись генератор, меш, регистрация физической геометрии, баллистика, сетевой протокол. Отчёт `QUALITY_STAGE111_PHYSICAL_NAVIGATION_INTERVALS_RU.md`.

## Stage110 — точные контакты со стальными препятствиями

- `src/04a-static-world-solids.js`: регистрация закрытых низких AABB, явное исключение плоских верхних рисунков, допуск тела 0,004 м, согласованные круговые контакты, `worldSolidStepSupport`.
- `src/03-height-and-collision.js`: легальный подъём стоящего персонажа и робота на реальный металл, без начального сдвига прыжка.
- `src/21d-multiplayer-movement.js`: устранён такой же сдвиг прыжка в PvP; общий план движения наследует новый подъём.
- `src/27-main-loop-diagnostics.js`: изолированный `lowMetalContactAudit`, уточнение старого диагностического порога.
- Отчёт: `QUALITY_STAGE110_EXACT_LOW_METAL_CONTACTS_RU.md`.

## Stage109 — полный круговой контакт с рельефом

- `03-height-and-collision.js`: `worldTerrainFootprint`, `worldActorGround`, `worldActorMovePlan`; `tryMoveEntity`, `updateVertical`.
- `04a-static-world-solids.js`: проверка сплошных колонок и точная толщина подвесных плит.
- `13-enemy-navigation-spawn.js`, `13a-enemy-world-navigation.js`, `18-ai-and-abilities.js`: реальные габариты и опоры наземных и летающих роботов.
- `21d-multiplayer-movement.js`, `21g-multiplayer-flight-abilities.js`: общий контакт PvP, полёта и рывка.
- `27-main-loop-diagnostics.js`: `terrainEdgeAudit()`.
- Отчёт: `QUALITY_STAGE109_FULL_BODY_TERRAIN_CONTACTS_RU.md`.

---

## Stage108 — проход с лестницы на мост

- `src/04a-static-world-solids.js` → `worldDeckStepSupport`: настоящая окружность соприкасается с краем плиты до входа центра в клетку; подъём разрешён только в пределах 0,245 м.
- `src/03-height-and-collision.js` → `tryMoveEntity`: игрок и наземные роботы могут подниматься и спускаться без застревания, сохраняя опору до выхода всего круглого тела.
- `src/21d-multiplayer-movement.js`, `src/21g-multiplayer-flight-abilities.js` → PvP-движение и Dash; переменная `deckStep` исключает конфликт с шагом рывка.
- `src/27-main-loop-diagnostics.js` → `bridgeStairTransitionAudit()` — реальный браузерный аудит без изменений прогресса.
- `tests/test_stage108_bridge_stair_entry.cjs`, `test_stage108_real_bridge_transitions.cjs`, `browser_stage108_bridge_stair_transitions.py` — быстрые и реальные проверки.
- Полный отчёт `QUALITY_STAGE108_BRIDGE_STAIR_TRANSITIONS_RU.md`.

---

## Stage106 — устранение видимой пустоты под сплошными лестницами

- `src/05-world-mesh.js`: `drawSolidStairRisers` — все наружные боковины сплошных поднятых ступеней доходят до физического основания y=0.
- `src/11-fallback-render.js`: `fallbackSolidRiserSpan`, DDA `nearRisers`, `stairOcclusion` — реальные ступени рисуются непрозрачными во время приближения камеры, центр спрайтов за ними скрывается.
- `src/14-combat-raycast.js`: существующий `rayWall` уже имел физически сплошные `heightCells` и не менялся.
- `src/27-main-loop-diagnostics.js`: `stairOpaqueAudit` — реальная проверка Canvas при временном подходе к лестнице, без сохранения изменений.
- Тесты `test_stage106_opaque_stair_faces.cjs`, `test_stage106_real_stair_seals.cjs` (100 карт), `browser_stage106_stair_occlusion.py`, отчёт `QUALITY_STAGE106_SOLID_STAIR_OCCLUSION_RU.md`.

---

## Stage105 — вертикальный габарит роботов

- `src/13a-enemy-world-navigation.js`: `ROBOT_MESH_TOP`, `enemyBodyHeight`, `enemyCanOccupy`, `enemyFlatShortcutSafe` — реальный рост корпуса и запрет прохода под низкой балкой на любом маршруте.
- `src/03-height-and-collision.js`: `tryMoveEntity` — проверка всего объёма при микроперемещении на конечном уровне ног.
- `src/04a-static-world-solids.js`: `worldDeckBodyCollision` и `worldSolidBodyCollision` — единая объёмная физика настоящих 0,17-м плит и оборудования Canvas/WebGL.
- `src/13-enemy-navigation-spawn.js`: финальная высота до создания, в том числе элитных и боссов.
- `src/11-fallback-render.js`: видимые `deckCells` и масштаб роботов, совпадающий с физическими габаритами.
- `src/27-main-loop-diagnostics.js`: `robotHeadroomAudit` — браузерный read-only QA.
- Новые тесты: `test_stage105_robot_headroom.cjs`, `test_stage105_render_mesh_bounds.cjs`, `test_stage105_real_low_decks.cjs`, `browser_stage105_robot_headroom.py`. Отчёт `QUALITY_STAGE105_TRUE_ROBOT_HEADROOM_RU.md`.

---

## Stage104 — физика обломков и тесты

- `src/13-enemy-navigation-spawn.js`: `updateRobotDebris` — столкновения отрезка полёта частицы с **реальными трёхмерными AABB** через `sweepWorldSphere`, отскок/трение и остановка.
- `src/14-combat-raycast.js`: существующий `sweepWorldSphere` используется без изменения кода баллистики.
- `src/27-main-loop-diagnostics.js`: `__neonTest.debrisPhysicalContacts()` — браузерный контроль без записи в сохранения.
- `tests/test_stage104_debris_world_collisions.cjs` (49), `tests/test_stage104_real_debris_physics.cjs` (100 карт), `tests/browser_stage104_debris_contacts.py` (4 конфигурации).
- Отчёт: `QUALITY_STAGE104_PHYSICAL_ROBOT_DEBRIS_RU.md`.

---

## Stage103: наземные маршруты по настоящим 3D-корпусам

- `src/13-enemy-navigation-spawn.js`: `groundChassisField`, `groundChassisEdge`, `enemyHeading`, `rebuildNavigation` — физически точная BFS для крупных наземных NPC и кэширование.
- `src/13a-enemy-world-navigation.js`: `enemyNavTile`, `enemyNavEdge` — отслеживание добавленного металла и физических концов ребра.
- `src/19-gameplay-update.js`: обновление navField при изменении worldSolidCount, оборудования, высот и игры.
- `src/27-main-loop-diagnostics.js`: `groundChassisPhysics` — QA без изменения карты.
- `tests/test_stage103_ground_chassis_routes.cjs`, `test_stage103_ground_nav_revisions.cjs`, `test_stage103_actual_ground_profiles.cjs`, `browser_stage103_ground_chassis.py`.
- Отчёт: `QUALITY_STAGE103_PHYSICAL_GROUND_NAVIGATION_RU.md`.

---

## Stage102 — новые точки входа

- `src/13-enemy-navigation-spawn.js`: `upperDeckProfile(e)`, `upperDeckEdgeClear`, `upperDeckField`, `upperDeckHeading` — размеры корпуса учитываются в высотной BFS-схеме.
- `tests/test_stage102_chassis_upper_edges.cjs` — воспроизведение Stage101-багов в настоящем production JS.
- `tests/test_stage102_real_chassis_routes.cjs` — аудит всех 100 карт, профилей и настоящих 3D-ребёр.
- `tests/test_stage102_roof_motion_subset.cjs` — быстрый реальный подъём/спуск и перенаправление на выбранных крышах.
- `tests/browser_stage102_upper_chassis.py` и `__neonTest.upperDeckChassis()` — автономный и модульный Chromium QA.

## Stage101: файлы физики верхних маршрутов

`src/03-height-and-collision.js` — предотвращение мгновенных падений NPC без гравитации; `src/13a-enemy-world-navigation.js` — проверка допустимого вертикального шага при локальном манёвре; `src/13-enemy-navigation-spawn.js` — физические рёбра и кэши верхних галерей; `src/27-main-loop-diagnostics.js` — `__neonTest.upperDeckPhysics` только для QA. Тесты `test_stage101_upper_physics.cjs`, `test_stage101_real_upper_routes.cjs`, `browser_stage101_upper_navigation.py`. Отчёт `QUALITY_STAGE101_PHYSICAL_UPPER_NAVIGATION_RU.md`.

---

## Stage100 — файлы физической защиты выхода и тонких кромок

`src/19-gameplay-update.js` → `physicalPortalContact`, `update`, `updateHud`; `src/04a-static-world-solids.js` → `worldLootPickupClear`, `worldLootSpawn`; `src/27-main-loop-diagnostics.js` → `__neonTest.physicalExtractionAudit`, `physicalExtractionGameplay`; `src/00-core-save.js` → метка версии 100. Адресные тесты `tests/test_stage100_physical_portal_contact.cjs`, `tests/test_stage100_precision_loot_contact.cjs`, `tests/test_stage100_real_physical_extraction.cjs`, `tests/browser_stage100_physical_extraction.py`. Полный отчет `QUALITY_STAGE100_PHYSICAL_EXTRACTION_BOUNDARIES_RU.md`.

---

## Stage99 (новая основа исходников)

`src/04a-static-world-solids.js` — `worldLootPickupClear`, `worldLootSpawn`, точная ширина динамического корпуса станции. `src/13-enemy-navigation-spawn.js` — выпавшие с роботов предметы. `src/16-mission-devices.js` — физические бонусы контейнеров. `src/18-ai-and-abilities.js` — сбор в боевом цикле. `src/10-first-person-render.js`, `src/11-fallback-render.js` — реальная высота бонуса. `src/27-main-loop-diagnostics.js` — физическая проба для браузерных тестов. Результаты и ограничения: `QUALITY_STAGE99_PHYSICAL_LOOT_EQUIPMENT_RU.md`.

---

**Stage98** — `src/15-mission-system.js` (missionType, startMission, missionRefreshCombinedProgress, updateMission, missionWaypoint), `src/16-mission-devices.js` (initDevices, completeDevice, damagePowerNode), `src/13-enemy-navigation-spawn.js` (forceElite, резерв слота командира), `src/20-minimap-and-checkpoint.js` (миграция старых recovery checkpoints), `src/27-main-loop-diagnostics.js` (stage98 QA), тесты `tests/test_stage98_signal_surge_operations.cjs`, `tests/test_stage98_actual_signal_surge.cjs`, `tests/browser_stage98_signal_surge.py`, отчет `QUALITY_STAGE98_SIGNAL_RESONANCE_MISSIONS_RU.md`.

---

**Stage97:** `src/15-mission-system.js` — два новых типа и фазы, `src/16-mission-devices.js` — связывание реальных coils/reactors с целями, `src/27-main-loop-diagnostics.js` — браузерные тестовые действия; `tests/test_stage97_*.cjs` и `tests/browser_stage97_two_phase_operations.py`. Подробности: `QUALITY_STAGE97_TWO_PHASE_PHYSICAL_OPERATIONS_RU.md`.

## Stage95 · где искать исправления физического появления роботов

- `src/13-enemy-navigation-spawn.js`: `enemySpawnSpaceClear`, `spawnEnemy` — проверка физических AABB и фактического габарита каждого типа врагов.
- `src/24-cinematic-hooks.js`: `dcTargetPhysicallyVisible` — 3D-видимость для индикатора цели.
- `src/27-main-loop-diagnostics.js`: `physicalSpawnAndTarget` — read-only контроль Canvas/WebGL без создания NPC.
- `tests/test_stage95_spawn_hulls_and_intel.cjs`, `tests/test_stage95_actual_spawn_safety.cjs`, `tests/browser_stage95_physical_spawn_target.py`.

## Stage94 · где искать физику укрытий и опасных зон

- `src/15-mission-system.js`: `missionHazardRayClear`, `missionHazardPlayerExposure`, `missionCoilPulseExposure`, `updateMission`.
- `src/16-mission-devices.js`: `updateDevices` (coil), `damagePowerNode` (реактор и цепная реакция).
- `src/27-main-loop-diagnostics.js`: `physicalHazardCover` — read-only диагностика реальных карт.
- `tests/test_stage94_physical_hazard_cover.cjs`, `tests/test_stage94_real_hazard_cover.cjs`, `tests/browser_stage94_physical_hazard_cover.py`.

## Stage93: физический контакт и реальная миссионная близость

- `src/15-mission-system.js`: `missionInteractionClear`, `missionApproachOpen`, `missionWaypointGroundField`, `missionWaypoint`, `missionField` — общий физический raycast/маршруты.
- `src/16-mission-devices.js`: проверка 3D-видимости для зарядки устройств.
- `tests/test_stage93_physical_interaction_and_targets.cjs`: синтетический реальный поручень и кратчайший наземный путь.
- `tests/test_stage93_real_mission_interactions.cjs`: 100 поуровневых проверок реального доступа и контакта.
- `tests/browser_stage93_physical_mission_contacts.py`: браузер ПК/телефон и обе сборки.

## Stage92 — куда смотреть

`src/15-mission-system.js` → `missionField`, `missionRouteTo` (кэш и физические рёбра миссии/портала); `src/19-gameplay-update.js` → `portalFlow`, `portalRoute`, `updateHud` (физический маршрут выхода); `src/27-main-loop-diagnostics.js` → `physicalGuidance` (read-only QA). Проверки: `tests/test_stage92_physical_extraction_guidance.cjs`, `tests/test_stage92_actual_physical_guidance.cjs`, `tests/browser_stage92_physical_guidance.py`.

## Stage91 — физическая актуальность навигации

`src/04a-static-world-solids.js` — стабильный индекс `worldEquipmentGrid`. `src/13a-enemy-world-navigation.js` — `enemyNavMaskDestroyed` для маски и рёбер. `src/13-enemy-navigation-spawn.js` — `navFieldDestroyed`, сброс полей входа к балконам/крышам. `src/19-gameplay-update.js` — досрочный вызов BFS после разрушения. Тесты: `tests/test_stage91_*`.

## Обновление Stage90 (21.11.2026)

**Версия 90, общая приблизительная готовность 93%.** Исправлены неверные прямые маршруты наземных роботов через реальные крутые уступы в Canvas fallback: проверка последовательно сравнивает высоты каждые ≤0.24 м и учитывает переходы между этажами. Пологие ступени (0.22 м) остаются доступными, геометрия, коллайдеры и места миссий не менялись. Подробности и непроверенные сценарии — `QUALITY_STAGE90_PHYSICAL_TERRAIN_SHORTCUTS_RU.md`.

# Stage40 / MP-8 — длительный обрыв связи

`src/21i-multiplayer-recovery.js` — три состояния получения снимков от ведущего, кнопка восстановления, безопасное отключение локального прогноза, ограниченная автоматическая попытка, точное возвращение к авторитетному состоянию. `src/21d-multiplayer-movement.js` — связь с циклом боя и HUD. `src/21c-multiplayer-webrtc.js` — ручной запрос нового P2P после исчерпания авто-попыток. `src/21g-multiplayer-flight-abilities.js` — запрет применения способностей при потере синхронизации. `styles/55-multiplayer.css` — доступная на телефонах кнопка. Проверка: `tests/test_stage40_mp8_recovery.cjs`.

---

# Stage39 / MP-7 — сетевые задержки и восстановление (история)

`src/21h-multiplayer-smoothing.js` — ограниченная очередь быстрых пакетов, адаптация по RTT и джиттеру, безопасный прогноз, коррекция собственного положения, нейтрализация старого ввода. `src/21c-multiplayer-webrtc.js` — отбрасывание пакетов при заполнении `bufferedAmount`. `src/21d-multiplayer-movement.js` — применение новых правил при приёме команд/снимков и в фиксированном цикле. `tests/test_stage39_mp7_smoothing.cjs` — имитация двух клиентов, потерь, обрыва и повторного соединения. Подробный отчёт: `QUALITY_STAGE39_MP7_RU.md`.

---

# Stage38 / MP-6 — полёт и энергетические способности (история)

`src/21g-multiplayer-flight-abilities.js` — сетевой полёт, строгая проверка команд и результатов, рывок, импульс, щит, ремонт, энергия и время восстановления. `src/21d-multiplayer-movement.js` — передача кнопок ↑/↓ и счётчиков нажатия, обновление воздушной физики и HUD. `src/21e-multiplayer-combat.js` — невосприимчивость к урону под щитом и эффектные вспышки. `src/21b-multiplayer-lobby.js` — несовместимость старых клиентов через `MP_VERSION=2`. Проверка: `tests/test_stage38_mp6_abilities.cjs`; отчёт: `QUALITY_STAGE38_MP6_RU.md`.

---

# Stage37 / MP-5A — победа и результаты

`src/21f-multiplayer-round.js`: таймер матча, лимит очков, итоговые таблицы и повтор результатов. `src/21b-multiplayer-lobby.js`: настройка времени/очков. `src/21d-multiplayer-movement.js`: командный старт, остановка раунда, синхронизация итога. `src/21e-multiplayer-combat.js`: выбор командной точки респавна. `src/21c-multiplayer-webrtc.js`: повтор итога при восстановлении DataChannel. Тест: `tests/test_stage37_mp5_rounds.cjs`. Отчёт: `QUALITY_STAGE37_MP5_RU.md`.

---

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

## Stage33 / MP-1 — куда идти для сетевых комнат

- `src/21b-multiplayer-lobby.js`: `MP_MAPS`, `mpNickname`, `mpCode`, `mpSettings`, `MpWire`, `mpCreateRoom`, `mpJoinRoom`, `mpHostFrame`, `mpGuestFrame`, `mpLobby`, `mpLeave` — весь временный контур сетевого лобби.
- `src/22-menus-and-upgrades.js`: добавленная кнопка `multiplayerMenu`; исходное одиночное меню сохранено.
- `styles/55-multiplayer.css`: адаптивные карточки карт, игроков и статусов команд.
- `tests/test_stage33_mp1_lobby.cjs`: имитация Metered и 2–8 подключений с проверкой конкурентного протокола.
- `MULTIPLAYER_SETUP_RU.md`: настройка публичного ключа и ручные сетевые проверки.

## Stage34 / MP-2 — прямые соединения

- `src/21c-multiplayer-webrtc.js`: `mpRtcServers`, `mpRtcCreate`, `mpRtcHostStart`, `mpRtcGuestOffer`, `mpRtcHostAnswer`, `mpRtcSignal` — ICE/SDP/RTCPeerConnection.
- Там же: `mpRtcAttachChannel`, `mpRtcControl`, `mpRtcFastMessage`, `mpRtcFastSend`, `mpRtcTick`, `mpRtcFail`, `mpRtcManualRetry`, `mpRtcDrop`, `mpRtcCloseAll` — каналы, RTT, таймауты и очистка.
- `src/21b-multiplayer-lobby.js`: небольшие точки интеграции при join, leave, получении direct-сообщений, отображение состояния сети в карточках участников.
- `tests/test_stage34_mp2_peer.cjs`, `QUALITY_STAGE34_MP2_RU.md`: имитация сети и спецификация проверки на ПК/Android.

## Сетевая тренировка Stage35

- `src/21b-multiplayer-lobby.js` — создание/вход в комнаты, выбор одной из 18 карт, статусы готовности и запуск.
- `src/21c-multiplayer-webrtc.js` — два P2P-канала, управление SDP/ICE, замеры задержки.
- `src/21d-multiplayer-movement.js` — физика ведущего, входы гостей, синхронизация координат, удалённые аватары, завершение без записи одиночной кампании.
- `tests/test_stage35_mp3_movement.cjs` — имитация двух браузеров с настоящими обработчиками приложения, тесты перемещения, валидации, коллизии, возвращения в комнату.

# Stage36 / MP-4 — быстрый указатель

Новый сетевой бой: `src/21e-multiplayer-combat.js`. Передача команд движения/огня, серверных снимков, очков, здоровья и респавнов: `src/21d-multiplayer-movement.js`. Сетевая кнопка старта и настройки команд: `src/21b-multiplayer-lobby.js`. WebRTC-каналы: `src/21c-multiplayer-webrtc.js`. Тест: `tests/test_stage36_mp4_combat.cjs`. Ручная проверка и ограничения: `QUALITY_STAGE36_MP4_RU.md`.

---



Stage89: физический прямой путь NPC и broadphase — `src/13a-enemy-world-navigation.js`, QA-инспектор — `src/27-main-loop-diagnostics.js`, тесты `tests/test_stage89_canvas_enemy_equipment_routes.cjs`, `tests/test_stage89_actual_npc_equipment_routes.cjs`, `tests/browser_stage89_canvas_robot_routes.py`; детали и ограничения в `QUALITY_STAGE89_PHYSICAL_ENEMY_DIRECT_ROUTES_RU.md`.
