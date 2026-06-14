const createSpace = () => {
    const systems = [];
    const entities = [];

    return {
        registerSystem: (system) => {
            systems.push(system);
        },
        addEntity: (entity) => {
            entities.push(entity);
            systems.forEach(system => {
                system.addEntity(entity);
            });
        },
        shutdown: () => {
            systems.forEach(system => system.shutdown && system.shutdown());
        },
        entities
    };
};
