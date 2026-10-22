const scene = document.querySelector("#scene");
const parallaxInstance = createParallax(scene);
const alphaContainer = document.querySelector(".alpha-container");
const wordContainer = document.querySelector(".word-container");
const modal = document.querySelector(".modal");
const menuBox = document.querySelector(".modal-content");
const mainContent = document.querySelector(".main-content");
const body = document.querySelector("body");
const guessesSpan = document.querySelector(".guesses-left span");
const scoreSpan = document.querySelector(".score span");
const bestScoreSpan = document.querySelector(".best-score span");
const diffSpan = document.querySelector(".category span:nth-child(2)");
const catSpan = document.querySelector(".category span");
const hintButton = document.querySelector(".hint-button");
const menuStatus = document.querySelector(".menu-status");
const retryButton = document.querySelector(".retry-button");
const dailyButton = document.querySelector(".daily-button");
const bonusButton = document.querySelector(".bonus-button");
const gameoverModal = document.querySelector(".gameover-modal");
const SLUG = "hangman";
const store = GameKit.createStore(SLUG);

// Tuning levers.
const MAX_GUESSES = 5;
const POINTS_PER_LETTER = 10;
const HINT_COST = 15; // Points; when the score can't cover it, a hint costs one guess instead.
const HINTS_PER_WORD = 1;
const FETCH_TIMEOUT_MS = 6000;
const diffValues = {
	easy: 0.4,
	medium: 0.7,
	hard: 1.3,
};
const CATEGORIES = [
	{ id: "food", label: "Food", api: "food" },
	{ id: "animals", label: "Animals", api: "animals" },
	{ id: "countries", label: "Countries", api: "countries" },
	{ id: "sports", label: "Sports", api: "sports" },
	{ id: "instruments", label: "Instruments", api: "instruments" },
	{ id: "jobs", label: "Jobs" },
	{ id: "transport", label: "Transport" },
	{ id: "ocean", label: "Ocean" },
	{ id: "fantasy", label: "Fantasy" },
	{ id: "space", label: "Space", api: "planets" },
	{ id: "science", label: "Science", api: "sciences" },
	{ id: "software", label: "Software", api: "software" },
	{ id: "superheroes", label: "Superheroes" },
	{ id: "pokemon", label: "Pokemon", api: "pokemon" },
];
const wordUrl = "https://api.datamuse.com/words?max=100&rel_trg=";
const pokeUrl = "https://pokeapi.co/api/v2/pokemon/?limit=151";

let wordData = null;
let categoryWords = [];
let words = [];
let wordArray;
let currentWord = "";
let hidden = {};
let nextButton;
let guesses = MAX_GUESSES;
let score = 0;
let streak = 0;
let hintsLeft = HINTS_PER_WORD;
let roundOver = true;
let mode = "classic";
let bestScore = store.get("bestScore", 0);
let category = CATEGORIES.some((c) => c.id === store.get("category"))
	? store.get("category")
	: "food";
let difficulty = diffValues[store.get("difficulty")] ? store.get("difficulty") : "medium";
let bonusWords = store.get("bonusWords", false);
allowAudio = store.get("sound", true);
bestScoreSpan.innerText = bestScore;

const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const isTouch = () => matchMedia("(pointer: coarse)").matches;
const categoryLabel = (id) => CATEGORIES.find((c) => c.id === id).label;

