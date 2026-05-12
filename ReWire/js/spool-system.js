const calculateTangents = function (attachments) {
    for (let i = 0; i < attachments.length - 1; i++) {
        const a = attachments[i];
        const b = attachments[i + 1];
        const tangents = getTangents(a.entity.pos, a.entity.spool.size, b.entity.pos, b.entity.spool.size);
        const idx = a.side == Side.left ? b.side == Side.left ? 1 : 3 : b.side == Side.left ? 2 : 0;

        if (!tangents[idx]) {

        }
        a.outPos = tangents[idx][0];
        b.inPos = tangents[idx][1];
    }
};

const getIntersections = (a, b, spoolEntities, ignoreA, ignoreB) => {
    return spoolEntities
        .filter(spoolEntity =>
            (spoolEntity != ignoreA && spoolEntity != ignoreB) &&
            lineCircleIntersect(a, b, spoolEntity.pos, spoolEntity.spool.size)
        )
        .sort((ca, cb) => dist2(ca.pos, a) > dist2(cb.pos, a) ? 1 : -1); //TODO: need to add the radius
};

const resolveConnections = function (attachments, spools) {
    let resolved;
    do {
        resolved = true;
        for (let i = 0; i < attachments.length - 1; i++) {
            const a = attachments[i];
            const b = attachments[i + 1];
            const entity = getIntersections(a.outPos, b.inPos, spools, a.entity, b.entity)[0];
            if (entity) {
                if (entity.spool.isAttached) {
                    // node already connected
                    a.overlap = true;
                } else {
                    // we have a connection
                    entity.spool.isAttached = true;
                    playSound(Sounds.connect);
                    const side = sideOfLine(a.outPos, b.inPos, entity.pos);
                    const attachment = { entity: entity, side };
                    attachments.splice(i + 1, 0, attachment);
                    resolved = false;
                    calculateTangents([a, attachment, b]);
                    break;
                }
            }
        }
    } while (!resolved);
};

const resolveDisconnections = function (attachments) {
    let resolved;
    do {
        resolved = true;
        for (let i = 1; i < attachments.length - 1; i++) {
            const a = attachments[i - 1];
            const b = attachments[i];
            const c = attachments[i + 1];

            const vAB = subV(a.outPos, b.inPos);
            const vBC = subV(b.outPos, c.inPos);
            let angle = Math.atan2(vBC.y, vBC.x) - Math.atan2(vAB.y, vAB.x);
            if (angle < 0) angle += 2 * Math.PI;
            if ((b.side == Side.left && angle > Math.PI * 1.8) ||
                (b.side == Side.right && angle < Math.PI * 0.2)) {
                attachments.splice(i, 1);
                b.entity.spool.isAttached = false;
                resolved = false;
                calculateTangents([a, c]);
                break;
            }
        }
    } while (!resolved);
};

const createSpoolSystem = (onLevelCompleted) => {
    const spoolEntities = [];
    const blockEntities = [];
    const cables = [];
    let finishEntity;
    let lastPoweredSpools = 0;
    let numSpools = 0;

    return {
        addEntity: (entity) => {
            if (entity.spool) {
                spoolEntities.push(entity);
                if (entity.spool.type == NodeType.spool) {
                    numSpools++;
                    nodeInfo.innerHTML = 0 + ' / ' + numSpools;
                }
            }
            if (entity.cable) {
                cables.push(entity);
            }
            if (entity.block) {
                blockEntities.push(entity);
            }
            if (entity.finish) {
                finishEntity = entity;
            }
        },
        update: (time) => {
            cables.forEach(cable => {
                const attachments = cable.cable.attachments;

                // reset states
                cable.cable.overpowered = false;
                attachments.forEach(attachment => {
                    attachment.overlap = false;
                });
                spoolEntities.forEach(spool => {
                    spool.spool.powered = spool.spool.overpowered = false;
                });
                let numPoweredSpools = 0;
                let wasOverpowered = cable.cable.overpowered;


                calculateTangents(attachments);
                resolveConnections(attachments, spoolEntities);
                resolveDisconnections(attachments);

                // set isolated status
                let isIsolated = false;
                cable.cable.attachments.forEach(attachment => {
                    const spool = attachment.entity.spool;
                    if (spool.type == NodeType.isolator) {
                        isIsolated = !isIsolated;
                    }
                    attachment.isolated = isIsolated;
                });

                // check line overlap
                for (let i = 0; i < attachments.length - 1; i++) {
                    const a1 = attachments[i];
                    const b1 = attachments[i + 1];
                    if (a1.isolated) {
                        continue;
                    }
                    for (let j = 0; j < attachments.length - 1; j++) {
                        const a2 = attachments[j];
                        const b2 = attachments[j + 1];
                        if (a2.isolated) {
                            continue;
                        }
                        if (lineLineIntersect(a1.outPos, b1.inPos, a2.outPos, b2.inPos)) {
                            a1.overlap = a2.overlap = true;
                        }
                    }
                }

                // check block collision
                for (let i = 0; i < attachments.length - 1; i++) {
                    const a1 = attachments[i];
                    const b1 = attachments[i + 1];
                    for (let j = 0; j < blockEntities.length; j++) {
                        if (lineCircleIntersect(a1.outPos, b1.inPos, blockEntities[j].pos, blockEntities[j].block.size)) {
                            a1.overlap = true;
                            if (!cable.cable.overpowered) playSound(Sounds.error);
                            cable.cable.overpowered = true;
                        }
                    }
                }
                // check power / overpower
                let hasPower = true;
                cable.cable.attachments.every(attachment => {
                    if (!hasPower) {
                        return false;
                    }
                    if (attachment.isolated && !attachment.overlap) {
                        return true;
                    }
                    if (attachment.entity.spool.powered) {
                        attachment.entity.spool.overpowered = true;
                        cable.cable.overpowered = true;
                        return false;
                    }

                    attachment.entity.spool.powered = true;

                    if (attachment.overlap) {

                        hasPower = false;
                    } else if (attachment.entity.spool.type == NodeType.spool) {

                        numPoweredSpools++;
                    }
                    return true;
                });

                // check if level is completed
                if (hasPower && finishEntity.finish.connected && !cable.cable.overpowered && numPoweredSpools === numSpools) {
                    playSound(Sounds.complete);
                    onLevelCompleted();
                }

                if (numPoweredSpools != lastPoweredSpools) {
                    nodeInfo.innerHTML = numPoweredSpools + ' / ' + numSpools;
                }


                lastPoweredSpools = numPoweredSpools;

            });
        }
    };
};
