const showEndScreen = () => {
    const solved = loadSolved().length;
    nextMsg.innerHTML = 'Thanks for playing!';
    nextBtn.innerHTML = solved < gameData.levels.length ? `AGAIN (${solved} / ${gameData.levels.length} SOLVED)` : 'AGAIN';
    hideElement(resetElement);
    showElement(levelDoneElement, () => {
        nextBtn.onclick = (e) => {
            e.preventDefault();
            location.reload();
        };
    });
    saveLevel(0);
};

// Set while a game is running: jumps to another level
let jumpToLevel = null;

const startGame = (parent, resources, startLevel) => {
    const game = createGame();
    let currentLevel = startLevel;

    const startNextLevel = () => {
        playAmbient(currentLevel);
        saveLevel(currentLevel);

        let tutorial;
        if (currentLevel == 0) {
            tutorial = resources.tutorial1;
            gameElement.appendChild(tutorial);
            showElement(tutorial);
        }
        if (currentLevel == 2) {
            tutorial = resources.tutorial2;
            gameElement.appendChild(tutorial);
            showElement(tutorial);
        }

        const removeTutorial = () => {
            if (tutorial) {
                const t = tutorial;
                tutorial = null;
                hideElement(t, () => {
                    removeElement(t);
                });
            }
        };

        const level = game.createLevel(gameData.levels[currentLevel], resources, () => {
            removeTutorial();
            jumpToLevel = null;
            markSolved(currentLevel);
            if (currentLevel < gameData.levels.length - 1) {
                currentLevel++;
                saveLevel(currentLevel);
                hideElement(resetElement);
                showElement([levelDoneElement], () => {
                    nextBtn.onclick = (e) => {
                        e.preventDefault();
                        nextBtn.onclick = null;
                        hideElement([levelDoneElement, level.canvas, levelInfo, nodeInfo], () => {
                            removeElement(level.canvas);
                            startNextLevel();
                        });

                    };
                });
            } else {
                showEndScreen();
            }
        });

        parent.appendChild(level.canvas);
        levelInfo.innerHTML = 'Level ' + (currentLevel + 1) + (loadSolved().includes(currentLevel) ? ' &#10003;' : '');
        showElement([level.canvas, resetElement, levelInfo, nodeInfo]);

        const resetLevel = () => {
            removeTutorial();
            jumpToLevel = null;
            backBtn.onclick = skipBtn.onclick = resetBtn.onclick = null;
            hideElement([level.canvas, resetElement, levelInfo, nodeInfo], () => {
                level.shutdown();
                removeElement(level.canvas);
                startNextLevel();
            });

        };

        jumpToLevel = (index) => {
            currentLevel = index;
            resetLevel();
        };

        resetBtn.onclick = (e) => {
            e.preventDefault();
            resetLevel();
        };
        skipBtn.onclick = (e) => {
            e.preventDefault();
            if (currentLevel > gameData.levels.length - 2) {
                return;
            }
            currentLevel++;
            resetLevel();
        };
        backBtn.onclick = (e) => {
            e.preventDefault();
            if (currentLevel < 1) return;
            currentLevel--;
            resetLevel();
        };
        backBtn.style.display = currentLevel > 0 ? 'block' : 'none';
        skipBtn.style.display = currentLevel < gameData.levels.length - 1 ? 'block' : 'none';
    };

    startNextLevel();
};

// Level list: every level can be played; solved ones are marked
const openLevelSelect = (onPick) => {
    const solved = loadSolved();
    const current = loadLevel();
    levelGrid.innerHTML = '';
    gameData.levels.forEach((_, i) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = i + 1;
        b.className = (solved.includes(i) ? 'solved ' : '') + (i === current ? 'current' : '');
        b.setAttribute('aria-label', `Level ${i + 1}${solved.includes(i) ? ', solved' : ''}`);
        b.onclick = () => {
            hideElement(levelSelectElement, () => onPick(i));
        };
        levelGrid.appendChild(b);
    });
    closeLevelsBtn.onclick = (e) => {
        e.preventDefault();
        hideElement(levelSelectElement, () => onPick(null));
    };
    showElement(levelSelectElement);
};

const prepareGame = () => {
    const [loadingBar, context] = createCanvas(200, 7);
    loadingBar.id = 'loadingbar';
    loadingElement.appendChild(loadingBar);
    showElement(loadingElement);
    showElement(loadingBar);
    context.strokeStyle = '#3e7ff9';
    context.fillStyle = '#3e7ff9';
    context.lineWidth = 1;

    context.strokeRect(0.5, 0.5, 199, 4);
    const generate = () => generateResources(p => {
        context.fillRect(0.5, 0.5, 199 / 100 * p, 4);
    }, (resources) => {

        hideElement([loadingBar, loadingElement], () => {
            showElement([titleElement, menuElement, descriptionElement]);

            const savedLevel = loadLevel();
            continueBtn.style.display = savedLevel ? 'block' : 'none';

            const hideUIandStartGame = (startLevel) => {
                playMusic();
                startBtn.onclick = continueBtn.onclick = menuLevelsBtn.onclick = null;
                hideElement([titleElement, menuElement, descriptionElement, loadingElement], () => {
                    // Ensure buttons are fully gone
                    startBtn.style.display = continueBtn.style.display = menuLevelsBtn.style.display = 'none';
                    startGame(contentElement, resources, startLevel);
                });
            };
            startBtn.onclick = (e) => {
                e.preventDefault();
                saveLevel(0);
                hideUIandStartGame(0);
            };

            continueBtn.onclick = (e) => {
                e.preventDefault();
                hideUIandStartGame(savedLevel);
            };

            menuLevelsBtn.onclick = (e) => {
                e.preventDefault();
                hideElement([titleElement, menuElement, descriptionElement], () => {
                    openLevelSelect((index) => {
                        if (index === null) {
                            showElement([titleElement, menuElement, descriptionElement]);
                        } else {
                            hideUIandStartGame(index);
                        }
                    });
                });
            };
        });

    });
    document.fonts.load('20px Outfit').then(generate, generate);
};

levelsBtn.onclick = (e) => {
    e.preventDefault();
    if (!jumpToLevel) return;
    const jump = jumpToLevel;
    openLevelSelect((index) => {
        if (index !== null) jump(index);
    });
};

GameKit.initShell({ slug: 'rewire' });
prepareGame();
