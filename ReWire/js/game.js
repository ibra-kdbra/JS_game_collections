const createGame = () => {

    const background = createGameBackground();

    const createLevel = (levelData, resources, onLevelFinish) => {

        const [canvas, context] = createStageCanvas();
        const space = createSpace();

        let cancelFrameLoop;
        const inputControl = createInputControl(canvas);
        const spoolRenderSystem = createSpoolRenderSystem(resources);
        const cableRenderSystem = createCableRenderSystem();

        const shutdown = function () {
            cancelFrameLoop();
            inputControl.shutdown();
            space.shutdown();
            document.body.style.cursor = 'default';
        };
        const spoolSystem = createSpoolSystem(() => {
            shutdown();
            onLevelFinish();
        });
        const mouseDragSystem = createMouseDragSystem(inputControl);


        space.registerSystem(spoolRenderSystem);
        space.registerSystem(spoolSystem);
        space.registerSystem(cableRenderSystem);
        space.registerSystem(mouseDragSystem);


        levelData.spools.forEach((spoolData) => {
            const spoolEntity = {
                pos: { x: spoolData[0], y: spoolData[1] },
                spool: { size: spoolData[2], type: NodeType.spool },
                render: { type: NodeType.spool },
            };

            space.addEntity(spoolEntity);
        });

        levelData.blocks.forEach((block) => {
            const blockEntity = {
                pos: { x: block[0], y: block[1] },
                block: { size: block[2] },
                render: { type: NodeType.block }
            };
            space.addEntity(blockEntity);
        });

        levelData.isolators.forEach((isolator) => {
            const blockEntity = {
                pos: { x: isolator[0], y: isolator[1] },
                spool: { size: isolator[2], type: NodeType.isolator },
                render: { type: NodeType.isolator }
            };
            space.addEntity(blockEntity);
        });

        const start = {
            pos: { x: levelData.start[0], y: levelData.start[1] },
            spool: { size: 0, type: NodeType.start },
            render: { type: NodeType.start }
        };

        const end = {
            pos: { x: levelData.end[0], y: levelData.end[1] },
            spool: { size: 0, type: NodeType.end },
            render: { type: NodeType.end },
            mouseDrag: { size: 30 }
        };

        const cable = {
            cable: { attachments: [{ entity: start, side: Side.left }, { entity: end, side: Side.left }] }
        };

        const finish = {
            finish: {},
            render: { type: NodeType.finish },
            pos: { x: levelData.finish[0], y: levelData.finish[1] }
        };

        space.addEntity(start);
        space.addEntity(finish);
        space.addEntity(end);
        space.addEntity(cable);

        const update = (time) => {
            mouseDragSystem.update(time);
            spoolSystem.update(time);
        };

        const render = (time) => {
            fitStageCanvas(canvas, context);
            context.drawImage(background, 0, 0);

            cableRenderSystem.render(context, time);
            spoolRenderSystem.render(context, time);
        };

        cancelFrameLoop = startFrameLoop(update, render);
        return {
            canvas,
            shutdown
        };
    };

    return {
        createLevel
    };
};
