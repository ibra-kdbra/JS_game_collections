/**
 * Create and append game cards to a container.
 * @param {HTMLElement} container - The container where game cards will be appended.
 * @param {Array} gamesList - An array of game objects to be displayed in the cards.
 */
function createGameCards(container, gamesList) {
    gamesList.forEach((game) => {
      const card = document.createElement("div");
      card.classList.add(
        "bg-purple-900",
        "rounded-lg",
        "overflow-hidden",
        "shadow-lg",
        "transition-transform",
        "transform",
        "hover:scale-105",
        "cursor-pointer"
      );
  
      card.innerHTML = `
        <a href="${game.link}" target="_blank">
          <img src="${game.imgSrc}" alt="${game.title}" class="w-full h-48 object-cover">
          <div class="p-5">
            <h2 class="text-xl font-bold text-purple-200 mb-3">${game.title}</h2>
            <p class="text-gray-300">${game.description}</p>
          </div>
        </a>
      `;
      container.appendChild(card);
    });
  }
  
  export { createGameCards };
  