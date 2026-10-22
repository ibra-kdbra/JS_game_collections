// Pointer / device-tilt parallax for the layered background. Each `[data-depth]` layer
// drifts against the input by up to SCALAR of the scene size times its depth.
// Uses the CSS `translate` property so it composes with the GSAP intro transforms.
const createParallax = (scene, { scalar = 0.1, friction = 0.1 } = {}) => {
	const layers = [...scene.querySelectorAll("[data-depth]")];
	const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
	const target = { x: 0, y: 0 };
	const current = { x: 0, y: 0 };
	let enabled = false;
	let frame = 0;

	const render = () => {
		frame = 0;
		current.x += (target.x - current.x) * friction;
		current.y += (target.y - current.y) * friction;
		const w = scene.clientWidth * scalar;
		const h = scene.clientHeight * scalar;
		layers.forEach((layer) => {
			const depth = Number(layer.dataset.depth);
			layer.style.translate = `${-current.x * w * depth}px ${-current.y * h * depth}px`;
		});
		const settled =
			Math.abs(target.x - current.x) < 0.001 && Math.abs(target.y - current.y) < 0.001;
		if (enabled && !settled) frame = requestAnimationFrame(render);
	};
	const aim = (x, y) => {
		if (!enabled || reduceMotion.matches) return;
		target.x = Math.max(-1, Math.min(1, x));
		target.y = Math.max(-1, Math.min(1, y));
		if (!frame) frame = requestAnimationFrame(render);
	};

	window.addEventListener("pointermove", (e) => {
		if (e.pointerType !== "mouse") return;
		aim((e.clientX / innerWidth) * 2 - 1, (e.clientY / innerHeight) * 2 - 1);
	});
	window.addEventListener("deviceorientation", (e) => {
		if (e.gamma === null || e.beta === null) return;
		aim(e.gamma / 30, (e.beta - 45) / 30);
	});

	return {
		enable() {
			enabled = true;
		},
		disable() {
			enabled = false;
		},
	};
};