// Seeded randomness so the daily word (and which letters it hides) is the same for everyone.
const hashString = (str) => {
	let h = 1779033703 ^ str.length;
	for (let i = 0; i < str.length; i++) {
		h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
		h = (h << 13) | (h >>> 19);
	}
	return h >>> 0;
};
const mulberry32 = (seed) => () => {
	seed = (seed + 0x6d2b79f5) | 0;
	let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
	t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
	return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const todayKey = (d = new Date()) => {
	const pad = (n) => String(n).padStart(2, "0");
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const dailyPick = (dateKey) => {
	const rng = mulberry32(hashString(`hangman-daily-${dateKey}`));
	const cat = CATEGORIES[Math.floor(rng() * CATEGORIES.length)];
	const list = wordData[cat.id];
	return { category: cat.id, word: list[Math.floor(rng() * list.length)], rng };
};

const getRandomWord = () => {
	if (words.length === 0) {
		// Out of words: reshuffle the whole category, avoiding an immediate repeat.
		words = categoryWords.filter((w) => w !== currentWord);
	}
	const index = Math.floor(Math.random() * words.length);
	currentWord = words.splice(index, 1)[0];
	return currentWord.toUpperCase().split("");
};
const reduceGuesses = () => {
	if (guesses > 0) guesses--;
	guessesSpan.innerText = `${guesses}/${MAX_GUESSES}`;
};
const resetGuesses = () => {
	guesses = MAX_GUESSES;
	guessesSpan.innerText = `${guesses}/${MAX_GUESSES}`;
};
const increaseScore = (val) => {
	score += val;
	scoreSpan.innerText = score;
};
const resetScore = () => {
	score = 0;
	streak = 0;
	scoreSpan.innerText = score;
};
const updateBestScore = () => {
	if (mode === "classic" && score > bestScore) {
		bestScore = score;
		bestScoreSpan.innerText = bestScore;
		store.set("bestScore", bestScore);
	}
};
const recordRun = () => {
	if (mode !== "classic") return;
	GameKit.recordBest(SLUG, score, { label: `${score} pts` });
	GameKit.recordBest(SLUG, streak, {
		mode: "streak",
		label: `${streak} word${streak === 1 ? "" : "s"} in a row`,
	});
};
const disableAllButtons = () => {
	let buttons = document.querySelectorAll("main button");
	buttons.forEach((button) => {
		if (!button.classList.contains("sound-button")) button.disabled = true;
	});
};
const enableAllButtons = () => {
	let buttons = document.querySelectorAll("main button");
	buttons.forEach((button) => {
		if (
			!button.classList.contains("next-button") &&
			!button.classList.contains("sound-button")
		)
			button.disabled = false;
	});
	updateHintButton();
};
// Creating alphabet buttons...
alphabet.forEach((letter) => {
	let button = document.createElement("button");
	button.className = "letter";
	button.id = `${letter}`;
	button.value = letter;
	button.innerText = letter;
	button.setAttribute("aria-label", `Guess ${letter}`);
	button.addEventListener("click", () => {
		if (roundOver || button.disabled) return;
		button.disabled = true;
		checkAnswer(letter);
	});
	alphaContainer.append(button);
});
const alphaButtons = document.querySelectorAll("button.letter");
const fadeOut = {
	keyframes: [
		{
			transform: "translateX(0)",
			opacity: 1,
		},
		{
			transform: "translateX(-20%)",
			opacity: 0,
		},
	],
	opts: {
		fill: "forwards",
		duration: 300,
	},
};
const fadeIn = {
	keyframes: [
		{
			transform: "translateX(20%)",
			opacity: 0,
		},
		{
			transform: "translateX(0)",
			opacity: 1,
		},
	],
	opts: {
		fill: "forwards",
		duration: 300,
	},
};
const appear = {
	keyframes: [
		{
			opacity: 0,
		},
		{
			opacity: 1,
		},
	],
	opts: {
		duration: 300,
		fill: "forwards",
		easing: "linear",
		delay: 500,
	},
};
const disappear = {
	keyframes: [
		{
			opacity: 1,
		},
		{
			opacity: 0,
		},
	],
	opts: {
		duration: 300,
		fill: "forwards",
		easing: "linear",
	},
};
let xDown = null;
let yDown = null;
let swipped = false;
const handleTouchStart = (e) => {
	xDown = e.touches[0].clientX;
	yDown = e.touches[0].clientY;
};
const handleTouchMove = (e) => {
	if (!xDown || !yDown) return;
	let xUp = e.touches[0].clientX;
	let yUp = e.touches[0].clientY;
	let xDiff = xDown - xUp;
	let yDiff = yDown - yUp;
	if (Math.abs(xDiff) > Math.abs(yDiff) && xDiff > 0) {
		swipped = true;
	}
};
const advanceTouch = () => {
	body.classList.remove("swipe");
	wordContainer.animate(fadeOut.keyframes, fadeOut.opts);
	setTimeout(() => nextWord(true), 300);
	resetGuesses();
	resetCanvas();
	document.removeEventListener("touchstart", handleTouchStart);
	document.removeEventListener("touchmove", handleTouchMove);
	document.removeEventListener("touchend", handleTouchEnd);
	xDown = null;
	yDown = null;
	swipped = false;
};
const handleTouchEnd = () => {
	if (swipped) advanceTouch();
};
const canAdvance = () => roundOver && guesses > 0 && mode === "classic" && !gameoverVisible();
const goNext = () => {
	if (!canAdvance()) return;
	if (body.classList.contains("swipe")) advanceTouch();
	else if (nextButton && !nextButton.disabled) nextButton.click();
};
wordContainer.addEventListener("click", (e) => {
	if (body.classList.contains("swipe") && !e.target.closest(".next-button")) goNext();
});
const toggleNextButton = () => {
	if (nextButton && nextButton.disabled) {
		nextButton.disabled = false;
		nextButton.style.visibility = "visible";
		nextButton.animate(appear.keyframes, appear.opts);
	} else if (nextButton) {
		nextButton.animate(disappear.keyframes, disappear.opts);
		nextButton.disabled = true;
		nextButton.style.visibility = "hidden";
	}
};
const svg = document.querySelector("#nextIcon");
let startScene = gsap.timeline({
	defaults: { duration: 2 },
	onComplete: () => {
		parallaxInstance.enable();
	},
});
let nextButtonTl = gsap.timeline({ repeat: -1, yoyo: true });
nextButtonTl.to(svg, { x: 20, duration: 0.5, ease: "none" });
nextButtonTl.pause().progress(0);
const CreateNextButton = () => {
	if (!nextButton) {
		nextButton = document.createElement("button");
		nextButton.className = "next-button";
		nextButton.setAttribute("aria-label", "Next word (Enter)");
		nextButton.append(svg);
		nextButton.addEventListener("pointerenter", () => {
			nextButtonTl.pause();
			gsap.timeline().to(svg, { x: 0, duration: 0.15 });
		});
		nextButton.addEventListener("pointerleave", () => {
			nextButtonTl.progress(0).play();
		});
		nextButton.addEventListener("click", () => {
			resetGuesses();
			resetCanvas();
			wordContainer.animate(fadeOut.keyframes, fadeOut.opts);
			setTimeout(nextWord, 300);
			toggleNextButton();
		});
		toggleNextButton();
	}
	nextButtonTl.play();
	wordContainer.append(nextButton);
};

const gameoverVisible = () => gameoverModal.style.visibility === "visible";
const showResult = (title, delay) => {
	document.querySelector(".gameover-box .text").innerText = title;
	document.querySelector(".gameover-word b").innerText = currentWord.toUpperCase();
	document.querySelector(".gameover-data .score").innerText = score;
	document.querySelector(".gameover-data .best-score").innerText = bestScore;
	document.querySelector(".gameover-data .streak").innerText = streak;
	document.querySelector(".gameover-data .daily-note").hidden = mode !== "daily";
	document.querySelector(".score-cont").hidden = mode === "daily";
	document.querySelector(".best-score-cont").hidden = mode === "daily";
	document.querySelector(".gameover-box .play-again").hidden = mode === "daily";
	setTimeout(() => {
		gsap.set(".gameover-box", { scale: 1.6 });
		gsap.set(gameoverModal, { opacity: 0 });
		gsap
			.timeline({ defaults: { duration: 0.25, ease: "none" } })
			.to(gameoverModal, { visibility: "visible" })
			.to(gameoverModal, { opacity: 1 })
			.to(".gameover-box", { scale: 1, opacity: 1 }, "<");
		parallaxInstance.disable();
	}, delay);
};
const finishDaily = (solved) => {
	const date = todayKey();
	store.set("daily", { date, solved, word: currentWord, wrong: MAX_GUESSES - guesses });
	if (solved) {
		const last = store.get("dailyStreak", { count: 0, date: "" });
		const yesterday = new Date();
		yesterday.setDate(yesterday.getDate() - 1);
		const count = last.date === todayKey(yesterday) ? last.count + 1 : 1;
		store.set("dailyStreak", { count, date });
		streak = count;
		GameKit.recordBest(SLUG, count, {
			mode: "daily-streak",
			label: `${count} day daily streak`,
		});
	} else {
		store.set("dailyStreak", { count: 0, date });
		streak = 0;
	}
	updateDailyButton();
};
const solveWord = () => {
	roundOver = true;
	updateHintButton();
	let boxes = document.querySelectorAll("li.letter");
	boxes.forEach((box) => {
		if (!box.classList.contains("hyphen")) box.style.border = "2px solid #37b666";
	});
	wordContainer.animate(
		[
			{
				transform: "scale(1)",
			},
			{
				transform: "scale(1.06)",
			},
		],
		{
			duration: 250,
			iterations: 2,
			direction: "alternate",
		}
	);
	playSound("win");
	if (mode === "daily") {
		finishDaily(true);
		showResult("SOLVED!", 1200);
		return;
	}
	streak++;
	recordRun();
	if (isTouch()) {
		body.classList.add("swipe");
		document.addEventListener("touchstart", handleTouchStart, false);
		document.addEventListener("touchmove", handleTouchMove, false);
		document.addEventListener("touchend", handleTouchEnd, false);
	} else {
		toggleNextButton();
	}
};
const revealLetter = (value, points) => {
	let keys = Object.keys(hidden).filter((k) => hidden[k] === value);
	keys.forEach((k) => {
		let span = document.querySelector(`#id-${k}`);
		let cover = document.querySelector(`#cover-${k}`);
		span.innerText = hidden[k];
		delete hidden[k];
		span.style.visibility = "visible";
		cover.style.transform = "scaleY(0)";
		if (points) increaseScore(points);
	});
	updateBestScore();
	if (keys.length && Object.keys(hidden).length === 0) solveWord();
	return keys.length > 0;
};
const loseRound = () => {
	roundOver = true;
	disableAllButtons();
	playSound("lose", 0.2);
	if (mode === "daily") {
		finishDaily(false);
		showResult("MISSED!", 2000);
	} else {
		recordRun();
		showResult("GAME OVER", 2000);
	}
};
const wrongGuess = () => {
	reduceGuesses();
	pullUp();
	updateHintButton();
	if (guesses === 0) loseRound();
};
const checkAnswer = (value) => {
	if (revealLetter(value, mode === "classic" ? POINTS_PER_LETTER : 0)) {
		playSound("correct");
	} else {
		document.getElementById(value).style.border = "1px solid red";
		playSound("wrong", 0.2);
		wrongGuess();
	}
};
const hintPrice = () => (mode === "classic" && score >= HINT_COST ? "points" : "guess");
const updateHintButton = () => {
	const usable = !roundOver && hintsLeft > 0 && (hintPrice() === "points" || guesses > 1);
	hintButton.disabled = !usable;
	hintButton.querySelector("small").innerText =
		hintPrice() === "points" ? `-${HINT_COST}` : "-1 guess";
};
const useHint = () => {
	if (hintButton.disabled) return;
	const letters = [...new Set(Object.values(hidden))];
	const letter = letters[Math.floor(Math.random() * letters.length)];
	hintsLeft--;
	const button = document.getElementById(letter);
	button.disabled = true;
	button.style.border = "1px solid var(--second-button-color)";
	playSound("correct");
	if (hintPrice() === "points") {
		increaseScore(-HINT_COST);
		revealLetter(letter, 0);
	} else {
		revealLetter(letter, 0);
		if (!roundOver) wrongGuess();
	}
	updateHintButton();
};
hintButton.addEventListener("click", useHint);
const hideLetters = (wordArray, rng = Math.random) => {
	let maxHidden = Math.floor(wordArray.length * diffValues[difficulty]);
	for (let i = 0; i < maxHidden; i++) {
		let ran = Math.floor(rng() * wordArray.length);
		if (wordArray[ran] !== "" && wordArray[ran] !== " ") {
			hidden[ran] = wordArray[ran];
			wordArray[ran] = "";
		}
	}
	if (Object.keys(hidden).length === 0) {
		// Very short words can dodge every pick; always hide at least one letter.
		const letters = wordArray.map((l, i) => (l === " " ? -1 : i)).filter((i) => i >= 0);
		const ran = letters[Math.floor(rng() * letters.length)];
		hidden[ran] = wordArray[ran];
		wordArray[ran] = "";
	}
};
const clearPrevWord = (all) => {
	alphaButtons.forEach((button) => {
		button.disabled = false;
		button.style.border = "none";
	});
	if (all && wordContainer.firstChild) {
		while (wordContainer.firstChild) {
			wordContainer.removeChild(wordContainer.lastChild);
		}
		return;
	}
	if (wordContainer.firstChild) {
		while (wordContainer.firstChild.className !== "next-button") {
			wordContainer.removeChild(wordContainer.firstChild);
		}
	}
};
const createLetterElements = (wordArray) => {
	wordContainer.style.setProperty("--letters", wordArray.length);
	wordArray.forEach((letter, i) => {
		let box = document.createElement("li");
		let cover = document.createElement("div");
		let span = document.createElement("span");
		box.className = "letter";
		cover.className = "cover";
		span.innerText = letter;
		span.id = "id-" + i;
		cover.id = "cover-" + i;
		if (letter === "") {
			cover.style.visibility = "visible";
			span.style.visibility = "collapse";
		}
		if (letter === " ") {
			span.style.borderBottom = "4px solid white";
			box.classList.add("hyphen");
			box.style.backgroundColor = "rgba(0,0,0,0)";
			box.style.boxShadow = "none";
		}
		box.append(span);
		box.append(cover);
		wordContainer.append(box);
	});
	if (!isTouch() && mode === "classic") CreateNextButton();
};
const beginRound = (rng) => {
	hidden = {};
	hintsLeft = HINTS_PER_WORD;
	hideLetters(wordArray, rng);
	roundOver = false;
	createLetterElements(wordArray);
	updateHintButton();
};
const nextWord = (all) => {
	wordArray = getRandomWord();
	clearPrevWord(all);
	beginRound();
	wordContainer.animate(fadeIn.keyframes, fadeIn.opts);
};
let alpha = document.querySelector(".alpha-container");
let word = document.querySelector(".word-container");
let right = document.querySelector(".hill-right");
let mid = document.querySelector(".hill-middle");
let left = document.querySelector(".hill-left");
let mountains = document.querySelector(".mountains");
let city = document.querySelector(".city");
const setupScene = () => {
	parallaxInstance.disable();
	alpha.style.opacity = 0;
	word.style.opacity = 0;
	alpha.classList.toggle("sliding-up");
	word.classList.toggle("sliding-up");
	alpha.classList.toggle("paused");
	word.classList.toggle("paused");
	gsap.set(right, { scale: 1.4, y: "5%" });
	gsap.set(left, { scale: 1.4, y: "5%" });
	if (isTouch()) {
		gsap.set(mid, { y: "5%" });
	} else {
		gsap.set(mid, { y: "-6%" });
	}
	gsap.set(mountains, { scale: 1.05, y: "10%" });
	gsap.set(city, { scale: 1.1, y: "5%" });
	startScene
		.to(mountains, { scale: 1, y: 0 }, 0)
		.to(city, { scale: 1, y: 0 }, "<+0.3")
		.to(right, { scale: 1, y: 0 }, 0)
		.to(left, { scale: 1, y: 0 }, "<")
		.to(mid, { y: 0 }, "<");
	startScene.pause().progress(0);
	stopAnimate();
};
setupScene();
const animateScene = () => {
	if (startScene.paused()) {
		animateRope();
		startScene.play();
		alpha.classList.toggle("paused");
		word.classList.toggle("paused");
	}
};
const menuVisible = () => modal.style.visibility !== "collapse";
const showMenu = () => {
	modal.style.visibility = "visible";
	modal.style.opacity = 1;
	menuBox.classList.toggle("expand");
	menuBox.classList.toggle("drop-down");
	mainContent.classList.toggle("blur-out");
	mainContent.classList.toggle("blur-in");
};
const closeMenu = () => {
	menuBox.classList.toggle("drop-down");
	menuBox.classList.toggle("expand");
	mainContent.classList.toggle("blur-in");
	mainContent.classList.toggle("blur-out");
	modal.style.opacity = 0;
	setTimeout(() => {
		modal.style.visibility = "collapse";
	}, 600);
};
const fetchJson = (url) => {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
	return fetch(url, { signal: controller.signal })
		.then((response) => {
			if (!response.ok) throw new Error(`Request failed (${response.status})`);
			return response.json();
		})
		.finally(() => clearTimeout(timer));
};
const loadWordLists = () => {
	if (wordData) return Promise.resolve(wordData);
	return fetchJson("./data/words.json").then((json) => {
		wordData = json;
		return json;
	});
};
// Optional extra words from the web. Any failure just leaves the offline list in place.
const fetchBonusWords = (cat) => {
	const spec = CATEGORIES.find((c) => c.id === cat);
	if (!bonusWords || !spec.api) return Promise.resolve([]);
	const request =
		cat === "pokemon"
			? fetchJson(pokeUrl).then((json) => json.results.map((poke) => poke.name))
			: fetchJson(`${wordUrl}${encodeURIComponent(spec.api)}`).then((json) =>
					json.map((obj) => obj.word)
			  );
	return request
		.then((list) => list.filter((w) => /^[a-z]{4,12}$/.test(w)))
		.catch(() => {
			menuStatus.innerText = "Online words unavailable, using the built-in list.";
			return [];
		});
};
const setupGame = () => {
	clearPrevWord(true);
	resetGuesses();
	resetScore();
	resetCanvas();
	nextButton = undefined;
	body.classList.remove("swipe");
};
const startGame = () => {
	setupGame();
	nextWord(true);
	closeMenu();
	animateScene();
	enableAllButtons();
};
const startDaily = () => {
	const pick = dailyPick(todayKey());
	mode = "daily";
	setupGame();
	catSpan.innerText = "DAILY WORD";
	diffSpan.innerText = categoryLabel(pick.category);
	currentWord = pick.word;
	wordArray = pick.word.toUpperCase().split("");
	const savedDifficulty = difficulty;
	difficulty = "medium";
	beginRound(pick.rng);
	difficulty = savedDifficulty;
	closeMenu();
	animateScene();
	enableAllButtons();
};
const toggleMenuList = (name) => {
	let list = document.querySelector(`.${name}-list .list`);
	list.classList.toggle("closed-list");
	list.classList.toggle("opened-list");
};
let catButton = document.querySelector(".category-button");
let diffButton = document.querySelector(".difficulty-button");
let playButton = document.querySelector(".start-game");
const setMenuEnabled = (enabled) => {
	[catButton, diffButton, playButton, dailyButton, bonusButton].forEach(
		(b) => (b.disabled = !enabled)
	);
	if (enabled) updateDailyButton();
};
const showLoadError = (action) => {
	playButton.classList.remove("loading");
	setMenuEnabled(true);
	menuStatus.innerText = "Couldn't load the word lists. Check your connection and try again.";
	retryButton.hidden = false;
	retryButton.onclick = () => {
		retryButton.hidden = true;
		action();
	};
};
const play = () => {
	setMenuEnabled(false);
	menuStatus.innerText = "";
	retryButton.hidden = true;
	playButton.classList.add("loading");
	loadWordLists()
		.then(() => fetchBonusWords(category))
		.then((extra) => {
			playButton.classList.remove("loading");
			mode = "classic";
			catSpan.innerText = categoryLabel(category).toUpperCase();
			diffSpan.innerText = difficulty;
			categoryWords = [...new Set([...wordData[category], ...extra])];
			words = [...categoryWords];
			startGame();
		})
		.catch(() => showLoadError(play));
};
const playDaily = () => {
	setMenuEnabled(false);
	menuStatus.innerText = "";
	retryButton.hidden = true;
	loadWordLists()
		.then(startDaily)
		.catch(() => showLoadError(playDaily));
};
const updateDailyButton = () => {
	const today = store.get("daily");
	const done = today && today.date === todayKey();
	dailyButton.disabled = !!done;
	dailyButton.innerText = done
		? `Daily ${today.solved ? "solved" : "missed"}, back tomorrow`
		: "Daily word";
};
const updateBonusButton = () => {
	bonusButton.innerText = `Online bonus words: ${bonusWords ? "on" : "off"}`;
	bonusButton.setAttribute("aria-pressed", String(bonusWords));
};
playButton.addEventListener("click", play);
dailyButton.addEventListener("click", playDaily);
bonusButton.addEventListener("click", () => {
	bonusWords = !bonusWords;
	store.set("bonusWords", bonusWords);
	updateBonusButton();
});
catButton.addEventListener("click", () => {
	toggleMenuList("category");
});
catButton.addEventListener("focusout", () => {
	let catList = catButton.nextElementSibling;
	if (catList.classList.contains("opened-list")) {
		toggleMenuList("category");
	}
});
diffButton.addEventListener("click", () => {
	toggleMenuList("difficulty");
});
diffButton.addEventListener("focusout", () => {
	let diffList = diffButton.nextElementSibling;
	if (diffList.classList.contains("opened-list")) {
		toggleMenuList("difficulty");
	}
});
const goHome = () => {
	nextButtonTl.pause().progress(0);
	if (mode === "classic" && !roundOver) recordRun();
	roundOver = true;
	setMenuEnabled(true);
	showMenu();
};
document.querySelector(".home-button").addEventListener("click", goHome);
let soundButton = document.querySelector(".sound-button");
const updateSoundButton = () => {
	soundButton.classList.toggle("disabled", !allowAudio);
	soundButton.setAttribute("aria-label", allowAudio ? "Mute sound" : "Unmute sound");
};
soundButton.addEventListener("click", () => {
	allowAudio = !allowAudio;
	store.set("sound", allowAudio);
	updateSoundButton();
});
const catList = document.querySelector(".category-list .list");
CATEGORIES.forEach((cat) => {
	const li = document.createElement("li");
	li.innerText = cat.label;
	li.addEventListener("pointerdown", () => {
		category = cat.id;
		store.set("category", category);
		catButton.innerText = cat.label;
	});
	catList.append(li);
});
let diffItems = document.querySelectorAll(".difficulty-list li");
diffItems.forEach((li) => {
	li.addEventListener("pointerdown", () => {
		diffButton.innerText = li.innerText;
		difficulty = li.innerText.toLowerCase();
		store.set("difficulty", difficulty);
	});
});
catButton.innerText = categoryLabel(category);
diffButton.innerText = difficulty[0].toUpperCase() + difficulty.slice(1);
updateSoundButton();
updateBonusButton();
updateDailyButton();
const closeGameover = () =>
	gsap.to(".gameover-box", {
		duration: 0.25,
		scale: 1.6,
		opacity: 0,
		ease: "none",
	});
document
	.querySelector(".gameover-box .main-menu")
	.addEventListener("click", () => {
		closeGameover().then(() => {
			nextButtonTl.pause().progress(0);
			setMenuEnabled(true);
			showMenu();
			setTimeout(() => {
				gameoverModal.style.visibility = "collapse";
				parallaxInstance.enable();
			}, 600);
		});
	});
document
	.querySelector(".gameover-box .play-again")
	.addEventListener("click", () => {
		closeGameover().then(() => {
			gameoverModal.style.visibility = "collapse";
			words = [...categoryWords];
			setupGame();
			nextWord(true);
			enableAllButtons();
			parallaxInstance.enable();
		});
	});
document.addEventListener("keydown", (e) => {
	if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
	if (gameoverVisible()) {
		if (e.key === "Enter") {
			const again = document.querySelector(".gameover-box .play-again");
			(again.hidden ? document.querySelector(".gameover-box .main-menu") : again).click();
			e.preventDefault();
		}
		return;
	}
	if (menuVisible()) return;
	if (/^[a-z]$/i.test(e.key)) {
		const button = document.getElementById(e.key.toUpperCase());
		if (button && !button.disabled && !roundOver) button.click();
		e.preventDefault();
	} else if (e.key === "Enter" || e.key === "ArrowRight") {
		goNext();
		e.preventDefault();
	} else if (e.key === "?" || e.key === "/") {
		useHint();
		e.preventDefault();
	} else if (e.key === "Escape") {
		goHome();
	}
});
